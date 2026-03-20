import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cacheStore, revalidateTagMock, unstableCacheMock } = vi.hoisted(
  () => {
    const cacheStore = new Map<string, Promise<unknown>>();
    const revalidateTagMock = vi.fn();
    const unstableCacheMock = vi.fn(
      (loader: () => Promise<unknown>, keyParts: string[]) => {
        const cacheKey = JSON.stringify(keyParts);

        return async () => {
          if (!cacheStore.has(cacheKey)) {
            cacheStore.set(cacheKey, loader());
          }

          return cacheStore.get(cacheKey);
        };
      }
    );

    return {
      cacheStore,
      revalidateTagMock,
      unstableCacheMock
    };
  }
);

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: revalidateTagMock,
  unstable_cache: unstableCacheMock
}));

vi.mock("@/lib/data-cache", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data-cache")>(
    "@/lib/data-cache"
  );

  return {
    ...actual,
    canUseDataCache: vi.fn(() => true)
  };
});

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  lesson,
  lessonProgress,
  media,
  runMigrations,
  userSetting,
  type DatabaseClient
} from "@/db";
import {
  revalidateGlossarySummaryCache,
  revalidateReviewSummaryCache,
  revalidateSettingsCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import { getGlobalReviewFirstCandidateLoadResult } from "@/lib/review";

describe("global review first-candidate cache", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    cacheStore.clear();
    unstableCacheMock.mockClear();
    revalidateTagMock.mockClear();
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-first-candidate-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reuses the cached snapshot for repeated first-candidate loads and invalidates on review-related cache busts", async () => {
    await database.insert(media).values([
      {
        id: "media_a",
        slug: "media-a",
        title: "Media A",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture A",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(lesson).values({
      id: "lesson_a",
      mediaId: "media_a",
      segmentId: null,
      slug: "intro-a",
      title: "Lesson A",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson A",
      status: "active",
      sourceFile: "tests/review-first-candidate-cache/media-a.md",
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(lessonProgress).values({
      lessonId: "lesson_a",
      status: "completed",
      completedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(card).values([
      {
        id: "card_a",
        mediaId: "media_a",
        lessonId: "lesson_a",
        segmentId: null,
        sourceFile: "tests/review-first-candidate-cache/media-a.md",
        cardType: "recognition",
        front: "A",
        back: "A back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T10:00:00.000Z",
        updatedAt: "2026-03-10T10:00:00.000Z"
      }
    ]);
    await database.insert(userSetting).values({
      key: "review_daily_limit",
      valueJson: "1",
      updatedAt: "2026-03-10T11:00:00.000Z"
    });

    const coldStart = performance.now();
    const first = await getGlobalReviewFirstCandidateLoadResult({}, database);
    const coldMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const second = await getGlobalReviewFirstCandidateLoadResult({}, database);
    const warmMs = performance.now() - warmStart;

    console.info(
      `[review-first-candidate-cache] cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms`
    );

    expect(first.kind).toBe("ready");
    expect(second.kind).toBe("ready");
    expect(second).toEqual(first);
    expect(warmMs).toBeLessThanOrEqual(coldMs);

    const cacheKey = JSON.stringify([
      "review",
      "global-first-candidate",
      "answered:0",
      "extra-new:0",
      "notice:",
      "selected:",
      "show:0"
    ]);

    expect(unstableCacheMock).toHaveBeenCalled();
    expect(cacheStore.has(cacheKey)).toBe(true);
    expect(cacheStore.size).toBeGreaterThan(0);

    const cacheHits = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === cacheKey
    );
    expect(cacheHits).toHaveLength(2);

    revalidateReviewSummaryCache("media_a");
    revalidateGlossarySummaryCache("media_a");
    revalidateSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(
      REVIEW_FIRST_CANDIDATE_TAG,
      "max"
    );
  });
});

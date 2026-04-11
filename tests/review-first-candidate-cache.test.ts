import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cacheStore, revalidateTagMock, unstableCacheMock } = vi.hoisted(() => {
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
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: revalidateTagMock,
  unstable_cache: unstableCacheMock
}));

vi.mock("@/lib/data-cache", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/data-cache")>(
      "@/lib/data-cache"
    );

  return {
    ...actual,
    canUseDataCache: vi.fn(() => true)
  };
});

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  revalidateGlossarySummaryCache,
  revalidateReviewSummaryCache,
  revalidateSettingsCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import {
  getGlobalReviewFirstCandidateLoadResult,
  hydrateReviewCard
} from "@/lib/review";
import { seedSingleReviewCardFixture } from "./helpers/review-fixture";

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

  it("reuses the cached snapshot across UTC midnight when the local day has not changed", async () => {
    await seedSingleReviewCardFixture(database);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-10T23:30:00.000Z"));
      const first = await getGlobalReviewFirstCandidateLoadResult({}, database);

      vi.setSystemTime(new Date("2026-03-11T00:15:00.000Z"));
      const second = await getGlobalReviewFirstCandidateLoadResult(
        {},
        database
      );

      expect(first.kind).toBe("ready");
      expect(second.kind).toBe("ready");
      expect(second).toEqual(first);

      const sharedCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        "day:2026-03-11",
        "answered:0",
        "extra-new:0",
        "notice:",
        "segment:",
        "selected:",
        "show:0",
        "fsrs:none|none|none"
      ]);

      expect(unstableCacheMock).toHaveBeenCalled();
      expect(cacheStore.has(sharedCacheKey)).toBe(true);

      const cacheHits = unstableCacheMock.mock.calls.filter(
        ([, keyParts]) => JSON.stringify(keyParts) === sharedCacheKey
      );
      expect(cacheHits).toHaveLength(2);

      revalidateReviewSummaryCache("media_a");
      revalidateGlossarySummaryCache("media_a");
      revalidateSettingsCache();

      expect(revalidateTagMock).toHaveBeenCalledWith(
        REVIEW_FIRST_CANDIDATE_TAG,
        "max"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("reuses the cached hydrated review card for repeated loads", async () => {
    await seedSingleReviewCardFixture(database);

    const coldStart = performance.now();
    const first = await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    const coldMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const second = await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    const warmMs = performance.now() - warmStart;

    console.info(
      `[review-card-hydration-cache] cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms`
    );

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(warmMs).toBeLessThanOrEqual(coldMs);

    const cacheKey = JSON.stringify([
      "review",
      "hydrated-card",
      "card_a",
      "none|none|none"
    ]);

    expect(unstableCacheMock).toHaveBeenCalled();
    expect(cacheStore.has(cacheKey)).toBe(true);

    revalidateReviewSummaryCache("media_a");
    revalidateGlossarySummaryCache("media_a");

    expect(revalidateTagMock).toHaveBeenCalledWith(
      REVIEW_FIRST_CANDIDATE_TAG,
      "max"
    );
  });
});

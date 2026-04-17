import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cacheStore, unstableCacheMock } = vi.hoisted(() => {
  const cacheStore = new Map<string, Promise<unknown>>();
  const unstableCacheMock = vi.fn(
    (
      loader: () => Promise<unknown>,
      keyParts: string[],
      options?: { tags?: string[] }
    ) => {
      void options;
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
    unstableCacheMock
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import * as dataCache from "@/lib/data-cache";
import { getDashboardData } from "@/lib/dashboard";
import { getMediaDetailData } from "@/lib/media-shell";
import { getMediaProgressPageData } from "@/lib/progress";

describe("app shell day-scoped cache keys", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    cacheStore.clear();
    unstableCacheMock.mockClear();

    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-app-shell-cache-day-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    vi.useRealTimers();
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("rotates only the day-sensitive app shell caches when the local day changes", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-03-10T21:30:00.000Z"));
    await getDashboardData(database);
    await getMediaDetailData(developmentFixture.mediaSlug, database);
    await getMediaDetailData(developmentFixture.mediaSlug, database, {
      includeReviewCounts: false
    });
    await getMediaProgressPageData(developmentFixture.mediaSlug, database);

    vi.setSystemTime(new Date("2026-03-10T23:15:00.000Z"));
    await getDashboardData(database);
    await getMediaDetailData(developmentFixture.mediaSlug, database);
    await getMediaProgressPageData(developmentFixture.mediaSlug, database);

    expect(
      cacheStore.has(
        JSON.stringify(["app-shell", "dashboard", "day:2026-03-10"])
      )
    ).toBe(true);
    expect(
      cacheStore.has(
        JSON.stringify(["app-shell", "dashboard", "day:2026-03-11"])
      )
    ).toBe(true);
    expect(
      cacheStore.has(
        JSON.stringify([
          "app-shell",
          "media-detail",
          developmentFixture.mediaSlug,
          "full",
          "day:2026-03-10"
        ])
      )
    ).toBe(true);
    expect(
      cacheStore.has(
        JSON.stringify([
          "app-shell",
          "media-detail",
          developmentFixture.mediaSlug,
          "full",
          "day:2026-03-11"
        ])
      )
    ).toBe(true);
    expect(
      cacheStore.has(
        JSON.stringify([
          "progress",
          "media-page",
          developmentFixture.mediaId,
          "day:2026-03-10"
        ])
      )
    ).toBe(true);
    expect(
      cacheStore.has(
        JSON.stringify([
          "progress",
          "media-page",
          developmentFixture.mediaId,
          "day:2026-03-11"
        ])
      )
    ).toBe(true);

    const studyOnlyKey = JSON.stringify([
      "app-shell",
      "media-detail",
      developmentFixture.mediaSlug,
      "study-only"
    ]);
    const progressSummaryKey = JSON.stringify([
      "app-shell",
      "glossary-progress-summary",
      `media:${developmentFixture.mediaId}:${developmentFixture.mediaSlug}`
    ]);
    const dashboardPreviewKey = JSON.stringify([
      "app-shell",
      "glossary-progress-preview",
      "limit:1",
      `media:${developmentFixture.mediaId}:${developmentFixture.mediaSlug}`
    ]);
    const detailPreviewKey = JSON.stringify([
      "app-shell",
      "glossary-progress-preview",
      "limit:4",
      `media:${developmentFixture.mediaId}:${developmentFixture.mediaSlug}`
    ]);

    const studyOnlyCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === studyOnlyKey
    );
    const summaryCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === progressSummaryKey
    );
    const previewCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) =>
        JSON.stringify(keyParts) === detailPreviewKey ||
        JSON.stringify(keyParts) === dashboardPreviewKey
    );

    expect(studyOnlyCalls.length).toBeGreaterThan(0);
    expect(cacheStore.has(studyOnlyKey)).toBe(true);
    expect(studyOnlyCalls[0]?.[2]?.tags).toEqual(
      expect.arrayContaining([
        `${dataCache.GLOSSARY_SUMMARY_TAG}:${developmentFixture.mediaId}`,
        dataCache.REVIEW_SUMMARY_TAG,
        `${dataCache.REVIEW_SUMMARY_TAG}:${developmentFixture.mediaId}`
      ])
    );
    expect(summaryCalls.length).toBeGreaterThan(0);
    expect(summaryCalls[0]?.[2]?.tags).toEqual(
      expect.arrayContaining([
        `${dataCache.GLOSSARY_SUMMARY_TAG}:${developmentFixture.mediaId}`,
        dataCache.REVIEW_SUMMARY_TAG,
        `${dataCache.REVIEW_SUMMARY_TAG}:${developmentFixture.mediaId}`
      ])
    );
    expect(cacheStore.has(dashboardPreviewKey)).toBe(true);
    expect(cacheStore.has(detailPreviewKey)).toBe(true);
    expect(previewCalls.length).toBeGreaterThan(0);
    expect(previewCalls[0]?.[2]?.tags).toEqual(
      expect.arrayContaining([
        `${dataCache.GLOSSARY_SUMMARY_TAG}:${developmentFixture.mediaId}`,
        dataCache.REVIEW_SUMMARY_TAG,
        `${dataCache.REVIEW_SUMMARY_TAG}:${developmentFixture.mediaId}`
      ])
    );
  });

  it("avoids loading the full media list on cache-enabled progress loads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T21:30:00.000Z"));

    const listMediaCachedSpy = vi.spyOn(dataCache, "listMediaCached");

    await getMediaProgressPageData(developmentFixture.mediaSlug, database);
    await getMediaProgressPageData(developmentFixture.mediaSlug, database);

    expect(listMediaCachedSpy).not.toHaveBeenCalled();

    listMediaCachedSpy.mockRestore();
  });

  it("lets the progress page warm the same preview-bearing study shell used by the media detail page", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T21:30:00.000Z"));

    await getMediaProgressPageData(developmentFixture.mediaSlug, database);

    const progressStudyOnlyKey = JSON.stringify([
      "app-shell",
      "media-detail",
      developmentFixture.mediaSlug,
      "study-only"
    ]);
    const detailPreviewKey = JSON.stringify([
      "app-shell",
      "glossary-progress-preview",
      "limit:4",
      `media:${developmentFixture.mediaId}:${developmentFixture.mediaSlug}`
    ]);

    expect(cacheStore.has(progressStudyOnlyKey)).toBe(true);
    expect(cacheStore.has(detailPreviewKey)).toBe(true);

    await getMediaDetailData(developmentFixture.mediaSlug, database, {
      includeReviewCounts: false
    });

    expect(cacheStore.has(progressStudyOnlyKey)).toBe(true);
    expect(cacheStore.has(detailPreviewKey)).toBe(true);
  });
});

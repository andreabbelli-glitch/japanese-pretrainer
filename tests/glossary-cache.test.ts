import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cacheStore, revalidateTagMock, unstableCacheMock } = vi.hoisted(() => {
  const cacheStore = new Map<string, Promise<unknown>>();
  const revalidateTagMock = vi.fn();
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
  seedDevelopmentDatabase,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  GLOSSARY_SUMMARY_TAG,
  revalidateGlossarySummaryCache
} from "@/lib/data-cache";
import {
  getGlobalGlossaryAutocompleteData,
  getGlobalGlossaryPageData,
  getGlossaryPageData
} from "@/lib/glossary";

describe("global glossary cache", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    cacheStore.clear();
    revalidateTagMock.mockClear();
    unstableCacheMock.mockClear();

    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-glossary-cache-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("caches global glossary search pages across equivalent query casing and spacing", async () => {
    const first = await getGlobalGlossaryPageData(
      {
        q: "IKU"
      },
      database
    );
    const second = await getGlobalGlossaryPageData(
      {
        q: "iku"
      },
      database
    );

    expect(first.results).not.toHaveLength(0);
    expect(second.results).toEqual(first.results);
    expect(second.pagination).toEqual(first.pagination);
    expect(second.stats).toEqual(first.stats);
    expect(second.hasActiveFilters).toBe(first.hasActiveFilters);
    const { query: firstQuery, ...firstFilters } = first.filters;
    const { query: secondQuery, ...secondFilters } = second.filters;
    expect(secondFilters).toEqual(firstFilters);
    expect(first.filters.query).toBe("IKU");
    expect(second.filters.query).toBe("iku");
    expect(firstQuery).toBe("IKU");
    expect(secondQuery).toBe("iku");
    expect(first.resultSummary.queryLabel).toBe("IKU");
    expect(second.resultSummary.queryLabel).toBe("iku");

    const cacheKey = JSON.stringify([
      "glossary",
      "search-page",
      "cards:all",
      "media:all",
      "page:1",
      "query:iku",
      "kana:iku",
      "grammar-kana:iku",
      "compact:iku",
      "sort:lesson_order",
      "study:all",
      "type:all"
    ]);

    const keySpecificCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === cacheKey
    );
    expect(keySpecificCalls).toHaveLength(2);
    expect(cacheStore.has(cacheKey)).toBe(true);

    const cacheOptions = keySpecificCalls[0]?.[2];
    expect(cacheOptions?.tags).toEqual(
      expect.arrayContaining([GLOSSARY_SUMMARY_TAG])
    );

    revalidateGlossarySummaryCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(GLOSSARY_SUMMARY_TAG, "max");
  });

  it("caches global glossary autocomplete across equivalent query casing and spacing", async () => {
    const first = await getGlobalGlossaryAutocompleteData(
      {
        q: "  IKU  "
      },
      database
    );
    const second = await getGlobalGlossaryAutocompleteData(
      {
        q: "iku"
      },
      database
    );

    expect(first).not.toHaveLength(0);
    expect(second).toEqual(first);

    const cacheKey = JSON.stringify([
      "glossary",
      "autocomplete",
      "cards:all",
      "media:all",
      "query:iku",
      "kana:iku",
      "grammar-kana:iku",
      "compact:iku",
      "study:all",
      "type:all"
    ]);

    const keySpecificCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === cacheKey
    );
    expect(keySpecificCalls).toHaveLength(2);
    expect(cacheStore.has(cacheKey)).toBe(true);
  });

  it("reuses the normalized global glossary search caches across autocomplete and results pages", async () => {
    await getGlobalGlossaryAutocompleteData(
      {
        q: "  IKU  "
      },
      database
    );
    await getGlobalGlossaryPageData(
      {
        q: "iku",
        media: "all"
      },
      database
    );

    const sharedCacheKey = JSON.stringify([
      "glossary",
      "search-entries",
      "query:iku",
      "kana:iku",
      "grammar-kana:iku",
      "compact:iku",
      "type:all"
    ]);

    const keySpecificCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === sharedCacheKey
    );
    expect(keySpecificCalls).toHaveLength(1);
    expect(cacheStore.has(sharedCacheKey)).toBe(true);

    const sharedResolvedCacheKey = JSON.stringify([
      "glossary",
      "search-resolved",
      "cards:all",
      "media:all",
      "query:iku",
      "kana:iku",
      "grammar-kana:iku",
      "compact:iku",
      "study:all",
      "type:all"
    ]);

    const resolvedKeySpecificCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === sharedResolvedCacheKey
    );
    expect(resolvedKeySpecificCalls).toHaveLength(2);
    expect(cacheStore.has(sharedResolvedCacheKey)).toBe(true);
  });

  it("caches local glossary base entries across repeated searches for the same media", async () => {
    const first = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        q: "IKU"
      },
      database
    );
    const second = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {
        q: "iku"
      },
      database
    );

    expect(first?.results).not.toHaveLength(0);
    expect(second?.results).toEqual(first?.results);
    expect(second?.stats).toEqual(first?.stats);

    const localBaseEntriesCacheKey = JSON.stringify([
      "glossary",
      "local-base-entries",
      `media:${developmentFixture.mediaId}:${developmentFixture.mediaSlug}`,
      "mode:search",
      "type:all"
    ]);

    const localBaseEntryCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === localBaseEntriesCacheKey
    );

    expect(localBaseEntryCalls).toHaveLength(2);
    expect(cacheStore.has(localBaseEntriesCacheKey)).toBe(true);

    const localBaseEntriesOptions = localBaseEntryCalls[0]?.[2];
    expect(localBaseEntriesOptions?.tags).toEqual(
      expect.arrayContaining([
        `${GLOSSARY_SUMMARY_TAG}:${developmentFixture.mediaId}`
      ])
    );
  });
});

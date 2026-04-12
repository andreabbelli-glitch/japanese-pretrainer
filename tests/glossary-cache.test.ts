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
  getGlobalGlossaryPageData
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
        q: "  IKU  "
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
    expect(second).toEqual(first);

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
});

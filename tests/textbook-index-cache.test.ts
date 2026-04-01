import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cacheStore, noStoreMock, revalidateTagMock, unstableCacheMock } =
  vi.hoisted(() => {
    const cacheStore = new Map<string, Promise<unknown>>();
    const noStoreMock = vi.fn();
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
      noStoreMock,
      revalidateTagMock,
      unstableCacheMock
    };
  });

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: revalidateTagMock,
  unstable_cache: unstableCacheMock,
  unstable_noStore: noStoreMock
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
import {
  MEDIA_LIST_TAG,
  revalidateMediaListCache,
  revalidateSettingsCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import { getTextbookIndexData } from "@/lib/textbook";

describe("textbook index cache", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    cacheStore.clear();
    noStoreMock.mockClear();
    revalidateTagMock.mockClear();
    unstableCacheMock.mockClear();

    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-textbook-index-cache-"));
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

  it("caches the textbook index by media and wires the expected invalidation tags", async () => {
    const cacheKey = JSON.stringify([
      "textbook",
      "index",
      developmentFixture.mediaSlug,
      "furigana:hover"
    ]);

    const coldStart = performance.now();
    const first = await getTextbookIndexData(
      developmentFixture.mediaSlug,
      database
    );
    const coldMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const second = await getTextbookIndexData(
      developmentFixture.mediaSlug,
      database
    );
    const warmMs = performance.now() - warmStart;

    console.info(
      `[textbook-index-cache] cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms`
    );

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(noStoreMock).not.toHaveBeenCalled();

    const keySpecificCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === cacheKey
    );
    expect(keySpecificCalls).toHaveLength(2);
    expect(cacheStore.has(cacheKey)).toBe(true);

    const cacheOptions = keySpecificCalls[0]?.[2];
    expect(cacheOptions?.tags).toEqual(
      expect.arrayContaining([MEDIA_LIST_TAG, SETTINGS_TAG])
    );

    revalidateMediaListCache();
    revalidateSettingsCache();

    expect(revalidateTagMock).toHaveBeenCalledWith(MEDIA_LIST_TAG, "max");
    expect(revalidateTagMock).toHaveBeenCalledWith(SETTINGS_TAG, "max");
  });
});

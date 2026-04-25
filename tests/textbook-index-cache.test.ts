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
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import {
  MEDIA_LIST_TAG,
  revalidateMediaListCache,
  revalidateSettingsCache,
  SETTINGS_TAG,
  TEXTBOOK_LESSON_BODY_TAG
} from "@/lib/data-cache";
import {
  getTextbookIndexData,
  getTextbookLessonData,
  getTextbookLessonTooltipEntries
} from "@/lib/textbook";

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}
async function waitForTruthy(
  predicate: () => boolean,
  message: string,
  attempts = 50
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(message);
}

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

  it("skips the media lookup entirely on a warm textbook index cache hit", async () => {
    await getTextbookIndexData(developmentFixture.mediaSlug, database);

    const dataCacheModule = await import("@/lib/data-cache");
    const resolvedMedia = await dataCacheModule.getMediaBySlugCached(
      database,
      developmentFixture.mediaSlug
    );
    const mediaLookupDeferred = createDeferred<typeof resolvedMedia>();
    let cacheHitResolved = false;
    const mediaLookupSpy = vi
      .spyOn(dataCacheModule, "getMediaBySlugCached")
      .mockImplementation(async () => mediaLookupDeferred.promise);

    const cachedResultPromise = getTextbookIndexData(
      developmentFixture.mediaSlug,
      database
    ).then((result) => {
      cacheHitResolved = true;
      return result;
    });

    try {
      await waitForTruthy(
        () => cacheHitResolved,
        "Expected the warm textbook index cache hit to resolve."
      );

      expect(mediaLookupSpy).not.toHaveBeenCalled();
    } finally {
      mediaLookupDeferred.resolve(resolvedMedia);
      await cachedResultPromise;
      mediaLookupSpy.mockRestore();
    }
  });

  it("serves a warm textbook tooltip cache hit without waiting for the media lookup", async () => {
    await getTextbookLessonTooltipEntries(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    const dataCacheModule = await import("@/lib/data-cache");
    const resolvedMedia = await dataCacheModule.getMediaBySlugCached(
      database,
      developmentFixture.mediaSlug
    );
    const mediaLookupDeferred = createDeferred<typeof resolvedMedia>();
    let cacheHitResolved = false;
    const mediaLookupSpy = vi
      .spyOn(dataCacheModule, "getMediaBySlugCached")
      .mockImplementation(async () => mediaLookupDeferred.promise);

    const cachedResultPromise = getTextbookLessonTooltipEntries(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    ).then((result) => {
      cacheHitResolved = true;
      return result;
    });

    try {
      await waitForTruthy(
        () => cacheHitResolved,
        "Expected the warm textbook tooltip cache hit to resolve."
      );

      expect(mediaLookupSpy).not.toHaveBeenCalled();
    } finally {
      mediaLookupDeferred.resolve(resolvedMedia);
      await cachedResultPromise;
      mediaLookupSpy.mockRestore();
    }
  });

  it("reuses the cached lesson body while keeping the lesson page live", async () => {
    const cacheKey = JSON.stringify([
      "textbook",
      "lesson-body",
      developmentFixture.mediaSlug,
      "core-vocab"
    ]);

    const first = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );
    const second = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(noStoreMock).toHaveBeenCalledTimes(2);

    const keySpecificCalls = unstableCacheMock.mock.calls.filter(
      ([, keyParts]) => JSON.stringify(keyParts) === cacheKey
    );
    expect(keySpecificCalls).toHaveLength(2);
    expect(cacheStore.has(cacheKey)).toBe(true);

    const cacheOptions = keySpecificCalls[0]?.[2];
    expect(cacheOptions?.tags).toEqual(
      expect.arrayContaining([MEDIA_LIST_TAG, TEXTBOOK_LESSON_BODY_TAG])
    );
  });
});

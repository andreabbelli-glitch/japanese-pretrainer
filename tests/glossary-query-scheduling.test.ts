import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("glossary query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/settings");
  });

  it("starts the global browse query as soon as the default sort is ready", async () => {
    const defaultSortDeferred = createDeferred<"lesson_order" | "alphabetical">();
    const mediaRowsDeferred = createDeferred<
      Array<{
        id: string;
        slug: string;
        title: string;
      }>
    >();
    const aggregateStatsDeferred = createDeferred<{
      crossMediaCount: number;
      entryCount: number;
      withCardsCount: number;
    }>();
    const browseRefsDeferred = createDeferred<
      Array<{
        resultKey: string;
        totalCount: number;
      }>
    >();
    let mediaStarted = false;
    let aggregateStarted = false;
    let browseStarted = false;

    vi.doMock("@/db", async () => {
      const actual = await vi.importActual<typeof import("@/db")>("@/db");

      return {
        ...actual,
        countGlobalGlossaryBrowseGroups: vi.fn(),
        getGlobalGlossaryAggregateStats: vi.fn(() => {
          aggregateStarted = true;
          return aggregateStatsDeferred.promise;
        }),
        listGlobalGlossaryBrowseGroupRefs: vi.fn(() => {
          browseStarted = true;
          return browseRefsDeferred.promise;
        })
      };
    });
    vi.doMock("@/lib/data-cache", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/data-cache")>(
          "@/lib/data-cache"
        );

      return {
        ...actual,
        canUseDataCache: vi.fn(() => false),
        listMediaCached: vi.fn(() => {
          mediaStarted = true;
          return mediaRowsDeferred.promise;
        }),
        runWithTaggedCache: vi.fn(async ({ loader }) => loader())
      };
    });
    vi.doMock("@/lib/settings", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/settings")>(
          "@/lib/settings"
        );

      return {
        ...actual,
        getGlossaryDefaultSort: vi.fn(() => defaultSortDeferred.promise)
      };
    });

    const { loadGlobalGlossaryPageData } = await import("@/lib/glossary-loaders");
    const glossaryPromise = loadGlobalGlossaryPageData({}, {} as never);

    await flushMicrotasks();

    expect(mediaStarted).toBe(true);
    expect(aggregateStarted).toBe(true);
    expect(browseStarted).toBe(false);

    defaultSortDeferred.resolve("lesson_order");
    await flushMicrotasks();

    expect(browseStarted).toBe(true);

    browseRefsDeferred.resolve([]);
    mediaRowsDeferred.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    aggregateStatsDeferred.resolve({
      crossMediaCount: 0,
      entryCount: 12,
      withCardsCount: 7
    });

    const data = await glossaryPromise;

    expect(data.filters.sort).toBe("lesson_order");
    expect(data.mediaOptions).toEqual([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    expect(data.resultSummary.filtered).toBe(0);
    expect(data.resultSummary.total).toBe(12);
    expect(data.results).toEqual([]);
  });

  it("starts the global browse query before the default sort settles when the URL already pins sort", async () => {
    const defaultSortDeferred = createDeferred<"lesson_order" | "alphabetical">();
    const mediaRowsDeferred = createDeferred<
      Array<{
        id: string;
        slug: string;
        title: string;
      }>
    >();
    const aggregateStatsDeferred = createDeferred<{
      crossMediaCount: number;
      entryCount: number;
      withCardsCount: number;
    }>();
    const browseRefsDeferred = createDeferred<
      Array<{
        resultKey: string;
        totalCount: number;
      }>
    >();
    let browseStarted = false;

    vi.doMock("@/db", async () => {
      const actual = await vi.importActual<typeof import("@/db")>("@/db");

      return {
        ...actual,
        countGlobalGlossaryBrowseGroups: vi.fn(),
        getGlobalGlossaryAggregateStats: vi.fn(
          () => aggregateStatsDeferred.promise
        ),
        listGlobalGlossaryBrowseGroupRefs: vi.fn(() => {
          browseStarted = true;
          return browseRefsDeferred.promise;
        })
      };
    });
    vi.doMock("@/lib/data-cache", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/data-cache")>(
          "@/lib/data-cache"
        );

      return {
        ...actual,
        canUseDataCache: vi.fn(() => false),
        listMediaCached: vi.fn(() => mediaRowsDeferred.promise),
        runWithTaggedCache: vi.fn(async ({ loader }) => loader())
      };
    });
    vi.doMock("@/lib/settings", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/settings")>(
          "@/lib/settings"
        );

      return {
        ...actual,
        getGlossaryDefaultSort: vi.fn(() => defaultSortDeferred.promise)
      };
    });

    const { loadGlobalGlossaryPageData } = await import("@/lib/glossary-loaders");
    const glossaryPromise = loadGlobalGlossaryPageData(
      {
        sort: "alphabetical"
      },
      {} as never
    );

    await flushMicrotasks();

    expect(browseStarted).toBe(true);

    browseRefsDeferred.resolve([]);
    mediaRowsDeferred.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    aggregateStatsDeferred.resolve({
      crossMediaCount: 0,
      entryCount: 12,
      withCardsCount: 7
    });
    defaultSortDeferred.resolve("lesson_order");

    const data = await glossaryPromise;

    expect(data.filters.sort).toBe("alphabetical");
    expect(data.hasActiveFilters).toBe(true);
  });
});

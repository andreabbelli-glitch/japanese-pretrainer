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
    let defaultSortStarted = false;

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
        getGlossaryDefaultSort: vi.fn(() => {
          defaultSortStarted = true;
          return defaultSortDeferred.promise;
        })
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
    expect(defaultSortStarted).toBe(true);

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

  it("starts the local browse query before the default sort settles when the URL already pins sort", async () => {
    const defaultSortDeferred = createDeferred<"lesson_order" | "alphabetical">();
    let localBrowseStarted = false;
    let defaultSortStarted = false;

    vi.doMock("@/db", async () => {
      const actual = await vi.importActual<typeof import("@/db")>("@/db");

      return {
        ...actual,
        listEntryCardCounts: vi.fn(() => Promise.resolve([])),
        listEntryLessonConnections: vi.fn(() => Promise.resolve([])),
        listEntryStudySignals: vi.fn(() => Promise.resolve([])),
        listGlossarySegmentsByMediaId: vi.fn(() => Promise.resolve([])),
        listGrammarEntrySummaries: vi.fn(() => Promise.resolve([])),
        listTermEntrySummaries: vi.fn(() => {
          localBrowseStarted = true;
          return Promise.resolve([]);
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
        getMediaBySlugCached: vi.fn(() =>
          Promise.resolve({
            description: "Fixture media",
            id: "media-1",
            mediaType: "game",
            segmentKind: "chapter",
            slug: "fixture-media",
            title: "Fixture Media"
          })
        ),
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
        getGlossaryDefaultSort: vi.fn(() => {
          defaultSortStarted = true;
          return defaultSortDeferred.promise;
        })
      };
    });

    const { loadGlossaryPageData } = await import("@/lib/glossary-loaders");
    const glossaryPromise = loadGlossaryPageData(
      "fixture-media",
      {
        sort: "alphabetical"
      },
      {} as never
    );

    await flushMicrotasks();

    expect(localBrowseStarted).toBe(true);
    expect(defaultSortStarted).toBe(true);

    defaultSortDeferred.resolve("lesson_order");

    const data = await glossaryPromise;

    expect(data?.filters.sort).toBe("alphabetical");
    expect(data?.hasActiveFilters).toBe(true);
  });

  it("serves the global glossary without waiting for default sort when another filter is already active", async () => {
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
    let glossaryResolved = false;

    vi.doMock("@/db", async () => {
      const actual = await vi.importActual<typeof import("@/db")>("@/db");

      return {
        ...actual,
        countGlobalGlossaryBrowseGroups: vi.fn(),
        getGlobalGlossaryAggregateStats: vi.fn(
          () => aggregateStatsDeferred.promise
        ),
        listGlobalGlossaryBrowseGroupRefs: vi.fn(() => browseRefsDeferred.promise)
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
        media: "fixture-media",
        sort: "alphabetical"
      },
      {} as never
    ).then((data) => {
      glossaryResolved = true;
      return data;
    });

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

    try {
      await waitForTruthy(
        () => glossaryResolved,
        "Expected the global glossary response to resolve without the default sort lookup."
      );

      const data = await glossaryPromise;

      expect(data.filters.sort).toBe("alphabetical");
      expect(data.hasActiveFilters).toBe(true);
    } finally {
      defaultSortDeferred.resolve("lesson_order");
      await glossaryPromise;
    }
  });

  it("serves the local glossary without waiting for default sort when another filter is already active", async () => {
    const defaultSortDeferred = createDeferred<"lesson_order" | "alphabetical">();
    let glossaryResolved = false;

    vi.doMock("@/db", async () => {
      const actual = await vi.importActual<typeof import("@/db")>("@/db");

      return {
        ...actual,
        listEntryCardCounts: vi.fn(() => Promise.resolve([])),
        listEntryLessonConnections: vi.fn(() => Promise.resolve([])),
        listEntryStudySignals: vi.fn(() => Promise.resolve([])),
        listGlossarySegmentsByMediaId: vi.fn(() => Promise.resolve([])),
        listGrammarEntrySummaries: vi.fn(() => Promise.resolve([])),
        listTermEntrySummaries: vi.fn(() => Promise.resolve([]))
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
        getMediaBySlugCached: vi.fn(() =>
          Promise.resolve({
            description: "Fixture media",
            id: "media-1",
            mediaType: "game",
            segmentKind: "chapter",
            slug: "fixture-media",
            title: "Fixture Media"
          })
        ),
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

    const { loadGlossaryPageData } = await import("@/lib/glossary-loaders");
    const glossaryPromise = loadGlossaryPageData(
      "fixture-media",
      {
        sort: "alphabetical",
        type: "term"
      },
      {} as never
    ).then((data) => {
      glossaryResolved = true;
      return data;
    });

    try {
      await waitForTruthy(
        () => glossaryResolved,
        "Expected the local glossary response to resolve without the default sort lookup."
      );

      const data = await glossaryPromise;

      expect(data?.filters.sort).toBe("alphabetical");
      expect(data?.hasActiveFilters).toBe(true);
    } finally {
      defaultSortDeferred.resolve("lesson_order");
      await glossaryPromise;
    }
  });
});

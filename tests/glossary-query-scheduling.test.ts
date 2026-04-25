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

function mockGlossaryDb(overrides: Record<string, unknown>) {
  vi.doMock("@/db", () => ({
    db: {}
  }));
  vi.doMock("@/db/queries", () => ({
    countGlobalGlossaryBrowseGroups: vi.fn(() => Promise.resolve(0)),
    getCrossMediaFamilyByEntryId: vi.fn(() => Promise.resolve(null)),
    getGlobalGlossaryAggregateStats: vi.fn(() =>
      Promise.resolve({
        crossMediaCount: 0,
        entryCount: 0,
        withCardsCount: 0
      })
    ),
    getGlossaryEntriesByCrossMediaGroupIds: vi.fn(() => Promise.resolve([])),
    getGlossaryEntriesByIds: vi.fn(() => Promise.resolve([])),
    getGlossaryEntryBySourceId: vi.fn(() => Promise.resolve(null)),
    listEntryCardConnections: vi.fn(() => Promise.resolve([])),
    listEntryCardCounts: vi.fn(() => Promise.resolve([])),
    listEntryLessonConnections: vi.fn(() => Promise.resolve([])),
    listEntryStudySignals: vi.fn(() => Promise.resolve([])),
    listGlobalGlossaryBrowseGroupRefs: vi.fn(() => Promise.resolve([])),
    listGlossaryEntriesByKind: vi.fn(() => Promise.resolve([])),
    listGlossarySearchCandidateRefs: vi.fn(() => Promise.resolve([])),
    listGlossarySegmentsByMediaId: vi.fn(() => Promise.resolve([])),
    listGrammarEntrySummaries: vi.fn(() => Promise.resolve([])),
    listTermEntrySummaries: vi.fn(() => Promise.resolve([])),
    ...overrides
  }));
}

function mockGlossaryDataCache(overrides: Record<string, unknown>) {
  vi.doMock("@/lib/data-cache", () => ({
    GLOSSARY_SUMMARY_TAG: "glossary-summary",
    MEDIA_LIST_TAG: "media-list",
    REVIEW_SUMMARY_TAG: "review-summary",
    buildGlossarySummaryTags: vi.fn(() => []),
    canUseDataCache: vi.fn(() => false),
    getMediaBySlugCached: vi.fn(),
    listMediaCached: vi.fn(),
    runWithTaggedCache: vi.fn(async ({ loader }) => loader()),
    ...overrides
  }));
}

function mockGlossarySettings(
  getGlossaryDefaultSort: () => Promise<"lesson_order" | "alphabetical">
) {
  vi.doMock("@/lib/settings", () => ({
    defaultStudySettings: {
      furiganaMode: "hover",
      glossaryDefaultSort: "lesson_order",
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global",
      kanjiClashManualDefaultSize: 20,
      reviewDailyLimit: 20,
      reviewFrontFurigana: true
    },
    getGlossaryDefaultSort: vi.fn(getGlossaryDefaultSort)
  }));
}

describe("glossary query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/settings");
  });

  it("starts the global browse query as soon as the default sort is ready", async () => {
    const defaultSortDeferred = createDeferred<
      "lesson_order" | "alphabetical"
    >();
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

    mockGlossaryDb({
      countGlobalGlossaryBrowseGroups: vi.fn(),
      getGlobalGlossaryAggregateStats: vi.fn(() => {
        aggregateStarted = true;
        return aggregateStatsDeferred.promise;
      }),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(() => {
        browseStarted = true;
        return browseRefsDeferred.promise;
      })
    });
    mockGlossaryDataCache({
      listMediaCached: vi.fn(() => {
        mediaStarted = true;
        return mediaRowsDeferred.promise;
      })
    });
    mockGlossarySettings(() => defaultSortDeferred.promise);

    const { loadGlobalGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
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
    const defaultSortDeferred = createDeferred<
      "lesson_order" | "alphabetical"
    >();
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

    mockGlossaryDb({
      countGlobalGlossaryBrowseGroups: vi.fn(),
      getGlobalGlossaryAggregateStats: vi.fn(
        () => aggregateStatsDeferred.promise
      ),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(() => {
        browseStarted = true;
        return browseRefsDeferred.promise;
      })
    });
    mockGlossaryDataCache({
      listMediaCached: vi.fn(() => mediaRowsDeferred.promise)
    });
    mockGlossarySettings(() => {
      defaultSortStarted = true;
      return defaultSortDeferred.promise;
    });

    const { loadGlobalGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
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
    const defaultSortDeferred = createDeferred<
      "lesson_order" | "alphabetical"
    >();
    let localBrowseStarted = false;
    let defaultSortStarted = false;

    mockGlossaryDb({
      listTermEntrySummaries: vi.fn(() => {
        localBrowseStarted = true;
        return Promise.resolve([]);
      })
    });
    mockGlossaryDataCache({
      getMediaBySlugCached: vi.fn(() =>
        Promise.resolve({
          description: "Fixture media",
          id: "media-1",
          mediaType: "game",
          segmentKind: "chapter",
          slug: "fixture-media",
          title: "Fixture Media"
        })
      )
    });
    mockGlossarySettings(() => {
      defaultSortStarted = true;
      return defaultSortDeferred.promise;
    });

    const { loadGlossaryPageData } = await import("@/features/glossary/server/loaders");
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
    const defaultSortDeferred = createDeferred<
      "lesson_order" | "alphabetical"
    >();
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

    mockGlossaryDb({
      countGlobalGlossaryBrowseGroups: vi.fn(),
      getGlobalGlossaryAggregateStats: vi.fn(
        () => aggregateStatsDeferred.promise
      ),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(() => browseRefsDeferred.promise)
    });
    mockGlossaryDataCache({
      listMediaCached: vi.fn(() => mediaRowsDeferred.promise)
    });
    mockGlossarySettings(() => defaultSortDeferred.promise);

    const { loadGlobalGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
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
    const defaultSortDeferred = createDeferred<
      "lesson_order" | "alphabetical"
    >();
    let glossaryResolved = false;

    mockGlossaryDb({});
    mockGlossaryDataCache({
      getMediaBySlugCached: vi.fn(() =>
        Promise.resolve({
          description: "Fixture media",
          id: "media-1",
          mediaType: "game",
          segmentKind: "chapter",
          slug: "fixture-media",
          title: "Fixture Media"
        })
      )
    });
    mockGlossarySettings(() => defaultSortDeferred.promise);

    const { loadGlossaryPageData } = await import("@/features/glossary/server/loaders");
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

  it("returns null for missing local media without waiting for default sort", async () => {
    const defaultSortDeferred = createDeferred<
      "lesson_order" | "alphabetical"
    >();
    const mediaDeferred = createDeferred<null>();
    let glossaryResolved = false;

    mockGlossaryDb({
      listEntryCardCounts: vi.fn(),
      listEntryLessonConnections: vi.fn(),
      listEntryStudySignals: vi.fn(),
      listGlossarySegmentsByMediaId: vi.fn(),
      listGrammarEntrySummaries: vi.fn(),
      listTermEntrySummaries: vi.fn()
    });
    mockGlossaryDataCache({
      getMediaBySlugCached: vi.fn(() => mediaDeferred.promise)
    });
    mockGlossarySettings(() => defaultSortDeferred.promise);

    const { loadGlossaryPageData } = await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlossaryPageData(
      "missing-media",
      {},
      {} as never
    ).then((data) => {
      glossaryResolved = true;
      return data;
    });

    mediaDeferred.resolve(null);

    try {
      await waitForTruthy(
        () => glossaryResolved,
        "Expected the local glossary response to resolve without the default sort lookup."
      );

      await expect(glossaryPromise).resolves.toBeNull();
    } finally {
      defaultSortDeferred.resolve("lesson_order");
      await glossaryPromise;
    }
  });
});

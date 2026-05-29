import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

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
  vi.doMock("@/features/cache/server/data-cache", () => ({
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
  vi.doMock("@/features/settings/server", () => ({
    defaultStudySettings: {
      furiganaMode: "hover",
      glossaryDefaultSort: "lesson_order",
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global",
      kanjiClashManualDefaultSize: 20,
      reviewDailyLimit: 20,
      reviewAutoplayAudioOnReveal: true,
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
    vi.doUnmock("@/features/cache/server/data-cache");
    vi.doUnmock("@/features/settings/server");
  });

  it("starts the global browse query as soon as the default sort is ready", async () => {
    const schedule = createQuerySchedulingHarness();
    const defaultSortGate =
      schedule.gate<"lesson_order" | "alphabetical">("default sort");
    const mediaRowsGate = schedule.gate<
      Array<{
        id: string;
        slug: string;
        title: string;
      }>
    >("media rows");
    const aggregateStatsGate = schedule.gate<{
      crossMediaCount: number;
      entryCount: number;
      withCardsCount: number;
    }>("aggregate stats");
    const browseRefsGate = schedule.gate<
      Array<{
        resultKey: string;
        totalCount: number;
      }>
    >("browse refs");

    mockGlossaryDb({
      countGlobalGlossaryBrowseGroups: vi.fn(),
      getGlobalGlossaryAggregateStats: vi.fn(aggregateStatsGate.loader()),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(browseRefsGate.loader())
    });
    mockGlossaryDataCache({
      listMediaCached: vi.fn(mediaRowsGate.loader())
    });
    mockGlossarySettings(defaultSortGate.loader());

    const { loadGlobalGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlobalGlossaryPageData({}, {} as never);

    await schedule.expectStarted("media rows", "aggregate stats");
    schedule.expectNotStarted("browse refs");

    defaultSortGate.resolve("lesson_order");
    await schedule.expectStarted("browse refs");

    browseRefsGate.resolve([]);
    mediaRowsGate.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    aggregateStatsGate.resolve({
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
    const schedule = createQuerySchedulingHarness();
    const defaultSortGate =
      schedule.gate<"lesson_order" | "alphabetical">("default sort");
    const mediaRowsGate = schedule.gate<
      Array<{
        id: string;
        slug: string;
        title: string;
      }>
    >("media rows");
    const aggregateStatsGate = schedule.gate<{
      crossMediaCount: number;
      entryCount: number;
      withCardsCount: number;
    }>("aggregate stats");
    const browseRefsGate = schedule.gate<
      Array<{
        resultKey: string;
        totalCount: number;
      }>
    >("browse refs");

    mockGlossaryDb({
      countGlobalGlossaryBrowseGroups: vi.fn(),
      getGlobalGlossaryAggregateStats: vi.fn(aggregateStatsGate.loader()),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(browseRefsGate.loader())
    });
    mockGlossaryDataCache({
      listMediaCached: vi.fn(mediaRowsGate.loader())
    });
    mockGlossarySettings(defaultSortGate.loader());

    const { loadGlobalGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlobalGlossaryPageData(
      {
        sort: "alphabetical"
      },
      {} as never
    );

    await schedule.expectStarted("browse refs", "default sort");
    schedule.expectNotSettled("default sort");

    browseRefsGate.resolve([]);
    mediaRowsGate.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    aggregateStatsGate.resolve({
      crossMediaCount: 0,
      entryCount: 12,
      withCardsCount: 7
    });
    defaultSortGate.resolve("lesson_order");

    const data = await glossaryPromise;

    expect(data.filters.sort).toBe("alphabetical");
    expect(data.hasActiveFilters).toBe(true);
  });

  it("starts the local browse query before the default sort settles when the URL already pins sort", async () => {
    const schedule = createQuerySchedulingHarness();
    const defaultSortGate =
      schedule.gate<"lesson_order" | "alphabetical">("default sort");
    const localBrowseGate = schedule.gate("local browse");

    mockGlossaryDb({
      listTermEntrySummaries: vi.fn(async () => {
        await localBrowseGate.loader()();
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
    mockGlossarySettings(defaultSortGate.loader());

    const { loadGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlossaryPageData(
      "fixture-media",
      {
        sort: "alphabetical"
      },
      {} as never
    );

    await schedule.expectStarted("local browse", "default sort");
    schedule.expectNotSettled("default sort");

    defaultSortGate.resolve("lesson_order");
    localBrowseGate.resolve();

    const data = await glossaryPromise;

    expect(data?.filters.sort).toBe("alphabetical");
    expect(data?.hasActiveFilters).toBe(true);
  });

  it("serves the global glossary without waiting for default sort when another filter is already active", async () => {
    const schedule = createQuerySchedulingHarness();
    const defaultSortGate =
      schedule.gate<"lesson_order" | "alphabetical">("default sort");
    const mediaRowsGate = schedule.gate<
      Array<{
        id: string;
        slug: string;
        title: string;
      }>
    >("media rows");
    const aggregateStatsGate = schedule.gate<{
      crossMediaCount: number;
      entryCount: number;
      withCardsCount: number;
    }>("aggregate stats");
    const browseRefsGate = schedule.gate<
      Array<{
        resultKey: string;
        totalCount: number;
      }>
    >("browse refs");

    mockGlossaryDb({
      countGlobalGlossaryBrowseGroups: vi.fn(),
      getGlobalGlossaryAggregateStats: vi.fn(aggregateStatsGate.loader()),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(browseRefsGate.loader())
    });
    mockGlossaryDataCache({
      listMediaCached: vi.fn(mediaRowsGate.loader())
    });
    mockGlossarySettings(defaultSortGate.loader());

    const { loadGlobalGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlobalGlossaryPageData(
      {
        media: "fixture-media",
        sort: "alphabetical"
      },
      {} as never
    );

    browseRefsGate.resolve([]);
    mediaRowsGate.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    aggregateStatsGate.resolve({
      crossMediaCount: 0,
      entryCount: 12,
      withCardsCount: 7
    });

    try {
      const data = await schedule.expectResolvesWhileBlocked(
        glossaryPromise,
        "default sort",
        "Expected the global glossary response to resolve without the default sort lookup."
      );

      expect(data.filters.sort).toBe("alphabetical");
      expect(data.hasActiveFilters).toBe(true);
    } finally {
      defaultSortGate.resolve("lesson_order");
      await glossaryPromise;
    }
  });

  it("serves the local glossary without waiting for default sort when another filter is already active", async () => {
    const schedule = createQuerySchedulingHarness();
    const defaultSortGate =
      schedule.gate<"lesson_order" | "alphabetical">("default sort");

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
    mockGlossarySettings(defaultSortGate.loader());

    const { loadGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlossaryPageData(
      "fixture-media",
      {
        sort: "alphabetical",
        type: "term"
      },
      {} as never
    );

    try {
      const data = await schedule.expectResolvesWhileBlocked(
        glossaryPromise,
        "default sort",
        "Expected the local glossary response to resolve without the default sort lookup."
      );

      expect(data?.filters.sort).toBe("alphabetical");
      expect(data?.hasActiveFilters).toBe(true);
    } finally {
      defaultSortGate.resolve("lesson_order");
      await glossaryPromise;
    }
  });

  it("returns null for missing local media without waiting for default sort", async () => {
    const schedule = createQuerySchedulingHarness();
    const defaultSortGate =
      schedule.gate<"lesson_order" | "alphabetical">("default sort");
    const mediaGate = schedule.gate<null>("media");

    mockGlossaryDb({
      listEntryCardCounts: vi.fn(),
      listEntryLessonConnections: vi.fn(),
      listEntryStudySignals: vi.fn(),
      listGlossarySegmentsByMediaId: vi.fn(),
      listGrammarEntrySummaries: vi.fn(),
      listTermEntrySummaries: vi.fn()
    });
    mockGlossaryDataCache({
      getMediaBySlugCached: vi.fn(mediaGate.loader())
    });
    mockGlossarySettings(defaultSortGate.loader());

    const { loadGlossaryPageData } =
      await import("@/features/glossary/server/loaders");
    const glossaryPromise = loadGlossaryPageData(
      "missing-media",
      {},
      {} as never
    );

    mediaGate.resolve(null);

    try {
      await schedule.expectResolvesWhileBlocked(
        glossaryPromise,
        "default sort",
        "Expected the local glossary response to resolve without the default sort lookup."
      );

      await expect(glossaryPromise).resolves.toBeNull();
    } finally {
      defaultSortGate.resolve("lesson_order");
      await glossaryPromise;
    }
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

describe("global glossary autocomplete candidate scope", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/features/cache/server/data-cache");
  });

  it("keeps a scoped media query below the cap when the global query is broad", async () => {
    const listCandidateRefs = vi.fn(
      (_database: unknown, input: { mediaSlug?: string }) =>
        Promise.resolve(
          Array.from({ length: input.mediaSlug ? 1 : 65 }, (_, index) => ({
            crossMediaGroupId: null,
            entryId: `term-${index}`,
            entryType: "term" as const
          }))
        )
    );
    const getEntriesByIds = vi.fn(
      (_database: unknown, entryType: string, entryIds: string[]) =>
        Promise.resolve(
          entryType === "term" && entryIds.includes("term-0")
            ? [buildScopedTermEntry()]
            : []
        )
    );

    vi.doMock("@/db/queries", () => ({
      countGlobalGlossaryBrowseGroups: vi.fn(() => Promise.resolve(0)),
      getGlobalGlossaryAggregateStats: vi.fn(() => Promise.resolve({})),
      getGlossaryEntriesByCrossMediaGroupIds: vi.fn(() => Promise.resolve([])),
      getGlossaryEntriesByIds: getEntriesByIds,
      listEntryCardCounts: vi.fn(() =>
        Promise.resolve([
          {
            cardCount: 1,
            entryId: "term-0",
            entryType: "term"
          }
        ])
      ),
      listEntryStudySignals: vi.fn(() => Promise.resolve([])),
      listGlobalGlossaryBrowseGroupRefs: vi.fn(() => Promise.resolve([])),
      listGlossarySearchCandidateRefs: listCandidateRefs
    }));
    vi.doMock("@/features/cache/server/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      buildGlossarySummaryTags: vi.fn(() => ["glossary-summary"]),
      canUseDataCache: vi.fn(() => false),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));

    const { loadCachedGlobalGlossaryAutocompleteData } =
      await import("@/features/glossary/server/global-results");
    const baseFilters = {
      cards: "all" as const,
      entryType: "all" as const,
      page: 1,
      query: "per",
      segmentId: "all",
      sort: "lesson_order" as const,
      study: "all" as const
    };

    const globalSuggestions = await loadCachedGlobalGlossaryAutocompleteData(
      {} as never,
      {
        ...baseFilters,
        media: "all"
      }
    );
    const scopedSuggestions = await loadCachedGlobalGlossaryAutocompleteData(
      {} as never,
      {
        ...baseFilters,
        media: "scoped-media"
      }
    );

    expect(globalSuggestions).toEqual([]);
    expect(scopedSuggestions).toHaveLength(1);
    expect(scopedSuggestions[0]?.label).toBe("ペル");
    expect(listCandidateRefs).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        cards: "all",
        limit: 65,
        mediaSlug: "scoped-media"
      })
    );
    expect(getEntriesByIds).toHaveBeenCalledTimes(2);
  });
});

function buildScopedTermEntry() {
  return {
    aliases: [],
    crossMediaGroup: null,
    crossMediaGroupId: null,
    id: "term-0",
    lemma: "ペル",
    levelHint: null,
    meaningIt: "per",
    meaningLiteralIt: null,
    media: {
      slug: "scoped-media",
      title: "Scoped Media"
    },
    mediaId: "media-scoped",
    notesIt: null,
    pos: null,
    reading: "ぺる",
    romaji: "per",
    searchLemmaNorm: "ぺる",
    searchReadingNorm: "ぺる",
    searchRomajiNorm: "per",
    segment: null,
    segmentId: null,
    sourceId: "term-source-0"
  };
}

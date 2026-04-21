import type { Route } from "next";
import { describe, expect, it } from "vitest";

import type { GlossaryResolvedEntry } from "@/lib/glossary";
import { buildGlobalGlossaryAutocompleteSuggestions } from "@/lib/glossary-search";

function createResolvedEntry(input: {
  aliases?: string[];
  hasCards: boolean;
  id: string;
  label: string;
  matchesCurrentFilters?: boolean;
  matchesCurrentQuery?: boolean;
  mediaId: string;
  mediaSlug: string;
  mediaTitle?: string;
  score?: number;
}) {
  return {
    aliases: (input.aliases ?? []).map((text) => ({
      kana: text,
      normalized: text,
      text
    })),
    cardCount: input.hasCards ? 1 : 0,
    hasCards: input.hasCards,
    href: `/media/${input.mediaSlug}/glossary` as Route,
    id: input.id,
    internalId: input.id,
    kind: "term",
    label: input.label,
    lemmaNorm: input.label,
    matchBadges: [],
    matchedFields: {
      aliases: []
    },
    matchesCurrentFilters: input.matchesCurrentFilters ?? true,
    matchesCurrentQuery: input.matchesCurrentQuery ?? true,
    mediaId: input.mediaId,
    mediaSlug: input.mediaSlug,
    mediaTitle: input.mediaTitle ?? input.mediaSlug,
    meaning: `${input.label}-meaning`,
    meaningNorm: `${input.label}-meaning`,
    score: input.score ?? 0,
    segmentId: null,
    studyState: {
      hasCardsInReview: false,
      hasKnownSignal: false,
      key: "available",
      label: "Disponibile"
    }
  } as GlossaryResolvedEntry;
}

describe("glossary search helpers", () => {
  it("builds autocomplete suggestions in one pass without needing pre-filtered groups", () => {
    const groups = new Map<string, GlossaryResolvedEntry[]>([
      [
        "term:group:yohaku",
        [
          createResolvedEntry({
            aliases: ["yohaku", "margin"],
            hasCards: false,
            id: "alpha-yohaku",
            label: "余白",
            mediaId: "media-alpha",
            mediaSlug: "alpha",
            mediaTitle: "Alpha",
            score: 90
          }),
          createResolvedEntry({
            aliases: ["margin"],
            hasCards: true,
            id: "beta-yohaku",
            label: "余白",
            matchesCurrentQuery: false,
            mediaId: "media-beta",
            mediaSlug: "beta",
            mediaTitle: "Beta",
            score: 70
          }),
          createResolvedEntry({
            aliases: ["blank space"],
            hasCards: true,
            id: "gamma-yohaku",
            label: "余白",
            mediaId: "media-gamma",
            mediaSlug: "gamma",
            mediaTitle: "Gamma",
            score: 110
          })
        ]
      ],
      [
        "term:group:ignored",
        [
          createResolvedEntry({
            aliases: ["ignored"],
            hasCards: true,
            id: "ignored",
            label: "無関係",
            matchesCurrentQuery: false,
            mediaId: "media-ignored",
            mediaSlug: "ignored",
            mediaTitle: "Ignored",
            score: 150
          })
        ]
      ]
    ]);

    const suggestions = buildGlobalGlossaryAutocompleteSuggestions(
      groups,
      "yohaku",
      {
        cards: "all",
        entryType: "all",
        media: "all",
        study: "all"
      }
    );

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      hasCards: true,
      hasCardlessVariant: true,
      label: "余白",
      mediaCount: 3,
      resultKey: "term:group:yohaku"
    });
    expect(suggestions[0]?.aliases).toEqual([
      "yohaku",
      "margin",
      "blank space"
    ]);
    expect(suggestions[0]?.localHits).toEqual([
      {
        hasCards: false,
        mediaSlug: "alpha",
        studyKey: "available"
      },
      {
        hasCards: true,
        mediaSlug: "beta",
        studyKey: "available"
      },
      {
        hasCards: true,
        mediaSlug: "gamma",
        studyKey: "available"
      }
    ]);
  });
});

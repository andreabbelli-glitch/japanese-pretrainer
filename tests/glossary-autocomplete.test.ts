import { describe, expect, it } from "vitest";

import { getGlossaryAutocompleteSuggestions } from "@/features/glossary/model/autocomplete";

const suggestions = [
  {
    aliases: ["dekki"],
    hasCards: true,
    hasCardlessVariant: false,
    kind: "term" as const,
    label: "デッキ",
    localHits: [
      {
        hasCards: true,
        mediaSlug: "duel-masters-dm25",
        studyKey: "available" as const
      }
    ],
    meaning: "mazzo",
    mediaCount: 1,
    reading: "でっき",
    resultKey: "term:entry:deck",
    romaji: "dekki"
  },
  {
    aliases: [],
    hasCards: true,
    hasCardlessVariant: true,
    kind: "term" as const,
    label: "余白",
    localHits: [
      {
        hasCards: false,
        mediaSlug: "alpha",
        studyKey: "available" as const
      },
      {
        hasCards: true,
        mediaSlug: "beta",
        studyKey: "review" as const
      }
    ],
    meaning: "margine",
    mediaCount: 2,
    reading: "よはく",
    resultKey: "term:group:margin",
    romaji: "yohaku"
  }
];

describe("glossary autocomplete", () => {
  it("matches romaji queries against readings and romaji fields", () => {
    const result = getGlossaryAutocompleteSuggestions({
      filters: {
        cards: "all",
        entryType: "all",
        media: "all",
        study: "all"
      },
      query: "dekki",
      suggestions
    });

    expect(result.map((entry) => entry.label)).toEqual(["デッキ"]);
  });

  it("matches compact romaji queries against mixed latin-kana labels", () => {
    const result = getGlossaryAutocompleteSuggestions({
      filters: {
        cards: "all",
        entryType: "all",
        media: "all",
        study: "all"
      },
      query: "mskaado",
      suggestions: [
        {
          aliases: ["MSカード"],
          hasCards: true,
          hasCardlessVariant: false,
          kind: "term",
          label: "MSカード",
          localHits: [
            {
              hasCards: true,
              mediaSlug: "gundam-arsenal-base",
              studyKey: "available"
            }
          ],
          meaning: "carta mobile suit",
          mediaCount: 1,
          reading: "えむえすかーど",
          resultKey: "term:entry:ms-card",
          romaji: "emuesu kaado"
        }
      ]
    });

    expect(result.map((entry) => entry.label)).toEqual(["MSカード"]);
  });

  it("respects cards filters using local-hit semantics", () => {
    const withoutCards = getGlossaryAutocompleteSuggestions({
      filters: {
        cards: "without_cards",
        entryType: "all",
        media: "all",
        study: "all"
      },
      query: "yohaku",
      suggestions
    });
    const withCards = getGlossaryAutocompleteSuggestions({
      filters: {
        cards: "with_cards",
        entryType: "all",
        media: "all",
        study: "all"
      },
      query: "yohaku",
      suggestions
    });

    expect(withoutCards.map((entry) => entry.label)).toEqual(["余白"]);
    expect(withCards.map((entry) => entry.label)).toEqual(["余白"]);
  });

  it("requires one local hit to satisfy combined media, study, and cards filters", () => {
    const impossibleCombination = getGlossaryAutocompleteSuggestions({
      filters: {
        cards: "with_cards",
        entryType: "all",
        media: "alpha",
        study: "review"
      },
      query: "yohaku",
      suggestions
    });
    const matchingCombination = getGlossaryAutocompleteSuggestions({
      filters: {
        cards: "with_cards",
        entryType: "all",
        media: "beta",
        study: "review"
      },
      query: "yohaku",
      suggestions
    });

    expect(impossibleCombination).toEqual([]);
    expect(matchingCombination.map((entry) => entry.label)).toEqual(["余白"]);
  });
});

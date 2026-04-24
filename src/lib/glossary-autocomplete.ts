import type {
  GlobalGlossaryAutocompleteSuggestion,
  GlossaryQueryState
} from "@/lib/glossary-types";
import {
  buildSearchQueryVariants,
  compactLatinSearchText,
  foldJapaneseKana,
  normalizeSearchText,
  romanizeKanaForSearch
} from "@/lib/study-search";

type RankedSuggestion = {
  score: number;
  suggestion: AutocompleteSuggestion;
};

type AutocompleteSuggestion = GlobalGlossaryAutocompleteSuggestion & {
  score?: number;
};

type AutocompleteQuery = {
  literal: string;
} & ReturnType<typeof buildSearchQueryVariants>;

export function getGlossaryAutocompleteSuggestions(input: {
  filters: Pick<
    GlossaryQueryState,
    "cards" | "entryType" | "media" | "study"
  >;
  limit?: number;
  query: string;
  suggestions: AutocompleteSuggestion[];
}) {
  const trimmedQuery = input.query.trim();

  if (trimmedQuery.length === 0) {
    return [];
  }

  const query = buildAutocompleteQuery(trimmedQuery);
  const rankedSuggestions: RankedSuggestion[] = [];

  for (const suggestion of input.suggestions) {
    if (!matchesSuggestionFilters(suggestion, input.filters)) {
      continue;
    }

    const score = suggestion.score ?? scoreSuggestion(suggestion, query);

    if (score <= 0) {
      continue;
    }

    rankedSuggestions.push({
      score,
      suggestion
    });
  }

  rankedSuggestions.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    if (left.suggestion.label !== right.suggestion.label) {
      return left.suggestion.label.localeCompare(right.suggestion.label, "ja");
    }

    return left.suggestion.resultKey.localeCompare(right.suggestion.resultKey);
  });

  return rankedSuggestions
    .slice(0, input.limit ?? 6)
    .map(({ suggestion }) => ({
      aliases: suggestion.aliases,
      hasCards: suggestion.hasCards,
      hasCardlessVariant: suggestion.hasCardlessVariant,
      kind: suggestion.kind,
      label: suggestion.label,
      localHits: suggestion.localHits,
      meaning: suggestion.meaning,
      mediaCount: suggestion.mediaCount,
      reading: suggestion.reading,
      resultKey: suggestion.resultKey,
      romaji: suggestion.romaji,
      title: suggestion.title
    }));
}

function matchesSuggestionFilters(
  suggestion: GlobalGlossaryAutocompleteSuggestion,
  filters: Pick<GlossaryQueryState, "cards" | "entryType" | "media" | "study">
) {
  if (filters.entryType !== "all" && suggestion.kind !== filters.entryType) {
    return false;
  }

  return suggestion.localHits.some((hit) => {
    if (filters.media !== "all" && hit.mediaSlug !== filters.media) {
      return false;
    }

    if (filters.study !== "all" && hit.studyKey !== filters.study) {
      return false;
    }

    if (filters.cards === "with_cards" && !hit.hasCards) {
      return false;
    }

    if (filters.cards === "without_cards" && hit.hasCards) {
      return false;
    }

    return true;
  });
}

function scoreSuggestion(
  suggestion: GlobalGlossaryAutocompleteSuggestion,
  query: AutocompleteQuery
) {
  const literalScore = scoreTextLiteral(suggestion.label, query, 140, 120, 90);

  if (literalScore > 0) {
    return literalScore;
  }

  return Math.max(
    scoreNormalized(suggestion.label, query.normalized, 135, 115, 88),
    scoreNormalized(suggestion.reading, query.kana, 126, 108, 82, "kana"),
    scoreNormalized(suggestion.romaji, query.compact, 124, 106, 80, "compact"),
    scoreNormalized(suggestion.title, query.normalized, 108, 92, 72),
    scoreNormalized(suggestion.meaning, query.normalized, 88, 72, 58),
    ...suggestion.aliases.map((alias) =>
      Math.max(
        scoreNormalized(alias, query.normalized, 104, 86, 68),
        scoreNormalized(alias, query.kana, 101, 84, 66, "kana"),
        scoreNormalized(alias, query.compact, 98, 80, 64, "compact")
      )
    )
  );
}

function scoreTextLiteral(
  value: string | undefined,
  query: Pick<AutocompleteQuery, "literal">,
  exactScore: number,
  prefixScore: number,
  containsScore: number
) {
  if (!value) {
    return 0;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedQuery = query.literal;

  if (normalizedValue === normalizedQuery) {
    return exactScore;
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return prefixScore;
  }

  if (normalizedValue.includes(normalizedQuery)) {
    return containsScore;
  }

  return 0;
}

function buildAutocompleteQuery(query: string): AutocompleteQuery {
  return {
    ...buildSearchQueryVariants(query),
    literal: query.toLowerCase()
  };
}

function scoreNormalized(
  value: string | undefined,
  query: string,
  exactScore: number,
  prefixScore: number,
  containsScore: number,
  mode: "normalized" | "kana" | "compact" = "normalized"
) {
  if (!value || !query) {
    return 0;
  }

  const normalizedValue = normalizeValue(value, mode);

  if (!normalizedValue) {
    return 0;
  }

  if (normalizedValue === query) {
    return exactScore;
  }

  if (normalizedValue.startsWith(query)) {
    return prefixScore;
  }

  if (normalizedValue.includes(query)) {
    return containsScore;
  }

  return 0;
}

function normalizeValue(
  value: string,
  mode: "normalized" | "kana" | "compact"
) {
  switch (mode) {
    case "kana":
      return foldJapaneseKana(normalizeSearchText(value));
    case "compact": {
      const compactValue = compactLatinSearchText(value);

      if (compactValue.length > 0) {
        return compactValue;
      }

      return romanizeKanaForSearch(value);
    }
    case "normalized":
      return normalizeSearchText(value);
  }
}

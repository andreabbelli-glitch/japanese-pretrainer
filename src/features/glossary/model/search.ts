import {
  buildSearchQueryVariants,
  compactLatinSearchText,
  type SearchQueryVariants
} from "@/lib/study-search";
import { getGlossaryAutocompleteSuggestions } from "@/features/glossary/model/autocomplete";
import type {
  GlossaryBaseEntry,
  GlossaryCollectedMatch,
  GlossaryMatchField,
  GlossaryMatchMode,
  GlossaryQueryState,
  GlossaryResolvedEntry,
  GlossarySearchResult,
  GlobalGlossaryAutocompleteSuggestion,
  RankedGlossaryEntry
} from "@/features/glossary/types";
import { mediaGlossaryEntryHref } from "@/lib/site";

type FilteredQuery = SearchQueryVariants;

export function buildFilteredQuery(rawQuery: string): FilteredQuery | null {
  if (!rawQuery) {
    return null;
  }

  const query = buildSearchQueryVariants(rawQuery);

  if (!query.normalized) {
    return null;
  }

  return query;
}

export function buildRankedGlossaryEntry(
  entry: GlossaryBaseEntry,
  query: FilteredQuery | null,
  studyState: RankedGlossaryEntry["studyState"]
): RankedGlossaryEntry | null {
  const matches = query ? collectMatches(entry, query) : [];

  if (query && matches.length === 0) {
    return null;
  }

  const sortedMatches = [...matches].sort(
    (left, right) => right.score - left.score
  );
  const score =
    (sortedMatches[0]?.score ?? 0) +
    Math.max(Math.min(sortedMatches.length - 1, 4), 0) * 8;

  return {
    ...entry,
    href: mediaGlossaryEntryHref(entry.mediaSlug, entry.kind, entry.label, {
      sourceId: entry.id
    }),
    matchBadges: [...new Set(sortedMatches.map((match) => match.badge))].slice(
      0,
      3
    ),
    matchPreview: sortedMatches[0]?.preview,
    matchedFields: buildMatchedFields(sortedMatches),
    score,
    studyState
  };
}

export function buildGlobalGlossaryAutocompleteSuggestions(
  groups: Map<string, GlossaryResolvedEntry[]>,
  query?: string,
  filters?: Pick<GlossaryQueryState, "cards" | "entryType" | "media" | "study">
) {
  const suggestions: Array<
    GlobalGlossaryAutocompleteSuggestion & { score?: number }
  > = [];

  for (const [resultKey, entries] of groups.entries()) {
    const aliases = new Set<string>();
    const mediaIds = new Set<string>();
    const localHits: GlobalGlossaryAutocompleteSuggestion["localHits"] = [];
    let representative: GlossaryResolvedEntry | null = null;
    let hasCards = false;
    let hasCardlessVariant = false;

    for (const entry of entries) {
      for (const alias of entry.aliases) {
        aliases.add(alias.text);
      }

      mediaIds.add(entry.mediaId);
      localHits.push({
        hasCards: entry.hasCards,
        mediaSlug: entry.mediaSlug,
        studyKey: entry.studyState.key
      });
      hasCards ||= entry.hasCards;
      hasCardlessVariant ||= !entry.hasCards;

      const matchesCurrentContext = query
        ? entry.matchesCurrentFilters && entry.matchesCurrentQuery
        : entry.matchesCurrentFilters;

      if (!matchesCurrentContext) {
        continue;
      }

      if (
        !representative ||
        compareAutocompleteRepresentatives(entry, representative, query) < 0
      ) {
        representative = entry;
      }
    }

    if (!representative) {
      continue;
    }

    suggestions.push({
      aliases: [...aliases],
      hasCards,
      hasCardlessVariant,
      kind: representative.kind,
      label: representative.label,
      localHits,
      meaning: representative.meaning,
      mediaCount: mediaIds.size,
      reading: representative.reading,
      resultKey,
      romaji: representative.romaji,
      score: representative.score,
      title: representative.title
    });
  }

  if (!query) {
    suggestions.sort((left, right) =>
      left.label.localeCompare(right.label, "ja")
    );

    return suggestions;
  }

  return getGlossaryAutocompleteSuggestions({
    filters: filters ?? {
      cards: "all",
      entryType: "all",
      media: "all",
      study: "all"
    },
    query,
    suggestions
  });
}

function compareAutocompleteRepresentatives(
  left: GlossaryResolvedEntry,
  right: GlossaryResolvedEntry,
  query?: string
) {
  if (query && left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.hasCards !== right.hasCards) {
    return left.hasCards ? -1 : 1;
  }

  if (left.mediaTitle !== right.mediaTitle) {
    return left.mediaTitle.localeCompare(right.mediaTitle);
  }

  return left.label.localeCompare(right.label, "ja");
}

export function compareGlobalGlossaryResults(
  left: GlossarySearchResult,
  right: GlossarySearchResult,
  filters: GlossaryQueryState
) {
  if (filters.query.length > 0 && left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.label !== right.label) {
    return left.label.localeCompare(right.label, "ja");
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  if (left.mediaCount !== right.mediaCount) {
    return right.mediaCount - left.mediaCount;
  }

  return left.bestLocalHref.localeCompare(right.bestLocalHref);
}

export function compareBestLocalEntries(
  left: GlossaryResolvedEntry,
  right: GlossaryResolvedEntry,
  filters: GlossaryQueryState
) {
  if (filters.query.length > 0 && left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.matchesCurrentQuery !== right.matchesCurrentQuery) {
    return left.matchesCurrentQuery ? -1 : 1;
  }

  if (left.hasCards !== right.hasCards) {
    return left.hasCards ? -1 : 1;
  }

  if (left.mediaTitle !== right.mediaTitle) {
    return left.mediaTitle.localeCompare(right.mediaTitle);
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.label.localeCompare(right.label, "ja");
}

export function compareMediaHits(
  left: GlossaryResolvedEntry,
  right: GlossaryResolvedEntry,
  bestLocalInternalId: string
) {
  if (left.internalId !== right.internalId) {
    if (left.internalId === bestLocalInternalId) {
      return -1;
    }

    if (right.internalId === bestLocalInternalId) {
      return 1;
    }
  }

  if (left.mediaTitle !== right.mediaTitle) {
    return left.mediaTitle.localeCompare(right.mediaTitle);
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.label.localeCompare(right.label, "ja");
}

export function compareRankedEntries(
  left: RankedGlossaryEntry,
  right: RankedGlossaryEntry,
  input: {
    hasQuery: boolean;
    segmentOrder: Map<string, number>;
    sort: "alphabetical" | "lesson_order";
  }
) {
  if (input.hasQuery && left.score !== right.score) {
    return right.score - left.score;
  }

  if (input.sort === "alphabetical") {
    if (left.label !== right.label) {
      return left.label.localeCompare(right.label, "ja");
    }

    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }

    return (left.reading ?? "").localeCompare(right.reading ?? "", "ja");
  }

  const leftSegment = left.segmentId
    ? (input.segmentOrder.get(left.segmentId) ?? 999)
    : 999;
  const rightSegment = right.segmentId
    ? (input.segmentOrder.get(right.segmentId) ?? 999)
    : 999;

  if (leftSegment !== rightSegment) {
    return leftSegment - rightSegment;
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.label.localeCompare(right.label, "ja");
}

function collectMatches(entry: GlossaryBaseEntry, query: FilteredQuery) {
  const matches: GlossaryCollectedMatch[] = [];
  const compactRomaji = entry.romajiCompact ?? "";

  pushMatch(
    matches,
    "label",
    "kanji",
    "normalized",
    entry.label,
    query.normalized,
    280,
    230,
    190
  );

  if (entry.readingNorm) {
    pushMatch(
      matches,
      "reading",
      "lettura",
      "kana",
      entry.readingNorm,
      query.kana,
      270,
      225,
      185
    );
  }

  if (compactRomaji) {
    pushMatch(
      matches,
      "romaji",
      "romaji",
      "romajiCompact",
      compactRomaji,
      query.compact,
      255,
      215,
      175
    );
  }

  if (entry.kind === "grammar" && entry.titleNorm) {
    pushMatch(
      matches,
      "title",
      "titolo",
      "normalized",
      entry.titleNorm,
      query.normalized,
      220,
      180,
      140
    );
  }

  pushMeaningMatch(
    matches,
    "meaning",
    "significato",
    "normalized",
    entry.meaningNorm,
    query.normalized,
    210,
    170,
    132
  );

  if (entry.literalMeaningNorm) {
    pushMeaningMatch(
      matches,
      "literalMeaning",
      "letterale",
      "normalized",
      entry.literalMeaningNorm,
      query.normalized,
      165,
      135,
      110
    );
  }

  if (entry.notesNorm) {
    pushMeaningMatch(
      matches,
      "notes",
      "note",
      "normalized",
      entry.notesNorm,
      query.normalized,
      105,
      92,
      70
    );
  }

  if (entry.patternKana) {
    pushMatch(
      matches,
      "label",
      "pattern",
      "grammarKana",
      entry.patternKana,
      query.grammarKana,
      282,
      234,
      194
    );
  }

  for (const alias of entry.aliases) {
    const aliasQuery =
      entry.kind === "grammar" ? query.grammarKana : query.kana;
    const label = alias.type === "romaji" ? "alias romaji" : "alias";

    pushMatch(
      matches,
      "alias",
      label,
      entry.kind === "grammar" ? "grammarKana" : "kana",
      alias.kana,
      aliasQuery,
      235,
      195,
      152,
      alias.text
    );

    if (entry.kind === "grammar") {
      const aliasRomaji = alias.romajiCompact;

      if (aliasRomaji && aliasRomaji !== compactLatinSearchText(alias.kana)) {
        pushMatch(
          matches,
          "alias",
          "alias",
          "romajiCompact",
          aliasRomaji,
          query.compact,
          228,
          188,
          148,
          alias.text
        );
      }
    }
  }

  return matches;
}

function pushMatch(
  matches: GlossaryCollectedMatch[],
  field: GlossaryMatchField,
  badge: string,
  mode: GlossaryMatchMode,
  value: string,
  query: string,
  exactScore: number,
  prefixScore: number,
  containsScore: number,
  preview?: string
) {
  if (!query || !value) {
    return;
  }

  if (value === query) {
    matches.push({
      badge,
      field,
      mode,
      preview,
      score: exactScore
    });
    return;
  }

  if (value.startsWith(query)) {
    matches.push({
      badge,
      field,
      mode,
      preview,
      score: prefixScore
    });
    return;
  }

  if (value.includes(query)) {
    matches.push({
      badge,
      field,
      mode,
      preview,
      score: containsScore
    });
  }
}

function pushMeaningMatch(
  matches: GlossaryCollectedMatch[],
  field: GlossaryMatchField,
  badge: string,
  mode: GlossaryMatchMode,
  value: string,
  query: string,
  exactScore: number,
  wordScore: number,
  containsScore: number
) {
  if (!query || !value) {
    return;
  }

  if (value === query) {
    matches.push({
      badge,
      field,
      mode,
      score: exactScore
    });
    return;
  }

  if (value.split(/[^0-9\p{L}]+/u).some((token) => token.startsWith(query))) {
    matches.push({
      badge,
      field,
      mode,
      score: wordScore
    });
    return;
  }

  if (value.includes(query)) {
    matches.push({
      badge,
      field,
      mode,
      score: containsScore
    });
  }
}

function buildMatchedFields(matches: GlossaryCollectedMatch[]) {
  const matchedFields: RankedGlossaryEntry["matchedFields"] = {
    aliases: []
  };

  for (const match of matches) {
    if (match.field === "alias" && match.preview) {
      const exists = matchedFields.aliases.some(
        (alias) => alias.text === match.preview && alias.mode === match.mode
      );

      if (!exists) {
        matchedFields.aliases.push({
          mode: match.mode,
          text: match.preview
        });
      }

      continue;
    }

    if (match.field === "label") {
      matchedFields.label ??= match.mode;
      continue;
    }

    if (match.field === "title") {
      matchedFields.title ??= match.mode;
      continue;
    }

    if (match.field === "reading") {
      matchedFields.reading ??= match.mode;
      continue;
    }

    if (match.field === "romaji") {
      matchedFields.romaji ??= match.mode;
      continue;
    }

    if (match.field === "meaning") {
      matchedFields.meaning ??= match.mode;
    }
  }

  return matchedFields;
}

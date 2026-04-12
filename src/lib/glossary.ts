import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  listEntryStudySignals,
  type DatabaseClient
} from "@/db";
import {
  loadGlobalGlossaryAutocompleteData,
  loadGlobalGlossaryPageData,
  loadGlossaryDetailData,
  loadGlossaryPageData
} from "./glossary-loaders.ts";
import type { GlossaryDefaultSort } from "@/lib/settings";
import { deriveEntryStudyState } from "@/lib/study-entry";
import type { PronunciationData } from "@/lib/pronunciation";

export type StudySignalRow = Awaited<
  ReturnType<typeof listEntryStudySignals>
>[number];
type StudyState = ReturnType<typeof deriveEntryStudyState>;

export type GlossaryKind = "term" | "grammar";
export type GlossaryCardsFilter = "all" | "with_cards" | "without_cards";

export type GlossaryBaseEntry = {
  id: string;
  internalId: string;
  kind: GlossaryKind;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  label: string;
  title?: string;
  reading?: string;
  romaji?: string;
  pronunciation?: PronunciationData;
  meaning: string;
  literalMeaning?: string;
  notes?: string;
  pos?: string;
  levelHint?: string;
  crossMediaGroupId?: string;
  crossMediaGroupKey?: string;
  segmentId: string | null;
  segmentTitle?: string;
  aliases: Array<{
    kana: string;
    romajiCompact?: string;
    text: string;
    normalized: string;
    type?: string;
  }>;
  lemmaNorm: string;
  readingNorm?: string;
  romajiNorm?: string;
  meaningNorm: string;
  literalMeaningNorm?: string;
  notesNorm?: string;
  patternKana?: string;
  titleNorm?: string;
  patternNorm?: string;
  romajiCompact?: string;
};

export type GlossaryMatchMode =
  | "normalized"
  | "kana"
  | "grammarKana"
  | "romajiCompact";

export type GlossaryMatchField =
  | "alias"
  | "label"
  | "literalMeaning"
  | "meaning"
  | "notes"
  | "reading"
  | "romaji"
  | "title";

export type GlossaryCollectedMatch = {
  badge: string;
  field: GlossaryMatchField;
  mode: GlossaryMatchMode;
  preview?: string;
  score: number;
};

export type RankedGlossaryEntry = GlossaryBaseEntry & {
  href: Route;
  matchBadges: string[];
  matchPreview?: string;
  matchedFields: {
    aliases: Array<{
      mode: GlossaryMatchMode;
      text: string;
    }>;
    label?: GlossaryMatchMode;
    meaning?: GlossaryMatchMode;
    reading?: GlossaryMatchMode;
    romaji?: GlossaryMatchMode;
    title?: GlossaryMatchMode;
  };
  score: number;
  studyState: StudyState;
};

export type GlossaryMediaHit = {
  cardCount: number;
  hasCards: boolean;
  href: Route;
  id: string;
  internalId: string;
  isBestLocal: boolean;
  kind: GlossaryKind;
  matchesCurrentFilters: boolean;
  matchesCurrentQuery: boolean;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  segmentTitle?: string;
  studyState: StudyState;
};

export type GlossarySearchResult = RankedGlossaryEntry & {
  bestLocalHref: Route;
  cardCount: number;
  hasCards: boolean;
  mediaCount: number;
  mediaHits: GlossaryMediaHit[];
  resultKey: string;
};

type GlossaryLocalResult = GlossarySearchResult & {
  lessonCount: number;
  primaryLesson?: {
    href: Route;
    roleLabel: string;
    title: string;
  };
};

export type GlossaryResolvedEntry = RankedGlossaryEntry & {
  cardCount: number;
  hasCards: boolean;
  matchesCurrentFilters: boolean;
  matchesCurrentQuery: boolean;
};

export type GlossaryQueryState = {
  cards: GlossaryCardsFilter;
  entryType: "all" | GlossaryKind;
  media: string;
  page: number;
  query: string;
  segmentId: string;
  sort: GlossaryDefaultSort;
  study: "all" | "known" | "review" | "learning" | "new" | "available";
};

export type GlobalGlossaryPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
};

export type GlossaryMediaSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  glossaryHref: Route;
  mediaTypeLabel: string;
  segmentKindLabel: string;
  textbookHref: Route;
};

export type GlossaryPageData = {
  filters: GlossaryQueryState;
  hasActiveFilters: boolean;
  media: GlossaryMediaSummary;
  resultSummary: {
    filtered: number;
    total: number;
    queryLabel?: string;
  };
  results: GlossaryLocalResult[];
  preview?: GlossaryDetailData;
  segments: Array<{
    id: string;
    label: string;
  }>;
  stats: {
    grammarCount: number;
    knownCount: number;
    reviewCount: number;
    termCount: number;
  };
};

export type GlobalGlossaryPageData = {
  filters: GlossaryQueryState;
  hasActiveFilters: boolean;
  mediaOptions: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  resultSummary: {
    filtered: number;
    total: number;
    queryLabel?: string;
  };
  pagination: GlobalGlossaryPagination;
  results: GlossarySearchResult[];
  stats: {
    crossMediaCount: number;
    entryCount: number;
    mediaCount: number;
    withCardsCount: number;
  };
};

export type GlobalGlossaryAutocompleteSuggestion = {
  aliases: string[];
  hasCards: boolean;
  hasCardlessVariant: boolean;
  kind: GlossaryKind;
  label: string;
  localHits: Array<{
    hasCards: boolean;
    mediaSlug: string;
    studyKey: StudyState["key"];
  }>;
  meaning: string;
  mediaCount: number;
  reading?: string;
  resultKey: string;
  romaji?: string;
  title?: string;
};

type GlossaryDetailLesson = {
  href: Route;
  id: string;
  roleLabels: string[];
  segmentTitle?: string;
  summary?: string;
  title: string;
};

type GlossaryDetailCard = {
  back: string;
  dueLabel?: string;
  front: string;
  id: string;
  relationshipLabel: string;
  href: Route;
  reviewLabel: string;
  segmentTitle?: string;
  typeLabel: string;
  notes?: string;
};

type GlossaryCrossMediaSibling = {
  href: Route;
  kind: GlossaryKind;
  label: string;
  title?: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  segmentTitle?: string;
};

export type GlossaryDetailData = {
  cards: GlossaryDetailCard[];
  crossMedia: {
    groupKey: string;
    siblings: GlossaryCrossMediaSibling[];
  } | null;
  entry: RankedGlossaryEntry & {
    aliasGroups: Array<{
      label: string;
      values: string[];
    }>;
  };
  lessons: GlossaryDetailLesson[];
  media: GlossaryMediaSummary;
  related: {
    cardsLabel: string;
    primaryLessonLabel: string;
  };
};

export async function getGlossaryPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryPageData | null> {
  markDataAsLive();
  return loadGlossaryPageData(mediaSlug, searchParams, database);
}

export async function getGlobalGlossaryPageData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryPageData> {
  return loadGlobalGlossaryPageData(searchParams, database);
}

export async function getGlobalGlossaryAutocompleteData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryAutocompleteSuggestion[]> {
  return loadGlobalGlossaryAutocompleteData(searchParams, database);
}

export async function getTermGlossaryDetailData(
  mediaSlug: string,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  markDataAsLive();
  return loadGlossaryDetailData(mediaSlug, "term", entryId, database);
}

export async function getGrammarGlossaryDetailData(
  mediaSlug: string,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  markDataAsLive();
  return loadGlossaryDetailData(mediaSlug, "grammar", entryId, database);
}


function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Rendering hint only.
  }
}

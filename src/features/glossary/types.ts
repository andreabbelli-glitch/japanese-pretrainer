import type { PronunciationData } from "@/lib/pronunciation-data";
import type { GlossaryDefaultSort } from "@/lib/settings";
import type { AppHref } from "@/lib/site";
import type { DerivedStudyState, EntryStudySignal } from "@/lib/study-entry";

export type GlossaryKind = "term" | "grammar";
export type GlossaryCardsFilter = "all" | "with_cards" | "without_cards";
export type GlossaryStudySignalRow = EntryStudySignal & {
  entryId: string;
  entryType: GlossaryKind;
};
export type StudySignalRow = GlossaryStudySignalRow;
type StudyState = DerivedStudyState;

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
  href: AppHref;
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
  href: AppHref;
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
  bestLocalHref: AppHref;
  cardCount: number;
  hasCards: boolean;
  mediaCount: number;
  mediaHits: GlossaryMediaHit[];
  resultKey: string;
};

type GlossaryLocalResult = GlossarySearchResult & {
  lessonCount: number;
  primaryLesson?: {
    href: AppHref;
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
  glossaryHref: AppHref;
  mediaTypeLabel: string;
  segmentKindLabel: string;
  textbookHref: AppHref;
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
  href: AppHref;
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
  href: AppHref;
  reviewLabel: string;
  segmentTitle?: string;
  typeLabel: string;
  notes?: string;
};

type GlossaryCrossMediaSibling = {
  href: AppHref;
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

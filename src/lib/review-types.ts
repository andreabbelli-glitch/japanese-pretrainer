import type { EffectiveReviewState } from "./review-model";
import type { EntryType } from "@/domain/content";
import type {
  ReviewGradePreview,
  ReviewSeedState
} from "./review-grade-previews";
import type { PronunciationData } from "./pronunciation-data";
import type { AppHref } from "./site";

type MediaGlossaryEntryHref = AppHref;
type MediaGlossaryHref = AppHref;
type MediaHref = AppHref;
type MediaReviewCardHref = AppHref;
type MediaStudyHref = AppHref;
type ReviewHref = AppHref;

export type ReviewCardEntryKind = "term" | "grammar";

export type ReviewScope = "global" | "media";

export type ReviewForcedContrastPayload = {
  source: "review-grading";
  targetLabel?: string;
  targetResultKey: string;
};

export type ReviewForcedContrastEndpoint = {
  cardId: string | null;
  crossMediaGroupId: string | null;
  entryId: string | null;
  entryType: EntryType | null;
  subjectKey: string;
  subjectType: "card" | "entry" | "group";
};

export type ReviewForcedContrastResolution = {
  contrastKey: string;
  current: ReviewForcedContrastEndpoint;
  mediaId?: string;
  mediaSlug?: string;
  scope: ReviewScope;
  source: "forced";
  target: ReviewForcedContrastEndpoint;
};

export type ReviewCardEntrySummary = {
  href: MediaGlossaryEntryHref;
  id: string;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  relationshipLabel: string;
  statusLabel: string;
  subtitle?: string;
};

export type ReviewCardPronunciation = {
  audio: PronunciationData;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  relationshipLabel: string;
};

export type ReviewQueueCard = {
  back: string;
  bucket: "due" | "manual" | "new" | "suspended" | "upcoming";
  bucketDetail: string;
  bucketLabel: string;
  contexts: Array<{
    cardId: string;
    front: string;
    mediaSlug: string;
    mediaTitle: string;
    segmentTitle?: string;
  }>;
  createdAt: string;
  dueAt: string | null;
  dueLabel?: string;
  effectiveState: EffectiveReviewState["state"];
  effectiveStateLabel: string;
  exampleIt?: string;
  exampleJp?: string;
  entries: ReviewCardEntrySummary[];
  front: string;
  href: MediaReviewCardHref;
  id: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  orderIndex: number | null;
  pronunciations: ReviewCardPronunciation[];
  rawReviewLabel: string;
  reading?: string;
  gradePreviews: ReviewGradePreview[];
  reviewStateUpdatedAt?: string | null;
  reviewSeedState: ReviewSeedState;
  segmentTitle?: string;
  typeLabel: string;
};

export type ReviewQueueSnapshot = {
  advanceCards: ReviewQueueCard[];
  cards: ReviewQueueCard[];
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  queueLabel: string;
  queueCount: number;
  suspendedCount: number;
  tomorrowCount: number;
  upcomingCount: number;
};

export type ReviewOverviewSnapshot = {
  activeCards: number;
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  nextCardFront?: string;
  queueCount: number;
  queueLabel: string;
  suspendedCount: number;
  tomorrowCount: number;
  totalCards: number;
  upcomingCount: number;
};

export type ReviewPageData = {
  scope: ReviewScope;
  media: {
    glossaryHref: MediaGlossaryHref;
    href: MediaHref | "/";
    id?: string;
    reviewHref: MediaStudyHref | ReviewHref;
    slug: string;
    title: string;
  };
  settings: {
    reviewFrontFurigana: boolean;
  };
  queue: ReviewQueueSnapshot & {
    introLabel: string;
    manualCards: ReviewQueueCard[];
    suspendedCards: ReviewQueueCard[];
    upcomingCards: ReviewQueueCard[];
  };
  selectedCard: ReviewQueueCard | null;
  queueCardIds: string[];
  selectedCardContext: {
    bucket: ReviewQueueCard["bucket"] | null;
    gradePreviews: ReviewGradePreview[];
    isQueueCard: boolean;
    position: number | null;
    remainingCount: number;
    reviewStateUpdatedAt?: string | null;
    showAnswer: boolean;
  };
  session: {
    answeredCount: number;
    extraNewCount: number;
    forcedContrast?: ReviewForcedContrastResolution;
    notice?: string;
    segmentId?: string | null;
  };
};

export type ReviewFirstCandidateCard = {
  back: string;
  bucket: ReviewQueueCard["bucket"];
  bucketDetail: string;
  bucketLabel: string;
  createdAt: string;
  dueAt: string | null;
  dueLabel?: string;
  effectiveState: EffectiveReviewState["state"];
  effectiveStateLabel: string;
  exampleIt?: string;
  exampleJp?: string;
  front: string;
  href: MediaReviewCardHref;
  id: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  orderIndex: number | null;
  rawReviewLabel: string;
  reading?: string;
  reviewSeedState: ReviewSeedState;
  segmentTitle?: string;
  typeLabel: string;
};

export type ReviewFirstCandidateQueueSnapshot = Pick<
  ReviewPageData["queue"],
  | "dailyLimit"
  | "dueCount"
  | "effectiveDailyLimit"
  | "manualCount"
  | "newAvailableCount"
  | "newQueuedCount"
  | "queueCount"
  | "suspendedCount"
  | "tomorrowCount"
  | "upcomingCount"
> & {
  advanceCards: ReviewQueueCard[];
  introLabel: string;
  queueLabel: string;
};

export type ReviewFirstCandidateSelectedCardContext = Omit<
  ReviewPageData["selectedCardContext"],
  "gradePreviews"
>;

export type ReviewFirstCandidatePageData = {
  media: ReviewPageData["media"];
  nextCardId?: string | null;
  queueCardIds: string[];
  queue: ReviewFirstCandidateQueueSnapshot;
  scope: ReviewScope;
  selectedCard: ReviewFirstCandidateCard | null;
  selectedCardContext: ReviewFirstCandidateSelectedCardContext;
  settings: ReviewPageData["settings"];
  session: ReviewPageData["session"];
};

export type GlobalReviewPageLoadResult =
  | { kind: "empty-media" }
  | { kind: "empty-cards" }
  | { kind: "ready"; data: ReviewPageData };

export type GlobalReviewFirstCandidateLoadResult =
  | { kind: "empty-media" }
  | { kind: "empty-cards" }
  | { kind: "ready"; data: ReviewFirstCandidatePageData };

export type ReviewCardDetailData = {
  card: {
    back: string;
    bucketLabel?: string;
    dueLabel?: string;
    exampleIt?: string;
    exampleJp?: string;
    front: string;
    id: string;
    notes?: string;
    reading?: string;
    reviewLabel: string;
    segmentTitle?: string;
    typeLabel: string;
  };
  crossMedia: Array<{
    entryId: string;
    kind: ReviewCardEntryKind;
    label: string;
    meaning: string;
    relationshipLabel: string;
    siblings: Array<{
      href: MediaGlossaryEntryHref;
      label: string;
      meaning: string;
      mediaSlug: string;
      mediaTitle: string;
      notes?: string;
      reading?: string;
      subtitle?: string;
    }>;
  }>;
  entries: ReviewCardEntrySummary[];
  pronunciations: ReviewCardPronunciation[];
  media: {
    glossaryHref: MediaGlossaryHref;
    href: MediaHref;
    reviewHref: MediaStudyHref;
    slug: string;
    title: string;
  };
};

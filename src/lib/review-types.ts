import type { EffectiveReviewState } from "./review-model";
import type {
  ReviewGradePreview,
  ReviewSeedState
} from "./review-grade-previews";
import type { PronunciationData } from "./pronunciation";

type MediaGlossaryEntryHref = ReturnType<
  typeof import("@/lib/site").mediaGlossaryEntryHref
>;
type MediaGlossaryHref = ReturnType<typeof import("@/lib/site").mediaGlossaryHref>;
type MediaHref = ReturnType<typeof import("@/lib/site").mediaHref>;
type MediaReviewCardHref = ReturnType<
  typeof import("@/lib/site").mediaReviewCardHref
>;
type MediaStudyHref = ReturnType<typeof import("@/lib/site").mediaStudyHref>;
type ReviewHref = ReturnType<typeof import("@/lib/site").reviewHref>;

export type ReviewCardEntryKind = "term" | "grammar";

export type ReviewScope = "global" | "media";

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
  reviewSeedState: ReviewSeedState;
  segmentTitle?: string;
  typeLabel: string;
};

export type ReviewQueueSnapshot = {
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
  totalCards: number;
  upcomingCount: number;
};

export type ReviewPageData = {
  scope: ReviewScope;
  media: {
    glossaryHref: MediaGlossaryHref;
    href: MediaHref | "/";
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
    showAnswer: boolean;
  };
  session: {
    answeredCount: number;
    extraNewCount: number;
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
  | "upcomingCount"
> & {
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

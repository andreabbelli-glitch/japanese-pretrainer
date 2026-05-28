export type {
  GlobalReviewFirstCandidateLoadResult,
  GlobalReviewPageLoadResult,
  ReviewCardDetailData,
  ReviewCardEntryKind,
  ReviewCardEntrySummary,
  ReviewCardPronunciation,
  ReviewFirstCandidatePageData,
  ReviewForcedContrastPayload,
  ReviewForcedContrastResolution,
  ReviewOverviewSnapshot,
  ReviewPageData,
  ReviewQueueCard,
  ReviewQueueSnapshot,
  ReviewScope
} from "@/lib/review-types";
export type {
  ReviewGradePreview,
  ReviewSeedState
} from "@/lib/review-grade-previews";

import type {
  ReviewForcedContrastPayload,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";

export type ReviewSessionInput = {
  answeredCount: number;
  cardId: string;
  cardMediaSlug?: string;
  candidateCardIds?: string[];
  canonicalCandidateCardIds?: string[];
  extraNewAnchorCount?: number | null;
  extraNewCount: number;
  expectedUpdatedAt?: string | null;
  forcedContrast?: ReviewForcedContrastPayload;
  forcedKanjiClashContrast?: ReviewForcedContrastPayload;
  gradedCardBucket?: ReviewQueueCard["bucket"];
  gradedCardIds?: string[];
  mediaSlug?: string;
  nextCardId?: string | null;
  segmentId?: string | null;
  sessionMedia?: ReviewPageData["media"];
  sessionQueue?: ReviewPageData["queue"];
  sessionSettings?: ReviewPageData["settings"];
  scope?: "global" | "media";
};

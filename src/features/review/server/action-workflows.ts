import type { Route } from "next";

import { listMediaCached } from "@/features/cache/server/data-cache";
import {
  buildRedirectSearchParams,
  buildReviewRedirectUrl,
  type ReviewRedirectMode
} from "@/features/navigation";
import type { ReviewRating } from "@/features/review/model/scheduler";
import type { ReviewPageData, ReviewQueueCard } from "@/features/review/types";
import type { ReviewMutationKind } from "@/features/review/server/action-mutations";
import { applyReviewActionCachePolicy } from "@/features/review/server/action-cache-policy";
import { hydrateReviewCard } from "@/features/review/server/card-hydration";
import { applyReviewGrade } from "@/features/review/server/service";
import { loadReviewPageDataSession } from "@/features/review/server/page-data";
import {
  requireReviewPageDataForScope,
  requireMediaIdForSlug,
  resolvePostGradeReviewSessionPageData,
  resolveReviewSessionMedia,
  type ReviewSessionInput
} from "@/features/review/server/session-transition";
import { runReviewActionMutation } from "@/features/review/server/action-mutations";

type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;

export type ReviewFormGradeWorkflowInput = {
  answeredCount: number;
  cardId: string;
  expectedUpdatedAt?: string | null;
  extraNewCount: number;
  mediaSlug: string;
  rating: string;
};

export type ReviewFormMutationWorkflowInput = {
  answeredCount: number;
  cardId: string;
  extraNewCount: number;
  kind: ReviewMutationKind;
  mediaSlug: string;
  redirectMode: ReviewRedirectMode;
  returnTo?: Route | null;
  suspended?: boolean;
};

export type ReviewSessionMutationWorkflowInput = ReviewSessionInput & {
  kind: ReviewMutationKind;
  redirectMode: ReviewSessionRedirectMode;
  suspended?: boolean;
};

type ReviewCacheInvalidationScheduler = (task: () => void) => void;

export type ReviewCardPrefetchResult = {
  card: ReviewQueueCard | null;
  cardId: string;
};

const REVIEW_CARD_PREFETCH_BATCH_SIZE = 3;

export async function gradeReviewCardFormWorkflow(
  input: ReviewFormGradeWorkflowInput
): Promise<Route> {
  const mediaId = await requireMediaIdForSlug(input.mediaSlug);
  const gradeResult = await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    rating: assertReviewFormRating(input.rating)
  });

  applyReviewActionCachePolicy({
    affectedCardIds: gradeResult.affectedCardIds,
    includeConsolidation: gradeResult.consolidationChanged,
    mediaId,
    policy: "review"
  });

  return buildReviewRedirectUrl({
    answeredCount: input.answeredCount + 1,
    extraNewCount: input.extraNewCount,
    mediaSlug: input.mediaSlug
  });
}

function assertReviewFormRating(rating: string): ReviewRating {
  if (
    rating === "again" ||
    rating === "hard" ||
    rating === "good" ||
    rating === "easy"
  ) {
    return rating;
  }

  throw new Error("Invalid review rating.");
}

export async function runReviewFormMutationWorkflow(
  input: ReviewFormMutationWorkflowInput
): Promise<Route> {
  const mediaId = await requireMediaIdForSlug(input.mediaSlug);
  const mutationResult = await runReviewActionMutation({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    kind: input.kind,
    suspended: input.suspended
  });

  applyReviewActionCachePolicy({
    includeCardContent: true,
    mediaId: mutationResult.mediaId,
    policy: mutationResult.cachePolicy
  });

  return buildReviewRedirectUrl({
    answeredCount: input.answeredCount,
    cardId: input.cardId,
    extraNewCount: input.extraNewCount,
    mediaSlug: input.mediaSlug,
    notice: mutationResult.notice,
    redirectMode: input.redirectMode,
    returnTo: input.returnTo
  });
}

export async function gradeReviewCardSessionWorkflow(
  input: ReviewSessionInput & {
    rating: "again" | "hard" | "good" | "easy";
  },
  options: {
    scheduleCacheInvalidation?: ReviewCacheInvalidationScheduler;
  } = {}
): Promise<ReviewPageData> {
  const media = await resolveReviewSessionMedia(input);
  const forcedContrast = input.forcedKanjiClashContrast ?? input.forcedContrast;
  const gradeResult = await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    expectedUpdatedAt: input.expectedUpdatedAt,
    forcedContrast,
    forcedContrastMediaSlug: input.mediaSlug,
    forcedContrastScope: input.scope === "media" ? "media" : "global",
    rating: input.rating
  });
  const invalidateCaches = () =>
    applyReviewActionCachePolicy({
      affectedCardIds: gradeResult.affectedCardIds,
      includeConsolidation: gradeResult.consolidationChanged,
      mediaId: gradeResult.mediaId,
      policy: "review"
    });

  if (options.scheduleCacheInvalidation) {
    options.scheduleCacheInvalidation(invalidateCaches);
  }

  try {
    return await resolvePostGradeReviewSessionPageData({
      gradeResult,
      resolvedMedia: media,
      sessionInput: input
    });
  } finally {
    if (!options.scheduleCacheInvalidation) {
      invalidateCaches();
    }
  }
}

export function prefetchReviewCardSessionWorkflow(input: {
  cardId: string;
}): Promise<ReviewQueueCard | null> {
  return hydrateReviewCard({
    cardId: input.cardId
  });
}

export async function prefetchReviewCardsSessionWorkflow(input: {
  cardIds: string[];
}): Promise<ReviewCardPrefetchResult[]> {
  const cardIds = collectReviewCardPrefetchIds(input.cardIds);

  return Promise.all(
    cardIds.map(async (cardId) => {
      try {
        return {
          card: await hydrateReviewCard({ cardId }),
          cardId
        };
      } catch (error) {
        console.error(error);

        return {
          card: null,
          cardId
        };
      }
    })
  );
}

function collectReviewCardPrefetchIds(cardIds: string[]) {
  const normalizedCardIds: string[] = [];
  const seenCardIds = new Set<string>();

  for (const rawCardId of cardIds) {
    const cardId = rawCardId.trim();

    if (!cardId || seenCardIds.has(cardId)) {
      continue;
    }

    normalizedCardIds.push(cardId);
    seenCardIds.add(cardId);

    if (normalizedCardIds.length === REVIEW_CARD_PREFETCH_BATCH_SIZE) {
      break;
    }
  }

  return normalizedCardIds;
}

export function loadReviewPageDataSessionWorkflow(input: {
  bypassCache?: boolean;
  mediaSlug?: string;
  scope: "global" | "media";
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReviewPageData> {
  return loadReviewPageDataSession(input);
}

export async function runReviewSessionMutationWorkflow(
  input: ReviewSessionMutationWorkflowInput
): Promise<ReviewPageData> {
  const mediaRowsPromise = listMediaCached();
  const media = await resolveReviewSessionMedia(input);
  const mutationResult = await runReviewActionMutation({
    cardId: input.cardId,
    expectedMediaId: media?.id,
    kind: input.kind,
    suspended: input.suspended
  });

  applyReviewActionCachePolicy({
    includeCardContent: true,
    mediaId: mutationResult.mediaId,
    policy: mutationResult.cachePolicy
  });

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewAnchorCount: input.extraNewAnchorCount,
      extraNewCount: input.extraNewCount,
      notice: mutationResult.notice,
      redirectMode: input.redirectMode,
      segmentId: input.segmentId
    }),
    {
      bypassCache: true,
      resolvedMedia: media,
      resolvedMediaRows: await mediaRowsPromise
    }
  );
}

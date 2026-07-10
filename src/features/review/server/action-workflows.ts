import type { Route } from "next";

import { listMediaCached } from "@/features/cache/server/data-cache";
import {
  buildRedirectSearchParams,
  buildReviewRedirectUrl,
  type ReviewRedirectMode
} from "@/features/navigation";
import type {
  ReviewPageData,
  ReviewQueueCard
} from "@/features/review/types";
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

export async function gradeReviewCardFormWorkflow(
  input: ReviewFormGradeWorkflowInput
): Promise<Route> {
  const mediaId = await requireMediaIdForSlug(input.mediaSlug);
  const gradeResult = await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    rating:
      input.rating === "again" ||
      input.rating === "hard" ||
      input.rating === "good" ||
      input.rating === "easy"
        ? input.rating
        : "good"
  });

  applyReviewActionCachePolicy({
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
  }
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

  applyReviewActionCachePolicy({
    includeConsolidation: gradeResult.consolidationChanged,
    mediaId: gradeResult.mediaId,
    policy: "review"
  });

  return resolvePostGradeReviewSessionPageData({
    gradeResult,
    resolvedMedia: media,
    sessionInput: input
  });
}

export function prefetchReviewCardSessionWorkflow(input: {
  cardId: string;
}): Promise<ReviewQueueCard | null> {
  return hydrateReviewCard({
    cardId: input.cardId
  });
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

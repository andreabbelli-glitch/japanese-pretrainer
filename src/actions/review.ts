"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { readOptionalInternalHref, readRequiredString } from "./form-data.ts";
import { db } from "@/db";
import { loadReviewPageDataSession } from "@/lib/review-page-data";
import { listMediaCached } from "@/lib/data-cache";
import { applyReviewGrade } from "@/lib/review-service";
import { hydrateReviewCard } from "@/lib/review";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";
import {
  buildRedirectSearchParams,
  buildReviewRedirectUrl,
  type ReviewRedirectMode
} from "@/lib/site";
import { applyReviewActionCachePolicy } from "@/lib/review-action-cache-policy";
import {
  runReviewActionMutation,
  type ReviewMutationKind
} from "@/lib/review-action-mutations";
import {
  requireMediaIdForSlug,
  requireReviewPageDataForScope,
  resolvePostGradeReviewSessionPageData,
  resolveReviewSessionMedia,
  type ReviewSessionInput
} from "@/lib/review-session-transition";

type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;
type ReviewFormMutationInput = {
  answeredCount: number;
  cardId: string;
  extraNewCount: number;
  mediaSlug: string;
  redirectMode: ReviewRedirectMode;
  returnTo?: Route | null;
  suspended?: boolean;
};
type ReviewSessionMutationInput = ReviewSessionInput & {
  kind: ReviewMutationKind;
  redirectMode: ReviewSessionRedirectMode;
  suspended?: boolean;
};

export async function gradeReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const rating = readRequiredString(formData, "rating");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const expectedUpdatedAt = readOptionalString(formData, "expectedUpdatedAt");
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await applyReviewGrade({
    cardId,
    expectedMediaId: mediaId,
    expectedUpdatedAt,
    rating:
      rating === "again" ||
      rating === "hard" ||
      rating === "good" ||
      rating === "easy"
        ? rating
        : "good"
  });

  applyReviewActionCachePolicy({
    mediaId,
    policy: "review"
  });
  redirect(
    buildReviewRedirectUrl({
      answeredCount: answeredCount + 1,
      extraNewCount,
      mediaSlug
    })
  );
}

export async function markLinkedEntryKnownAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData),
    kind: "known"
  });
}

export async function setLinkedEntryLearningAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData),
    kind: "learning"
  });
}

export async function resetReviewCardAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData),
    kind: "reset"
  });
}

export async function setReviewCardSuspendedAction(formData: FormData) {
  await runReviewFormMutationAction({
    ...readReviewFormMutationInput(formData, {
      includeSuspended: true
    }),
    kind: "suspended"
  });
}

export async function gradeReviewCardSessionAction(
  input: ReviewSessionInput & {
    rating: "again" | "hard" | "good" | "easy";
  }
): Promise<ReviewPageData> {
  const media = await resolveReviewSessionMedia(input);
  const forcedContrast =
    input.forcedKanjiClashContrast ?? input.forcedContrast;

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
    mediaId: gradeResult.mediaId,
    policy: "review"
  });

  return resolvePostGradeReviewSessionPageData({
    gradeResult,
    resolvedMedia: media,
    sessionInput: input
  });
}

export async function prefetchReviewCardSessionAction(input: {
  cardId: string;
}): Promise<ReviewQueueCard | null> {
  return hydrateReviewCard({
    cardId: input.cardId
  });
}

export async function loadReviewPageDataSessionAction(input: {
  mediaSlug?: string;
  scope: "global" | "media";
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReviewPageData> {
  return loadReviewPageDataSession(input, db);
}

export async function markLinkedEntryKnownSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "known"
  });
}

export async function setLinkedEntryLearningSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "learning"
  });
}

export async function resetReviewCardSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "reset"
  });
}

export async function setReviewCardSuspendedSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
    suspended: boolean;
  }
): Promise<ReviewPageData> {
  return runReviewSessionMutationAction({
    ...input,
    kind: "suspended"
  });
}

function readReviewFormMutationInput(
  formData: FormData,
  options?: { includeSuspended?: boolean }
): ReviewFormMutationInput {
  return {
    answeredCount: readCount(formData, "answered"),
    cardId: readRequiredString(formData, "cardId"),
    extraNewCount: readCount(formData, "extraNew"),
    mediaSlug: readRequiredString(formData, "mediaSlug"),
    redirectMode: readRedirectMode(formData),
    returnTo: readOptionalInternalHref(formData, "returnTo"),
    suspended: options?.includeSuspended
      ? formData.get("suspended") === "true"
      : undefined
  };
}

async function runReviewFormMutationAction(
  input: ReviewFormMutationInput & { kind: ReviewMutationKind }
) {
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

  redirect(
    buildReviewRedirectUrl({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      mediaSlug: input.mediaSlug,
      notice: mutationResult.notice,
      redirectMode: input.redirectMode,
      returnTo: input.returnTo
    })
  );
}

async function runReviewSessionMutationAction(
  input: ReviewSessionMutationInput
): Promise<ReviewPageData> {
  const mediaRowsPromise = listMediaCached(db);
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


function readCount(formData: FormData, key: string) {
  const raw = formData.get(key);
  const normalized = typeof raw === "string" ? raw.trim() : "";

  if (!/^\d+$/u.test(normalized)) {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  const normalized = typeof value === "string" ? value.trim() : "";

  return normalized.length > 0 ? normalized : undefined;
}

function readRedirectMode(formData: FormData): ReviewRedirectMode {
  const value = formData.get("redirectMode");

  return value === "preserve_card" || value === "stay_detail"
    ? value
    : "advance_queue";
}

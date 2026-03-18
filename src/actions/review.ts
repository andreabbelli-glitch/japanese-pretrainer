"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, getMediaBySlug } from "@/db";
import {
  applyReviewGrade,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";
import {
  getGlobalReviewPageData,
  getReviewPageData,
  type ReviewPageData
} from "@/lib/review";
import { mediaHref, mediaReviewCardHref, mediaStudyHref, reviewHref } from "@/lib/site";

type ReviewRedirectMode = "advance_queue" | "preserve_card" | "stay_detail";
type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;
type ReviewSessionInput = {
  answeredCount: number;
  cardId: string;
  cardMediaSlug?: string;
  extraNewCount: number;
  mediaSlug?: string;
  scope?: "global" | "media";
};

export async function gradeReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const rating = readRequiredString(formData, "rating");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await applyReviewGrade({
    cardId,
    expectedMediaId: mediaId,
    rating:
      rating === "again" ||
      rating === "hard" ||
      rating === "good" ||
      rating === "easy"
        ? rating
        : "good"
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount: answeredCount + 1,
      extraNewCount,
      mediaSlug
    })
  );
}

export async function markLinkedEntryKnownAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await setLinkedEntryStatusByCard({
    cardId,
    expectedMediaId: mediaId,
    status: "known_manual"
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: "known"
    })
  );
}

export async function setLinkedEntryLearningAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await setLinkedEntryStatusByCard({
    cardId,
    expectedMediaId: mediaId,
    status: "learning"
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: "learning"
    })
  );
}

export async function resetReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await resetReviewCardProgress({
    cardId,
    expectedMediaId: mediaId
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: "reset"
    })
  );
}

export async function setReviewCardSuspendedAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");
  const redirectMode = readRedirectMode(formData);
  const suspended = formData.get("suspended") === "true";
  const mediaId = await requireMediaIdForSlug(mediaSlug);

  await setReviewCardSuspended({
    cardId,
    expectedMediaId: mediaId,
    suspended
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      extraNewCount,
      mediaSlug,
      redirectMode,
      notice: suspended ? "suspended" : "resumed"
    })
  );
}

export async function revealReviewAnswerSessionAction(
  input: ReviewSessionInput
): Promise<ReviewPageData> {
  return requireReviewPageDataForScope(
    input,
    buildReviewSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      showAnswer: true
    })
  );
}

export async function gradeReviewCardSessionAction(input: ReviewSessionInput & {
  rating: "again" | "hard" | "good" | "easy";
}): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await applyReviewGrade({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    rating: input.rating
  });

  revalidateReviewPaths(input.mediaSlug ?? input.cardMediaSlug, input.cardId);

  return requireReviewPageDataForScope(
    input,
    buildReviewSearchParams({
      answeredCount: input.answeredCount + 1,
      extraNewCount: input.extraNewCount
    })
  );
}

export async function markLinkedEntryKnownSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    status: "known_manual"
  });

  revalidateReviewPaths(input.mediaSlug ?? input.cardMediaSlug, input.cardId);

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "known",
      redirectMode: input.redirectMode
    })
  );
}

export async function setLinkedEntryLearningSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    status: "learning"
  });

  revalidateReviewPaths(input.mediaSlug ?? input.cardMediaSlug, input.cardId);

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "learning",
      redirectMode: input.redirectMode
    })
  );
}

export async function resetReviewCardSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await resetReviewCardProgress({
    cardId: input.cardId,
    expectedMediaId: mediaId
  });

  revalidateReviewPaths(input.mediaSlug ?? input.cardMediaSlug, input.cardId);

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: "reset",
      redirectMode: input.redirectMode
    })
  );
}

export async function setReviewCardSuspendedSessionAction(
  input: ReviewSessionInput & {
    redirectMode: ReviewSessionRedirectMode;
    suspended: boolean;
  }
): Promise<ReviewPageData> {
  const mediaId =
    input.scope === "media" && input.mediaSlug
      ? await requireMediaIdForSlug(input.mediaSlug)
      : undefined;

  await setReviewCardSuspended({
    cardId: input.cardId,
    expectedMediaId: mediaId,
    suspended: input.suspended
  });

  revalidateReviewPaths(input.mediaSlug ?? input.cardMediaSlug, input.cardId);

  return requireReviewPageDataForScope(
    input,
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: input.suspended ? "suspended" : "resumed",
      redirectMode: input.redirectMode
    })
  );
}

function buildReviewRedirectUrl(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  mediaSlug: string;
  redirectMode?: ReviewRedirectMode;
  notice?: string;
}): Route {
  if (input.redirectMode === "stay_detail" && input.cardId) {
    return mediaReviewCardHref(input.mediaSlug, input.cardId);
  }

  const params = new URLSearchParams(
    buildRedirectSearchParams({
      answeredCount: input.answeredCount,
      cardId: input.cardId,
      extraNewCount: input.extraNewCount,
      notice: input.notice,
      redirectMode: input.redirectMode
    })
  );

  const baseHref = mediaStudyHref(input.mediaSlug, "review");

  return (
    params.size > 0 ? `${baseHref}?${params.toString()}` : baseHref
  ) as Route;
}

function revalidateReviewPaths(mediaSlug: string | undefined, cardId: string) {
  revalidatePath("/");
  revalidatePath(reviewHref());
  revalidatePath("/glossary");

  if (!mediaSlug) {
    return;
  }

  revalidatePath(mediaHref(mediaSlug));
  revalidatePath(mediaStudyHref(mediaSlug, "progress"));
  revalidatePath(mediaStudyHref(mediaSlug, "review"));
  revalidatePath(mediaReviewCardHref(mediaSlug, cardId));
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
}

function readCount(formData: FormData, key: string) {
  const raw = formData.get(key);
  const parsed =
    typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readRedirectMode(formData: FormData): ReviewRedirectMode {
  const value = formData.get("redirectMode");

  return value === "preserve_card" || value === "stay_detail"
    ? value
    : "advance_queue";
}

function buildRedirectSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  notice?: string;
  redirectMode?: ReviewRedirectMode;
}) {
  return buildReviewSearchParams({
    answeredCount: input.answeredCount,
    cardId:
      input.cardId && input.redirectMode === "preserve_card"
        ? input.cardId
        : undefined,
    extraNewCount: input.extraNewCount,
    notice: input.notice
  });
}

function buildReviewSearchParams(input: {
  answeredCount: number;
  cardId?: string;
  extraNewCount?: number;
  notice?: string;
  showAnswer?: boolean;
}) {
  const params: Record<string, string> = {};

  if (input.answeredCount > 0) {
    params.answered = String(input.answeredCount);
  }

  if (input.cardId) {
    params.card = input.cardId;
  }

  if (input.extraNewCount && input.extraNewCount > 0) {
    params.extraNew = String(input.extraNewCount);
  }

  if (input.notice) {
    params.notice = input.notice;
  }

  if (input.showAnswer) {
    params.show = "answer";
  }

  return params;
}

async function requireReviewPageData(
  mediaSlug: string,
  searchParams: Record<string, string>
) {
  const data = await getReviewPageData(mediaSlug, searchParams);

  if (!data) {
    throw new Error(`Unable to load review page data for media: ${mediaSlug}`);
  }

  return data;
}

async function requireReviewPageDataForScope(
  input: Pick<ReviewSessionInput, "mediaSlug" | "scope">,
  searchParams: Record<string, string>
) {
  if (input.scope === "global") {
    return getGlobalReviewPageData(searchParams);
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  return requireReviewPageData(input.mediaSlug, searchParams);
}

async function requireMediaIdForSlug(mediaSlug: string) {
  const media = await getMediaBySlug(db, mediaSlug);

  if (!media) {
    throw new Error(`Unable to resolve media for slug: ${mediaSlug}`);
  }

  return media.id;
}

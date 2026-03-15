"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  applyReviewGrade,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";
import { getReviewPageData, type ReviewPageData } from "@/lib/review";
import { mediaHref, mediaReviewCardHref, mediaStudyHref } from "@/lib/site";

type ReviewRedirectMode = "advance_queue" | "preserve_card" | "stay_detail";
type ReviewSessionRedirectMode = Exclude<ReviewRedirectMode, "stay_detail">;
type ReviewSessionInput = {
  answeredCount: number;
  cardId: string;
  extraNewCount: number;
  mediaSlug: string;
};

export async function gradeReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const rating = readRequiredString(formData, "rating");
  const answeredCount = readCount(formData, "answered");
  const extraNewCount = readCount(formData, "extraNew");

  await applyReviewGrade({
    cardId,
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

  await setLinkedEntryStatusByCard({
    cardId,
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

  await setLinkedEntryStatusByCard({
    cardId,
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

  await resetReviewCardProgress({
    cardId
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

  await setReviewCardSuspended({
    cardId,
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
  return requireReviewPageData(
    input.mediaSlug,
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
  await applyReviewGrade({
    cardId: input.cardId,
    rating: input.rating
  });

  revalidateReviewPaths(input.mediaSlug, input.cardId);

  return requireReviewPageData(
    input.mediaSlug,
    buildRedirectSearchParams({
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
  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    status: "known_manual"
  });

  revalidateReviewPaths(input.mediaSlug, input.cardId);

  return requireReviewPageData(
    input.mediaSlug,
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
  await setLinkedEntryStatusByCard({
    cardId: input.cardId,
    status: "learning"
  });

  revalidateReviewPaths(input.mediaSlug, input.cardId);

  return requireReviewPageData(
    input.mediaSlug,
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
  await resetReviewCardProgress({
    cardId: input.cardId
  });

  revalidateReviewPaths(input.mediaSlug, input.cardId);

  return requireReviewPageData(
    input.mediaSlug,
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
  await setReviewCardSuspended({
    cardId: input.cardId,
    suspended: input.suspended
  });

  revalidateReviewPaths(input.mediaSlug, input.cardId);

  return requireReviewPageData(
    input.mediaSlug,
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

function revalidateReviewPaths(mediaSlug: string, cardId: string) {
  revalidatePath("/");
  revalidatePath("/glossary");
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

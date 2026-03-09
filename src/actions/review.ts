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
import { mediaHref, mediaReviewCardHref, mediaStudyHref } from "@/lib/site";

export async function gradeReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const rating = readRequiredString(formData, "rating");
  const answeredCount = readCount(formData, "answered");

  await applyReviewGrade({
    cardId,
    rating:
      rating === "again" || rating === "hard" || rating === "good" || rating === "easy"
        ? rating
        : "good"
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount: answeredCount + 1,
      mediaSlug
    })
  );
}

export async function markLinkedEntryKnownAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");

  await setLinkedEntryStatusByCard({
    cardId,
    status: "known_manual"
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      mediaSlug,
      notice: "known"
    })
  );
}

export async function setLinkedEntryLearningAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");

  await setLinkedEntryStatusByCard({
    cardId,
    status: "learning"
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      mediaSlug,
      notice: "learning"
    })
  );
}

export async function resetReviewCardAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");

  await resetReviewCardProgress({
    cardId
  });

  revalidateReviewPaths(mediaSlug, cardId);
  redirect(
    buildReviewRedirectUrl({
      answeredCount,
      cardId,
      mediaSlug,
      notice: "reset"
    })
  );
}

export async function setReviewCardSuspendedAction(formData: FormData) {
  const mediaSlug = readRequiredString(formData, "mediaSlug");
  const cardId = readRequiredString(formData, "cardId");
  const answeredCount = readCount(formData, "answered");
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
      mediaSlug,
      notice: suspended ? "suspended" : "resumed"
    })
  );
}

function buildReviewRedirectUrl(input: {
  answeredCount: number;
  cardId?: string;
  mediaSlug: string;
  notice?: string;
}): Route {
  const params = new URLSearchParams();

  if (input.answeredCount > 0) {
    params.set("answered", String(input.answeredCount));
  }

  if (input.cardId) {
    params.set("card", input.cardId);
  }

  if (input.notice) {
    params.set("notice", input.notice);
  }

  const baseHref = mediaStudyHref(input.mediaSlug, "review");

  return (params.size > 0 ? `${baseHref}?${params.toString()}` : baseHref) as Route;
}

function revalidateReviewPaths(mediaSlug: string, cardId: string) {
  revalidatePath(mediaHref(mediaSlug));
  revalidatePath(mediaStudyHref(mediaSlug, "glossary"));
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

"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { readOptionalInternalHref, readRequiredString } from "./form-data.ts";
import {
  gradeReviewCardFormWorkflow,
  gradeReviewCardSessionWorkflow,
  loadReviewPageDataSessionWorkflow,
  prefetchReviewCardSessionWorkflow,
  runReviewFormMutationWorkflow,
  runReviewSessionMutationWorkflow,
  type ReviewMutationKind,
  type ReviewPageData,
  type ReviewQueueCard,
  type ReviewSessionInput
} from "@/features/review/server";
import type { ReviewRedirectMode } from "@/features/navigation";

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
  const expectedUpdatedAt = readOptionalFreshnessToken(
    formData,
    "expectedUpdatedAt"
  );

  redirect(await gradeReviewCardFormWorkflow({
    answeredCount,
    cardId,
    expectedUpdatedAt,
    extraNewCount,
    mediaSlug,
    rating
  }));
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
  return gradeReviewCardSessionWorkflow(input);
}

export async function prefetchReviewCardSessionAction(input: {
  cardId: string;
}): Promise<ReviewQueueCard | null> {
  return prefetchReviewCardSessionWorkflow(input);
}

export async function loadReviewPageDataSessionAction(input: {
  mediaSlug?: string;
  scope: "global" | "media";
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReviewPageData> {
  return loadReviewPageDataSessionWorkflow(input);
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
  redirect(await runReviewFormMutationWorkflow(input));
}

async function runReviewSessionMutationAction(
  input: ReviewSessionMutationInput
): Promise<ReviewPageData> {
  return runReviewSessionMutationWorkflow(input);
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

function readOptionalFreshnessToken(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function readRedirectMode(formData: FormData): ReviewRedirectMode {
  const value = formData.get("redirectMode");

  return value === "preserve_card" || value === "stay_detail"
    ? value
    : "advance_queue";
}

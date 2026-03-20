import type { EntryType } from "../db/schema/enums.ts";

import type { ReviewState } from "./review-scheduler.ts";

export type ReviewEntryStatusValue =
  | "unknown"
  | "learning"
  | "known_manual"
  | "ignored"
  | null;

export type ReviewEntryLinkLike = {
  entryId: string;
  entryType: EntryType;
  relationshipType: string;
};

export type ReviewLessonCompletionLike = {
  lessonId: string | null;
  lesson?: {
    status?: string | null;
    progress?: {
      status: string | null;
    } | null;
  } | null;
};

export type EffectiveReviewState = {
  reason:
    | "card_suspended"
    | "card_manual_override"
    | "entry_ignored"
    | "entry_known_manual"
    | "review_state"
    | "unscheduled";
  state:
    | "ignored"
    | "known_manual"
    | "new"
    | "learning"
    | "review"
    | "relearning"
    | "suspended";
};

export function getDrivingEntryLinks(links: ReviewEntryLinkLike[]) {
  const primaryLinks = links.filter((link) => link.relationshipType === "primary");

  return primaryLinks.length > 0 ? primaryLinks : links;
}

export function resolveEffectiveReviewState(input: {
  cardStatus: string;
  drivingEntryStatuses: ReviewEntryStatusValue[];
  reviewState: {
    manualOverride: boolean;
    state: ReviewState | null;
  } | null;
}): EffectiveReviewState {
  if (input.cardStatus === "suspended" || input.reviewState?.state === "suspended") {
    return {
      reason: "card_suspended",
      state: "suspended"
    };
  }

  if (input.drivingEntryStatuses.includes("ignored")) {
    return {
      reason: "entry_ignored",
      state: "ignored"
    };
  }

  if (
    input.reviewState?.manualOverride ||
    input.reviewState?.state === "known_manual"
  ) {
    return {
      reason: "card_manual_override",
      state: "known_manual"
    };
  }

  if (input.drivingEntryStatuses.includes("known_manual")) {
    return {
      reason: "entry_known_manual",
      state: "known_manual"
    };
  }

  if (input.reviewState?.state) {
    return {
      reason: "review_state",
      state: input.reviewState.state
    };
  }

  return {
    reason: "unscheduled",
    state: "new"
  };
}

export function isReviewCardDue(input: {
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  reviewState: ReviewState | null;
  asOfIso: string;
}) {
  if (input.effectiveState === "known_manual" || input.effectiveState === "suspended") {
    return false;
  }

  if (input.reviewState === null || input.reviewState === "new") {
    return false;
  }

  if (!input.dueAt) {
    return true;
  }

  return input.dueAt <= input.asOfIso;
}

export function isReviewCardNew(reviewState: ReviewState | null) {
  return reviewState === null || reviewState === "new";
}

export function hasCompletedReviewLesson(
  card: ReviewLessonCompletionLike | null | undefined
) {
  return (
    Boolean(card?.lessonId) &&
    card?.lesson?.status === "active" &&
    card?.lesson?.progress?.status === "completed"
  );
}

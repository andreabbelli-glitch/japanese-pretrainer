import type {
  ReviewCardEntryLink,
  ReviewLessonCompletionSource
} from "./review-card-contract.ts";

import type { ReviewState } from "./review-scheduler.ts";

export type ReviewEntryLinkLike = ReviewCardEntryLink;

export type ReviewLessonCompletionLike = ReviewLessonCompletionSource;

export type EffectiveReviewState = {
  reason:
    | "card_suspended"
    | "card_manual_override"
    | "review_state"
    | "unscheduled";
  state:
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
  reviewState: {
    manualOverride: boolean;
    suspended: boolean;
    state: ReviewState | null;
  } | null;
}): EffectiveReviewState {
  if (input.cardStatus === "suspended" || input.reviewState?.state === "suspended") {
    return {
      reason: "card_suspended",
      state: "suspended"
    };
  }

  if (input.reviewState?.suspended) {
    return {
      reason: "card_suspended",
      state: "suspended"
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

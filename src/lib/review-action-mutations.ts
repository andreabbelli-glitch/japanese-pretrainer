import {
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";

import type { ReviewActionCachePolicy } from "./review-action-cache-policy";

export type ReviewMutationKind = "known" | "learning" | "reset" | "suspended";

export async function runReviewActionMutation(input: {
  cardId: string;
  expectedMediaId?: string;
  kind: ReviewMutationKind;
  suspended?: boolean;
}): Promise<{
  cachePolicy: ReviewActionCachePolicy;
  cardId: string;
  mediaId: string;
  notice: string;
}> {
  const mutationResult = await dispatchReviewActionMutation(input);

  return {
    cachePolicy: getReviewActionMutationCachePolicy(input.kind),
    cardId: mutationResult.cardId,
    mediaId: mutationResult.mediaId,
    notice: getReviewMutationNotice(input.kind, input.suspended)
  };
}

function dispatchReviewActionMutation(input: {
  cardId: string;
  expectedMediaId?: string;
  kind: ReviewMutationKind;
  suspended?: boolean;
}) {
  switch (input.kind) {
    case "known":
      return setLinkedEntryStatusByCard({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        status: "known_manual"
      });
    case "learning":
      return setLinkedEntryStatusByCard({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        status: "learning"
      });
    case "reset":
      return resetReviewCardProgress({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId
      });
    case "suspended":
      return setReviewCardSuspended({
        cardId: input.cardId,
        expectedMediaId: input.expectedMediaId,
        suspended: input.suspended === true
      });
  }
}

function getReviewActionMutationCachePolicy(
  kind: ReviewMutationKind
): ReviewActionCachePolicy {
  return kind === "known" || kind === "learning" ? "entry-status" : "review";
}

function getReviewMutationNotice(
  kind: ReviewMutationKind,
  suspended?: boolean
) {
  switch (kind) {
    case "known":
      return "known";
    case "learning":
      return "learning";
    case "reset":
      return "reset";
    case "suspended":
      return suspended ? "suspended" : "resumed";
  }
}

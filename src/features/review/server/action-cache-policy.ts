import {
  invalidateConsolidationMutationCaches,
  invalidateReviewMutationCaches,
  type ReviewMutationCachePolicy
} from "@/features/cache/server/invalidation-policy";

export type ReviewActionCachePolicy = ReviewMutationCachePolicy;

export function applyReviewActionCachePolicy(input: {
  affectedCardIds?: string[];
  includeCardContent?: boolean;
  includeConsolidation?: boolean;
  mediaId?: string;
  policy: ReviewActionCachePolicy;
}) {
  invalidateReviewMutationCaches(input);

  if (input.includeConsolidation) {
    invalidateConsolidationMutationCaches({
      mediaId: input.mediaId
    });
  }
}

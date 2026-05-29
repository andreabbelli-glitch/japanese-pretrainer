import {
  invalidateConsolidationMutationCaches,
  invalidateReviewMutationCaches,
  type ReviewMutationCachePolicy
} from "@/features/cache/server/invalidation-policy";

export type ReviewActionCachePolicy = ReviewMutationCachePolicy;

export function applyReviewActionCachePolicy(input: {
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

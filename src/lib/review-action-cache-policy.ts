import {
  invalidateReviewMutationCaches,
  type ReviewMutationCachePolicy
} from "@/lib/cache-invalidation-policy";

export type ReviewActionCachePolicy = ReviewMutationCachePolicy;

export function applyReviewActionCachePolicy(input: {
  mediaId?: string;
  policy: ReviewActionCachePolicy;
}) {
  invalidateReviewMutationCaches(input);
}

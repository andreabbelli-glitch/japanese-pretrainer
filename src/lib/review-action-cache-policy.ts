import {
  updateGlossarySummaryCache,
  updateReviewSummaryCache
} from "@/lib/data-cache";

export type ReviewActionCachePolicy = "review" | "entry-status";

export function applyReviewActionCachePolicy(input: {
  mediaId?: string;
  policy: ReviewActionCachePolicy;
}) {
  updateReviewSummaryCache(input.mediaId);

  if (input.policy !== "entry-status") {
    return;
  }

  updateGlossarySummaryCache();

  if (input.mediaId) {
    updateGlossarySummaryCache(input.mediaId);
  }
}

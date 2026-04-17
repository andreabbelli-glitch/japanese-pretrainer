"use client";

import type { ReviewPageClientData } from "./review-page-state";
import { MemoizedReviewPageSidebar } from "./review-page-sidebar";
import { ReviewPageStage } from "./review-page-stage";
import { useReviewPageController } from "./use-review-page-controller";

export function ReviewPageClient({
  data,
  searchParams
}: {
  data: ReviewPageClientData;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const controller = useReviewPageController({
    data,
    searchParams
  });

  return (
    <div className="review-page">
      <section className="hero-grid hero-grid--detail review-workspace">
        <ReviewPageStage
          additionalNewCount={controller.additionalNewCount}
          contextualGlossaryHref={controller.contextualGlossaryHref}
          fullSelectedCard={controller.fullSelectedCard}
          gradePreviewLookup={controller.gradePreviewLookup}
          handleGradeCard={controller.handleGradeCard}
          handleMarkKnown={controller.handleMarkKnown}
          handleResetCard={controller.handleResetCard}
          handleRevealAnswer={controller.handleRevealAnswer}
          handleSetLearning={controller.handleSetLearning}
          handleToggleSuspended={controller.handleToggleSuspended}
          hasSupportCards={controller.hasSupportCards}
          isAnswerRevealed={controller.isAnswerRevealed}
          isFullReviewPageData={controller.isFullReviewPageData}
          isGlobalReview={controller.isGlobalReview}
          isHydratingFullData={controller.isHydratingFullData}
          isPending={controller.isPending}
          remainingCount={controller.remainingCount}
          sessionHref={controller.sessionHref}
          showCompletionState={controller.showCompletionState}
          showFrontFurigana={controller.showFrontFurigana}
          viewData={controller.viewData}
        />
        <MemoizedReviewPageSidebar
          clientError={controller.clientError}
          isGlobalReview={controller.isGlobalReview}
          isPending={controller.isPending}
          viewData={controller.viewData}
        />
      </section>
    </div>
  );
}

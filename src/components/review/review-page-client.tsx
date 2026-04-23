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
          forcedContrastInputRef={controller.forcedContrastInputRef}
          forcedContrastListboxId={controller.forcedContrastListboxId}
          forcedContrastQuery={controller.forcedContrastQuery}
          forcedContrastSelection={controller.forcedContrastSelection}
          forcedContrastShouldShowSuggestions={
            controller.forcedContrastShouldShowSuggestions
          }
          forcedContrastSuggestions={controller.forcedContrastSuggestions}
          fullSelectedCard={controller.fullSelectedCard}
          gradePreviewLookup={controller.gradePreviewLookup}
          handleCloseForcedContrast={controller.handleCloseForcedContrast}
          handleForcedContrastQueryChange={
            controller.handleForcedContrastQueryChange
          }
          handleForcedContrastSelect={controller.handleForcedContrastSelect}
          handleGradeCard={controller.handleGradeCard}
          handleMarkKnown={controller.handleMarkKnown}
          handleOpenForcedContrast={controller.handleOpenForcedContrast}
          handleResetCard={controller.handleResetCard}
          handleRevealAnswer={controller.handleRevealAnswer}
          handleRemoveForcedContrast={controller.handleRemoveForcedContrast}
          handleSetLearning={controller.handleSetLearning}
          handleToggleSuspended={controller.handleToggleSuspended}
          hasSupportCards={controller.hasSupportCards}
          isAnswerRevealed={controller.isAnswerRevealed}
          isForcedContrastOpen={controller.isForcedContrastOpen}
          isFullReviewPageData={controller.isFullReviewPageData}
          isGlobalReview={controller.isGlobalReview}
          isGradeControlsDisabled={controller.isGradeControlsDisabled}
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

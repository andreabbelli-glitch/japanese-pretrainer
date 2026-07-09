"use client";

import Link from "next/link";

import { reviewHref } from "@/features/navigation";

import type { ReviewPageClientData } from "./review-page-state";
import { MemoizedReviewPageSidebar } from "./review-page-sidebar";
import { ReviewPageStage } from "./review-page-stage";
import { useReviewPageController } from "./use-review-page-controller";

export function ReviewPageHeader({
  isGlobalReview,
  mediaTitle
}: {
  isGlobalReview: boolean;
  mediaTitle: string;
}) {
  const reviewTitle = isGlobalReview
    ? "Review globale"
    : `Review · ${mediaTitle}`;

  return (
    <header className="review-page__heading">
      <div className="review-page__heading-copy">
        <p className="eyebrow">Review</p>
        <h1>{reviewTitle}</h1>
        <p>
          {isGlobalReview
            ? "Ripassa le card pronte, senza perdere il contesto del media da cui arrivano."
            : "Stessa Review, filtrata sulle card di questo media."}
        </p>
      </div>

      {!isGlobalReview ? (
        <div className="review-page__scope">
          <span className="chip">Filtro media</span>
          <Link className="text-link" href={reviewHref()}>
            Torna alla Review globale
          </Link>
        </div>
      ) : null}
    </header>
  );
}

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
    <div className="review-page" data-testid="review-page">
      <ReviewPageHeader
        isGlobalReview={controller.isGlobalReview}
        mediaTitle={controller.viewData.media.title}
      />

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
          handleRefreshQueue={controller.handleRefreshQueue}
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

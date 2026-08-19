import { SurfaceCard } from "../ui/surface-card";
import { ReviewPageActiveCard } from "./review-page-active-card";
import { ReviewPageStageEmptyState } from "./review-page-stage-empty-state";
import type { ReviewPageStageProps } from "./review-page-stage-types";

export { ReviewForcedContrastAutocomplete } from "./review-forced-contrast-autocomplete";

export function ReviewPageStage(props: ReviewPageStageProps) {
  const { viewData } = props;
  const { selectedCard } = viewData;

  return (
    <SurfaceCard className="review-stage" testId="review-stage" variant="hero">
      {selectedCard ? (
        <ReviewPageActiveCard
          actions={{
            handleGradeCard: props.handleGradeCard,
            handleMarkKnown: props.handleMarkKnown,
            handleResetCard: props.handleResetCard,
            handleRevealAnswer: props.handleRevealAnswer,
            handleSetLearning: props.handleSetLearning,
            handleToggleSuspended: props.handleToggleSuspended
          }}
          contrast={{
            forcedContrastInputRef: props.forcedContrastInputRef,
            forcedContrastListboxId: props.forcedContrastListboxId,
            forcedContrastQuery: props.forcedContrastQuery,
            forcedContrastSelection: props.forcedContrastSelection,
            forcedContrastShouldShowSuggestions:
              props.forcedContrastShouldShowSuggestions,
            forcedContrastSuggestions: props.forcedContrastSuggestions,
            handleCloseForcedContrast: props.handleCloseForcedContrast,
            handleForcedContrastQueryChange:
              props.handleForcedContrastQueryChange,
            handleForcedContrastSelect: props.handleForcedContrastSelect,
            handleOpenForcedContrast: props.handleOpenForcedContrast,
            handleRemoveForcedContrast: props.handleRemoveForcedContrast,
            isForcedContrastOpen: props.isForcedContrastOpen
          }}
          model={{
            fullSelectedCard: props.fullSelectedCard,
            gradePreviewLookup: props.gradePreviewLookup,
            isAnswerRevealed: props.isAnswerRevealed,
            isFullReviewPageData: props.isFullReviewPageData,
            isGradeControlsDisabled: props.isGradeControlsDisabled,
            isHydratingFullData: props.isHydratingFullData,
            isPending: props.isPending,
            remainingCount: props.remainingCount,
            selectedCard,
            sessionHref: props.sessionHref,
            showFrontFurigana: props.showFrontFurigana,
            viewData
          }}
        />
      ) : (
        <ReviewPageStageEmptyState
          additionalNewCount={props.additionalNewCount}
          contextualGlossaryHref={props.contextualGlossaryHref}
          handleRefreshQueue={props.handleRefreshQueue}
          hasSupportCards={props.hasSupportCards}
          isGlobalReview={props.isGlobalReview}
          isPending={props.isPending}
          showCompletionState={props.showCompletionState}
          viewData={viewData}
        />
      )}
    </SurfaceCard>
  );
}

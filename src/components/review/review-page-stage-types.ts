import type { Route } from "next";
import type { RefObject } from "react";

import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";
import type { ReviewQueueCard } from "@/features/review/client";

import type { ReviewGradeValue } from "./review-page-helpers";
import type {
  ReviewForcedContrastSelection,
  ReviewPageClientData
} from "./review-page-state";

export type ReviewPageStageProps = {
  additionalNewCount: number;
  contextualGlossaryHref: Route;
  forcedContrastInputRef: RefObject<HTMLInputElement | null>;
  forcedContrastListboxId: string;
  forcedContrastQuery: string;
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  forcedContrastShouldShowSuggestions: boolean;
  forcedContrastSuggestions: GlobalGlossaryAutocompleteSuggestion[];
  fullSelectedCard: ReviewQueueCard | null;
  gradePreviewLookup: Map<string, string>;
  handleCloseForcedContrast: () => void;
  handleForcedContrastQueryChange: (value: string) => void;
  handleForcedContrastSelect: (
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) => void;
  handleGradeCard: (rating: ReviewGradeValue) => void;
  handleMarkKnown: () => void;
  handleOpenForcedContrast: () => void;
  handleResetCard: () => void;
  handleRevealAnswer: () => void;
  handleRemoveForcedContrast: () => void;
  handleRefreshQueue: () => void;
  handleSetLearning: () => void;
  handleToggleSuspended: () => void;
  hasSupportCards: boolean;
  isAnswerRevealed: boolean;
  isForcedContrastOpen: boolean;
  isFullReviewPageData: boolean;
  isGlobalReview: boolean;
  isGradeControlsDisabled: boolean;
  isHydratingFullData: boolean;
  isPending: boolean;
  remainingCount: number;
  sessionHref: Route;
  showCompletionState: boolean;
  showFrontFurigana: boolean;
  viewData: ReviewPageClientData;
};

export type ReviewActiveCardViewModel = Pick<
  ReviewPageStageProps,
  | "fullSelectedCard"
  | "gradePreviewLookup"
  | "isAnswerRevealed"
  | "isFullReviewPageData"
  | "isGradeControlsDisabled"
  | "isHydratingFullData"
  | "isPending"
  | "remainingCount"
  | "sessionHref"
  | "showFrontFurigana"
  | "viewData"
> & {
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>;
};

export type ReviewActiveCardActions = Pick<
  ReviewPageStageProps,
  | "handleGradeCard"
  | "handleMarkKnown"
  | "handleResetCard"
  | "handleRevealAnswer"
  | "handleSetLearning"
  | "handleToggleSuspended"
>;

export type ReviewForcedContrastControl = Pick<
  ReviewPageStageProps,
  | "forcedContrastInputRef"
  | "forcedContrastListboxId"
  | "forcedContrastQuery"
  | "forcedContrastSelection"
  | "forcedContrastShouldShowSuggestions"
  | "forcedContrastSuggestions"
  | "handleCloseForcedContrast"
  | "handleForcedContrastQueryChange"
  | "handleForcedContrastSelect"
  | "handleOpenForcedContrast"
  | "handleRemoveForcedContrast"
  | "isForcedContrastOpen"
>;

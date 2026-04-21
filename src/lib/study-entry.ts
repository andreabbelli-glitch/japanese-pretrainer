export type EntryStudySignal = {
  reviewState: string | null;
  manualOverride: boolean | null;
};

export type DerivedStudyStateKey =
  | "known"
  | "review"
  | "learning"
  | "new"
  | "available";

export type DerivedStudyState = {
  key: DerivedStudyStateKey;
  label: string;
  hasCardsInReview: boolean;
  hasKnownSignal: boolean;
};

export function deriveEntryStudyState(
  studySignals: EntryStudySignal[] | null | undefined
): DerivedStudyState {
  let hasKnownSignal = false;
  let hasLearningCards = false;
  let hasCardsInReview = false;
  let hasNewCards = false;

  for (const signal of studySignals ?? []) {
    if (signal.reviewState === "known_manual" || signal.manualOverride) {
      hasKnownSignal = true;
      break;
    }

    if (signal.reviewState === "learning") {
      hasLearningCards = true;
      continue;
    }

    if (signal.reviewState === "review" || signal.reviewState === "relearning") {
      hasCardsInReview = true;
      continue;
    }

    if (signal.reviewState === "new") {
      hasNewCards = true;
    }
  }

  if (hasKnownSignal) {
    return {
      key: "known",
      label: "Già nota",
      hasCardsInReview: false,
      hasKnownSignal: true
    };
  }

  if (hasLearningCards) {
    return {
      key: "learning",
      label: "In studio",
      hasCardsInReview: true,
      hasKnownSignal: false
    };
  }

  if (hasCardsInReview) {
    return {
      key: "review",
      label: "In review",
      hasCardsInReview: true,
      hasKnownSignal: false
    };
  }

  if (hasNewCards) {
    return {
      key: "new",
      label: "Nuova",
      hasCardsInReview: false,
      hasKnownSignal: false
    };
  }

  return {
    key: "available",
    label: "Disponibile",
    hasCardsInReview: false,
    hasKnownSignal: false
  };
}

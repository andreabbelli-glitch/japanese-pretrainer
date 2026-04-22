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

const DERIVED_STUDY_STATE_LABELS: Record<DerivedStudyStateKey, string> = {
  known: "Già nota",
  learning: "In studio",
  review: "In review",
  new: "Nuova",
  available: "Disponibile"
};

export function formatDerivedStudyStateLabel(
  value: DerivedStudyStateKey | string
) {
  return DERIVED_STUDY_STATE_LABELS[value as DerivedStudyStateKey] ?? "Disponibile";
}

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
      label: formatDerivedStudyStateLabel("known"),
      hasCardsInReview: false,
      hasKnownSignal: true
    };
  }

  if (hasLearningCards) {
    return {
      key: "learning",
      label: formatDerivedStudyStateLabel("learning"),
      hasCardsInReview: true,
      hasKnownSignal: false
    };
  }

  if (hasCardsInReview) {
    return {
      key: "review",
      label: formatDerivedStudyStateLabel("review"),
      hasCardsInReview: true,
      hasKnownSignal: false
    };
  }

  if (hasNewCards) {
    return {
      key: "new",
      label: formatDerivedStudyStateLabel("new"),
      hasCardsInReview: false,
      hasKnownSignal: false
    };
  }

  return {
    key: "available",
    label: formatDerivedStudyStateLabel("available"),
    hasCardsInReview: false,
    hasKnownSignal: false
  };
}

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
  const signals = studySignals ?? [];
  const hasKnownSignal =
    signals.some(
      (signal) =>
        signal.reviewState === "known_manual" || signal.manualOverride
    );

  if (hasKnownSignal) {
    return {
      key: "known",
      label: "Già nota",
      hasCardsInReview: false,
      hasKnownSignal: true
    };
  }

  const hasLearningCards = signals.some(
    (signal) => signal.reviewState === "learning"
  );

  if (hasLearningCards) {
    return {
      key: "learning",
      label: "In studio",
      hasCardsInReview: true,
      hasKnownSignal: false
    };
  }

  const hasCardsInReview = signals.some((signal) =>
    ["review", "relearning"].includes(signal.reviewState ?? "")
  );

  if (hasCardsInReview) {
    return {
      key: "review",
      label: "In review",
      hasCardsInReview,
      hasKnownSignal: false
    };
  }

  if (signals.some((signal) => signal.reviewState === "new")) {
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

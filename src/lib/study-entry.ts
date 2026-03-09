import { formatEntryStatusLabel } from "@/lib/study-format";

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
  entryStatus: string | null,
  studySignals: EntryStudySignal[]
): DerivedStudyState {
  const hasKnownSignal =
    entryStatus === "known_manual" ||
    studySignals.some(
      (signal) =>
        signal.reviewState === "known_manual" || signal.manualOverride
    );

  if (hasKnownSignal) {
    return {
      key: "known",
      label: "Gia nota",
      hasCardsInReview: false,
      hasKnownSignal: true
    };
  }

  const hasLearningCards = studySignals.some(
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

  const hasCardsInReview = studySignals.some((signal) =>
    ["review", "relearning"].includes(signal.reviewState ?? "")
  );

  if (hasCardsInReview || ["review", "reviewing", "relearning"].includes(entryStatus ?? "")) {
    return {
      key: "review",
      label: "In review",
      hasCardsInReview,
      hasKnownSignal: false
    };
  }

  if (entryStatus === "learning") {
    return {
      key: "learning",
      label: "In studio",
      hasCardsInReview: false,
      hasKnownSignal: false
    };
  }

  if (
    entryStatus === "new" ||
    entryStatus === "unknown" ||
    studySignals.some((signal) => signal.reviewState === "new")
  ) {
    return {
      key: "new",
      label: "Nuova",
      hasCardsInReview: false,
      hasKnownSignal: false
    };
  }

  return {
    key: "available",
    label: formatEntryStatusLabel(entryStatus),
    hasCardsInReview: false,
    hasKnownSignal: false
  };
}

export const reviewRecallTaskValues = [
  "recognition",
  "concept",
  "other"
] as const;
export type ReviewRecallTask = (typeof reviewRecallTaskValues)[number];

export const REVIEW_MEMORY_KEY_VERSION = "mnemonic:v1";

export const reviewEventKindValues = [
  "grade",
  "reset",
  "reschedule",
  "manual"
] as const;
export type ReviewEventKind = (typeof reviewEventKindValues)[number];

export const reviewAlgorithmVersionValues = ["fsrs6"] as const;
export type ReviewAlgorithmVersion =
  (typeof reviewAlgorithmVersionValues)[number];

export const reviewCanonicalControlStatusValues = [
  "known_manual",
  "learning",
  "ignored"
] as const;
export type ReviewCanonicalControlStatus =
  (typeof reviewCanonicalControlStatusValues)[number];

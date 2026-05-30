import type {
  PitchAccentPairOption,
  PitchAccentPatternFilter,
  PitchAccentPatternKey,
  PitchAccentSessionTrialPlan
} from "../types";

export type StartPitchAccentSessionResult = {
  readonly sessionId: string;
  readonly trials: readonly PitchAccentSessionTrialPlan[];
};

export type SubmitPitchAccentAnswerResult = {
  readonly chosenOptionId: string;
  readonly correctOptionId: string;
  readonly idempotent: boolean;
  readonly isCorrect: boolean;
};

export type PitchAccentSessionSummary = {
  readonly correctAttempts: number;
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly filters: PitchAccentPatternFilter;
  readonly patternStats: Readonly<
    Record<PitchAccentPatternKey, PitchAccentPatternStats>
  >;
  readonly sessionId: string;
  readonly startedAt: string;
  readonly status: "active" | "completed" | "abandoned";
  readonly totalAttempts: number;
  readonly totalTrials: number;
};

export type PitchAccentPatternStats = {
  readonly correct: number;
  readonly total: number;
};

export type PitchAccentPageData = {
  readonly availableMoraCounts: readonly number[];
  readonly corpusPairCount: number;
  readonly recentSession: PitchAccentSessionSummary | null;
};

export type PitchAccentSessionPageData = StartPitchAccentSessionResult & {
  readonly answeredCount: number;
  readonly filters: PitchAccentPatternFilter;
  readonly startedAt: string;
  readonly status: "active" | "completed" | "abandoned";
};

export type PitchAccentAttemptSummary = {
  readonly chosenOptionId: string;
  readonly correctOptionId: string;
  readonly createdAt: string;
  readonly inputMethod: string | null;
  readonly isCorrect: boolean;
  readonly kana: string;
  readonly pairId: string;
  readonly patternKey: PitchAccentPatternKey;
  readonly responseMs: number;
  readonly sortOrder: number;
  readonly trialId: string;
};

export type PitchAccentRecapPageData = {
  readonly attempts: readonly PitchAccentAttemptSummary[];
  readonly session: PitchAccentSessionSummary;
};

export type PitchAccentTrialSnapshot = {
  readonly correctOptionId: string;
  readonly correctPatternKey: PitchAccentPatternKey;
  readonly kana: string;
  readonly options: readonly PitchAccentPairOption[];
  readonly pairId: string;
  readonly sessionId: string;
  readonly sortOrder: number;
  readonly trialId: string;
};

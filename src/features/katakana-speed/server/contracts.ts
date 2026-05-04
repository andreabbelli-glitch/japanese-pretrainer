import type { KatakanaSpeedAnalytics } from "../model/analytics";
import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedSelfRating,
  KatakanaSpeedTrialMode,
  KatakanaSpeedTrialPlan
} from "../types";

export type { KatakanaSpeedSelfRating } from "../types";

export type StartKatakanaSpeedSessionResult = {
  readonly sessionId: string;
  readonly trials: readonly KatakanaSpeedTrialPlan[];
};

export type SubmitKatakanaSpeedAnswerResult = {
  readonly idempotent: boolean;
  readonly isCorrect: boolean;
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
};

export type SubmitKatakanaSpeedSelfCheckResult = {
  readonly idempotent: boolean;
  readonly isCorrect: boolean;
  readonly selfRating: KatakanaSpeedSelfRating;
};

export type AggregateKatakanaSpeedExerciseResult = {
  readonly idempotent: boolean;
  readonly resultId: string;
};

export type KatakanaSpeedSessionRecap = {
  readonly correctAttempts: number;
  readonly durationMs: number | null;
  readonly medianRtMs: number | null;
  readonly p90RtMs: number | null;
  readonly slowCorrectCount: number;
  readonly status: "completed" | "abandoned";
  readonly totalAttempts: number;
};

export type KatakanaSpeedFocusItem = {
  readonly itemId: string;
  readonly reason: string;
  readonly surface: string;
};

export type KatakanaSpeedSessionSummary = {
  readonly correctAttempts: number;
  readonly durationMs: number | null;
  readonly endedAt: string | null;
  readonly medianRtMs: number | null;
  readonly p90RtMs: number | null;
  readonly recommendedFocus: readonly KatakanaSpeedFocusItem[];
  readonly sessionId: string;
  readonly slowCorrectCount: number;
  readonly startedAt: string;
  readonly status: "active" | "completed" | "abandoned";
  readonly totalAttempts: number;
};

export type KatakanaSpeedPageData = {
  readonly analytics: KatakanaSpeedAnalytics;
  readonly catalogSize: number;
  readonly recentSession: KatakanaSpeedSessionSummary | null;
  readonly recommendedFocus: readonly KatakanaSpeedFocusItem[];
};

export type KatakanaSpeedSessionPageData = StartKatakanaSpeedSessionResult & {
  readonly answeredCount: number;
  readonly startedAt: string;
  readonly status: "active" | "completed" | "abandoned";
};

export type KatakanaSpeedAttemptSummary = {
  readonly createdAt: string;
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
  readonly expectedAnswer: string;
  readonly expectedSurface: string;
  readonly features: Readonly<Record<string, unknown>>;
  readonly focusChunks: readonly string[];
  readonly isCorrect: boolean;
  readonly itemId: string;
  readonly itemType: string | null;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly mode: KatakanaSpeedTrialMode | string;
  readonly promptSurface: string;
  readonly responseMs: number;
  readonly selfRating: KatakanaSpeedSelfRating | null;
  readonly targetRtMs: number | null;
  readonly userAnswer: string;
  readonly wasPseudo: boolean;
  readonly wasRepair: boolean;
  readonly wasTransfer: boolean;
};

export type KatakanaSpeedExerciseResultSummary = {
  readonly blockId: string | null;
  readonly createdAt: string;
  readonly exerciseId: string;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly resultId: string;
  readonly selfRating: KatakanaSpeedSelfRating | null;
  readonly sortOrder: number;
  readonly trialId: string | null;
};

export type KatakanaSpeedRecapPageData = {
  readonly analytics: KatakanaSpeedAnalytics;
  readonly attempts: readonly KatakanaSpeedAttemptSummary[];
  readonly exerciseResults: readonly KatakanaSpeedExerciseResultSummary[];
  readonly session: KatakanaSpeedSessionSummary;
};

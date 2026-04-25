import type { EntryType } from "@/domain/content";

export type KanjiClashEligibleReviewState = "review" | "relearning";

export type KanjiClashSubjectSource =
  | {
      type: "entry";
      entryId: string;
    }
  | {
      type: "group";
      crossMediaGroupId: string;
    }
  | {
      type: "card";
      cardId: string;
    };

export type KanjiClashEligibleSubjectMember = {
  entryId: string;
  lemma: string;
  meaningIt: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  reading: string;
};

export type KanjiClashEligibleSubject = {
  entryType: EntryType | null;
  kanji: string[];
  label: string;
  members: KanjiClashEligibleSubjectMember[];
  reading: string | null;
  readingForms: string[];
  reps: number;
  reviewState: KanjiClashEligibleReviewState;
  source: KanjiClashSubjectSource;
  stability: number;
  subjectKey: string;
  surfaceForms: string[];
};

export type KanjiClashPairReason = "shared-kanji" | "similar-kanji";

export type KanjiClashSimilarKanjiSwap = {
  confidence: number;
  leftKanji: string;
  position: number;
  rightKanji: string;
};

export type SimilarKanjiDatasetRules = {
  minimumMetricScore: number;
  rulesVersion: number;
};

export type SimilarKanjiDatasetEntry = {
  confidence: number;
  leftKanji: string;
  rightKanji: string;
  sources: {
    manualExclude: boolean;
    manualInclude: boolean;
    strokeEditDistance: number | null;
    whiteRabbit: boolean;
    yehAndLiRadical: number | null;
  };
};

export type SimilarKanjiDataset = {
  generatedAt: string;
  rules: SimilarKanjiDatasetRules;
  swaps: SimilarKanjiDatasetEntry[];
};

export type BuildSimilarKanjiDatasetInput = {
  generatedAt: string;
  manualExcludes?: ReadonlyArray<readonly [string, string]>;
  manualIncludes?: ReadonlyArray<readonly [string, string]>;
  minimumMetricScore: number;
  rulesVersion: number;
  strokeEditDistance?: ReadonlyArray<readonly [string, string, number]>;
  whiteRabbit?: ReadonlyArray<readonly [string, string]>;
  yehAndLiRadical?: ReadonlyArray<readonly [string, string, number]>;
};

export type KanjiClashCandidate = {
  left: KanjiClashEligibleSubject;
  leftSubjectKey: string;
  pairKey: string;
  pairReasons: KanjiClashPairReason[];
  right: KanjiClashEligibleSubject;
  rightSubjectKey: string;
  roundOverride?: KanjiClashCandidateRoundOverride;
  score: number;
  sharedKanji: string[];
  similarKanjiSwaps: KanjiClashSimilarKanjiSwap[];
};

export type KanjiClashSessionMode = "automatic" | "manual";
export type KanjiClashScope = "global" | "media";
export type KanjiClashRoundSide = "left" | "right";
export type KanjiClashRoundSource = "due" | "new" | "reserve";
export type KanjiClashManualContrastDirection = "subject_a" | "subject_b";
export type KanjiClashRoundOrigin =
  | {
      type: "pair";
    }
  | {
      contrastKey: string;
      direction: KanjiClashManualContrastDirection;
      type: "manual-contrast";
    };

export type KanjiClashCandidateRoundOverride = {
  origin: KanjiClashRoundOrigin;
  roundKey: string;
  targetSubjectKey: string;
};

export type KanjiClashPairResult = "again" | "good";
export type KanjiClashPairStateStatus =
  | "new"
  | "learning"
  | "review"
  | "relearning"
  | "suspended"
  | "known_manual";
export type KanjiClashSchedulerVersion = "kanji_clash_fsrs_v1";
export type KanjiClashSchedulerRuntimeConfig = {
  desiredRetention?: number | null;
  weights?: number[] | null;
};

export type KanjiClashPairState = {
  createdAt: string;
  difficulty: number | null;
  dueAt: string | null;
  lapses: number;
  lastInteractionAt: string;
  lastReviewedAt: string | null;
  learningSteps: number;
  leftSubjectKey: string;
  pairKey: string;
  reps: number;
  rightSubjectKey: string;
  scheduledDays: number;
  schedulerVersion: KanjiClashSchedulerVersion;
  stability: number | null;
  state: KanjiClashPairStateStatus;
  updatedAt: string;
};

export type KanjiClashPairStateSnapshot = Omit<
  KanjiClashPairState,
  "createdAt" | "updatedAt"
>;

export type ScheduleKanjiClashPairResult = {
  difficulty: number;
  dueAt: string;
  elapsedDays: number | null;
  lapses: number;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  schedulerVersion: KanjiClashSchedulerVersion;
  stability: number;
  state: KanjiClashPairStateStatus;
};

export type KanjiClashPairTransition = {
  next: KanjiClashPairState;
  previous: KanjiClashPairStateSnapshot;
  scheduled: ScheduleKanjiClashPairResult;
};

export type KanjiClashSessionRound = {
  candidate: KanjiClashCandidate;
  correctSubjectKey: string;
  left: KanjiClashEligibleSubject;
  leftSubjectKey: string;
  origin: KanjiClashRoundOrigin;
  pairKey: string;
  pairState: KanjiClashPairState | null;
  right: KanjiClashEligibleSubject;
  rightSubjectKey: string;
  roundKey: string;
  source: KanjiClashRoundSource;
  target: KanjiClashEligibleSubject;
  targetPlacement: KanjiClashRoundSide;
  targetSubjectKey: string;
};

export type KanjiClashQueueSnapshot = {
  awaitingConfirmation: boolean;
  currentRoundIndex: number;
  dailyNewLimit: number | null;
  dueCount: number;
  finished: boolean;
  introducedTodayCount: number;
  mode: KanjiClashSessionMode;
  newAvailableCount: number;
  newQueuedCount: number;
  remainingCount: number;
  requestedSize: number | null;
  reserveCount: number;
  rounds: KanjiClashSessionRound[];
  snapshotAtIso: string;
  scope: KanjiClashScope;
  seenPairKeys: string[];
  seenRoundKeys: string[];
  totalCount: number;
};

export type KanjiClashPageMediaOption = {
  id: string;
  slug: string;
  title: string;
};

export type KanjiClashPageSettings = {
  dailyNewLimit: number;
  defaultScope: "global" | "media";
  manualDefaultSize: number;
  manualSizeOptions: readonly number[];
};

export type KanjiClashManualContrastSummary = {
  contrastKey: string;
  leftLabel: string;
  leftSubjectKey: string;
  rightLabel: string;
  rightSubjectKey: string;
  source: "manual" | "forced";
  status: "active" | "suspended" | "archived";
};

export type KanjiClashPageData = {
  availableMedia: KanjiClashPageMediaOption[];
  currentRound: KanjiClashSessionRound | null;
  manualContrasts: KanjiClashManualContrastSummary[];
  mode: KanjiClashSessionMode;
  queue: KanjiClashQueueSnapshot;
  queueToken: string;
  scope: KanjiClashScope;
  selectedMedia: KanjiClashPageMediaOption | null;
  settings: KanjiClashPageSettings;
  snapshotAtIso: string;
};

export type KanjiClashAnswerSubmissionPayload = {
  expectedPairKey: string;
  expectedPairStateUpdatedAt: string | null;
  expectedRoundKey?: string | null;
  queueToken: string;
  selectedSide: KanjiClashRoundSide;
};

export type KanjiClashSessionActionResult = {
  answeredRound: KanjiClashSessionRound;
  isCorrect: boolean;
  logId: string;
  nextQueue: KanjiClashQueueSnapshot;
  nextQueueToken: string;
  nextRound: KanjiClashSessionRound | null;
  pairState: KanjiClashPairState;
  previousPairState: KanjiClashPairStateSnapshot;
  result: KanjiClashPairResult;
  scheduled: ScheduleKanjiClashPairResult;
  selectedSubjectKey: string;
};

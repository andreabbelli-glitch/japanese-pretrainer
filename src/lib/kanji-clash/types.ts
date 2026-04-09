export type KanjiClashEligibleReviewState = "review" | "relearning";

export type KanjiClashSubjectSource =
  | {
      type: "entry";
      entryId: string;
    }
  | {
      type: "group";
      crossMediaGroupId: string;
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
  entryType: "term";
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

export type KanjiClashCandidate = {
  left: KanjiClashEligibleSubject;
  leftSubjectKey: string;
  pairKey: string;
  right: KanjiClashEligibleSubject;
  rightSubjectKey: string;
  score: number;
  sharedKanji: string[];
};

export type KanjiClashSessionMode = "automatic" | "manual";
export type KanjiClashScope = "global" | "media";
export type KanjiClashRoundSide = "left" | "right";
export type KanjiClashRoundSource = "due" | "new" | "reserve";

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
  pairKey: string;
  pairState: KanjiClashPairState | null;
  right: KanjiClashEligibleSubject;
  rightSubjectKey: string;
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

export type KanjiClashPageData = {
  availableMedia: KanjiClashPageMediaOption[];
  currentRound: KanjiClashSessionRound | null;
  mode: KanjiClashSessionMode;
  queue: KanjiClashQueueSnapshot;
  scope: KanjiClashScope;
  selectedMedia: KanjiClashPageMediaOption | null;
  settings: KanjiClashPageSettings;
  snapshotAtIso: string;
};

export type KanjiClashAnswerSubmissionPayload = {
  chosenSubjectKey: string;
  dailyNewLimit: number | null;
  expectedPairKey: string;
  expectedPairStateUpdatedAt: string | null;
  mediaIds: string[];
  mode: KanjiClashSessionMode;
  requestedSize: number | null;
  scope: KanjiClashScope;
  seenPairKeys: string[];
  snapshotAtIso: string;
};

export type KanjiClashSessionActionResult = {
  answeredRound: KanjiClashSessionRound;
  isCorrect: boolean;
  logId: string;
  nextQueue: KanjiClashQueueSnapshot;
  nextRound: KanjiClashSessionRound | null;
  pairState: KanjiClashPairState;
  previousPairState: KanjiClashPairStateSnapshot;
  result: KanjiClashPairResult;
  scheduled: ScheduleKanjiClashPairResult;
  selectedSubjectKey: string;
};

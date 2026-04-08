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

export type KanjiClashPairResult = "again" | "good";
export type KanjiClashPairStateStatus =
  | "new"
  | "learning"
  | "review"
  | "relearning";
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

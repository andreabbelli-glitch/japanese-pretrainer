export const REVIEW_RATINGS = ["Again", "Hard", "Good", "Easy"] as const;
export type ReviewRating = (typeof REVIEW_RATINGS)[number];

export const REVIEW_STATES = ["new", "learning", "review", "relearning", "mature"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export type SchedulerInput = {
  state: ReviewState;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  streak: number;
  masteryScore: number;
};

export type SchedulerResult = {
  nextState: ReviewState;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  streak: number;
  masteryScore: number;
  dueAt: Date;
};

export type ReviewItemSnapshot = {
  itemId: string;
  state: ReviewState;
  dueAt: string | null;
  intervalDays: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  streak: number;
  masteryScore: number;
  lastRating: ReviewRating | null;
};

export type SessionQueueEntry = {
  itemId: string;
  isDue: boolean;
  isNew: boolean;
  dueAt: string | null;
  masteryScore?: number;
};

export type SessionQueuePlan = {
  due: SessionQueueEntry[];
  newItems: SessionQueueEntry[];
  totalPlanned: number;
};

export const REVIEW_MODES = ["global", "goal", "missing-only", "bridge"] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

export type ReviewQueueFilters = {
  mode: ReviewMode;
  goalId?: string;
};

export type ReviewTemplate = {
  promptLabel: string;
  answerLabel: string;
};

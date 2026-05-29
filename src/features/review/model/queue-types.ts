import type { ReviewCardSource } from "@/features/review/model/card-contract";
import type { ReviewQueueStateSnapshot } from "@/features/review/model/queue-state";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";

export type ReviewSubjectModel = {
  card: ReviewCardSource;
  group: ReviewSubjectGroup;
  queueStateSnapshot: ReviewQueueStateSnapshot;
};

export type ReviewQueueSubjectSnapshot = {
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  introLabel: string;
  manualCount: number;
  manualModels: ReviewSubjectModel[];
  newAvailableCount: number;
  newQueuedCount: number;
  queueCount: number;
  queueModels: ReviewSubjectModel[];
  subjectModels: ReviewSubjectModel[];
  suspendedCount: number;
  suspendedModels: ReviewSubjectModel[];
  tomorrowCount: number;
  upcomingCount: number;
  upcomingModels: ReviewSubjectModel[];
  visibleMediaId?: string;
};

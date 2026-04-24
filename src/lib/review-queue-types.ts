import type { ReviewCardListItem } from "@/db";

import type { ReviewQueueStateSnapshot } from "./review-queue-state";
import type { ReviewSubjectGroup } from "./review-subject";

export type ReviewSubjectModel = {
  card: ReviewCardListItem;
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

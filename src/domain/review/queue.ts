import { analyzeTargetGaps } from "@/src/domain/learning/gap-analysis";
import type { GoalTarget } from "@/src/domain/learning/types";
import type { SessionQueueEntry, SessionQueuePlan } from "@/src/domain/review/types";

const KNOWN_THRESHOLD = 80;

type BuildQueueInput = {
  dueItems: SessionQueueEntry[];
  newItems: SessionQueueEntry[];
  dailyReviewGoal: number;
  dailyNewLimit: number;
};

export function buildSessionQueue(input: BuildQueueInput): SessionQueuePlan {
  const reviewCap = Math.max(input.dailyReviewGoal, 0);
  const newCap = Math.max(input.dailyNewLimit, 0);

  const due = input.dueItems.slice(0, reviewCap > 0 ? reviewCap : input.dueItems.length);
  const availableSlots = reviewCap > 0 ? Math.max(reviewCap - due.length, 0) : newCap;
  const maxNew = reviewCap > 0 ? Math.min(newCap, availableSlots) : newCap;
  const newItems = input.newItems.slice(0, maxNew);

  return {
    due,
    newItems,
    totalPlanned: due.length + newItems.length,
  };
}

export function buildMissingOnlyQueue(input: {
  target: GoalTarget;
  masteryByItemId: Map<string, number>;
  dueItems: SessionQueueEntry[];
  candidateNewItems: SessionQueueEntry[];
  dailyReviewGoal: number;
  dailyNewLimit: number;
}): SessionQueuePlan {
  const gap = analyzeTargetGaps(input.target, input.masteryByItemId);
  const missingIds = new Set(gap.missingItems.map((item) => item.id));

  return buildSessionQueue({
    dueItems: input.dueItems.filter((entry) => missingIds.has(entry.itemId)),
    newItems: input.candidateNewItems.filter((entry) => missingIds.has(entry.itemId)),
    dailyReviewGoal: input.dailyReviewGoal,
    dailyNewLimit: input.dailyNewLimit,
  });
}

export function buildBridgeQueue(input: {
  target: GoalTarget;
  masteryByItemId: Map<string, number>;
  dueItems: SessionQueueEntry[];
  dailyReviewGoal: number;
}): SessionQueuePlan {
  const gap = analyzeTargetGaps(input.target, input.masteryByItemId);
  const weakOrMissing = new Set([...gap.weakItems, ...gap.missingItems].map((item) => item.id));

  const due = input.dueItems
    .filter((entry) => weakOrMissing.has(entry.itemId))
    .sort((a, b) => (a.masteryScore ?? 0) - (b.masteryScore ?? 0))
    .slice(0, Math.max(input.dailyReviewGoal, 0) || input.dueItems.length);

  return {
    due,
    newItems: [],
    totalPlanned: due.length,
  };
}

export function filterGoalScopedEntries(entries: SessionQueueEntry[], itemIds: Set<string>) {
  return entries.filter((entry) => itemIds.has(entry.itemId));
}

export function isKnownForGoal(mastery: number) {
  return mastery >= KNOWN_THRESHOLD;
}

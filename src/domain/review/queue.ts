import type { SessionQueueEntry, SessionQueuePlan } from "@/src/domain/review/types";

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

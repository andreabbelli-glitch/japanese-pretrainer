import { scheduleReview } from "@/src/domain/review/scheduler";
import type { ReviewItemSnapshot, ReviewRating, SchedulerInput, SchedulerResult } from "@/src/domain/review/types";

export function toSchedulerInput(item: ReviewItemSnapshot): SchedulerInput {
  return {
    state: item.state,
    intervalDays: item.intervalDays,
    easeFactor: item.easeFactor,
    reps: item.reps,
    lapses: item.lapses,
    streak: item.streak,
    masteryScore: item.masteryScore,
  };
}

export function applyRating(item: ReviewItemSnapshot, rating: ReviewRating, now = new Date()): SchedulerResult {
  return scheduleReview(toSchedulerInput(item), rating, now);
}

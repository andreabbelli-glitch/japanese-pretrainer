import type { ReviewRating, SchedulerInput, SchedulerResult } from "@/src/domain/review/types";

const DAY_MS = 86_400_000;
const MIN_EASE = 1.3;
const MAX_EASE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeDueDate(now: Date, intervalDays: number) {
  return new Date(now.getTime() + Math.max(intervalDays, 0) * DAY_MS);
}

export function scheduleReview(input: SchedulerInput, rating: ReviewRating, now = new Date()): SchedulerResult {
  if (rating === "Again") {
    const nextState = input.state === "new" ? "learning" : "relearning";
    const easeFactor = clamp(input.easeFactor - 0.2, MIN_EASE, MAX_EASE);
    const masteryScore = Math.max(input.masteryScore - 15, 0);

    return {
      nextState,
      intervalDays: 0,
      easeFactor,
      reps: input.reps,
      lapses: input.lapses + 1,
      streak: 0,
      masteryScore,
      dueAt: new Date(now.getTime() + 10 * 60 * 1000),
    };
  }

  const nextReps = input.reps + 1;
  const nextStreak = input.streak + 1;

  const easeDeltaByRating: Record<Exclude<ReviewRating, "Again">, number> = {
    Hard: -0.15,
    Good: 0,
    Easy: 0.15,
  };

  const easeFactor = clamp(input.easeFactor + easeDeltaByRating[rating], MIN_EASE, MAX_EASE);

  let intervalDays = input.intervalDays;

  if (input.state === "new" || input.state === "learning" || input.state === "relearning") {
    intervalDays = rating === "Hard" ? 1 : rating === "Good" ? 3 : 5;
  } else {
    const multiplierByRating: Record<Exclude<ReviewRating, "Again">, number> = {
      Hard: 1.2,
      Good: easeFactor,
      Easy: easeFactor * 1.3,
    };

    const base = Math.max(input.intervalDays, 1);
    intervalDays = Number((base * multiplierByRating[rating]).toFixed(2));

    if (rating === "Hard") {
      intervalDays = Math.max(1, intervalDays);
    }
  }

  const nextState = intervalDays >= 21 ? "mature" : "review";

  const masteryDeltaByRating: Record<Exclude<ReviewRating, "Again">, number> = {
    Hard: 4,
    Good: 8,
    Easy: 12,
  };

  return {
    nextState,
    intervalDays,
    easeFactor,
    reps: nextReps,
    lapses: input.lapses,
    streak: nextStreak,
    masteryScore: clamp(input.masteryScore + masteryDeltaByRating[rating], 0, 100),
    dueAt: computeDueDate(now, intervalDays),
  };
}

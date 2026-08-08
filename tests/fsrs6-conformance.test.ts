import {
  BindingMemoryState,
  FSRSBinding
} from "@open-spaced-repetition/binding";
import { describe, expect, it } from "vitest";

import {
  reviewSchedulerConfig,
  scheduleReview,
  type ReviewRating
} from "@/features/review/model/scheduler";

const ratings = ["again", "hard", "good", "easy"] as const;

describe("FSRS-6 scheduler conformance", () => {
  it("matches the official fsrs-rs binding memory state for first reviews", () => {
    const expected = new FSRSBinding().nextStates(null, 0.9, 0);

    for (const rating of ratings) {
      const actual = scheduleReview({
        current: {
          difficulty: null,
          dueAt: null,
          lapses: 0,
          lastReviewedAt: null,
          learningSteps: 0,
          reps: 0,
          scheduledDays: 0,
          stability: null,
          state: "new"
        },
        now: new Date("2026-01-15T12:00:00.000Z"),
        rating
      });
      const official = selectOfficialRating(expected, rating).memory;

      expect(
        Math.abs(actual.stability - official.stability)
      ).toBeLessThanOrEqual(0.001);
      expect(
        Math.abs(actual.difficulty - official.difficulty)
      ).toBeLessThanOrEqual(0.001);
      expect(actual.schedulerVersion).toBe("fsrs_v3_overdue_transient");
    }
  });

  it("matches the official fsrs-rs binding after a long-term review", () => {
    const stability = 4.4;
    const difficulty = 5.2;
    const elapsedDays = 3;
    const expected = new FSRSBinding().nextStates(
      new BindingMemoryState(stability, difficulty),
      0.9,
      elapsedDays
    );

    for (const rating of ratings) {
      const actual = scheduleReview({
        current: {
          difficulty,
          dueAt: "2026-01-15T03:00:00.000Z",
          lapses: 1,
          lastReviewedAt: "2026-01-12T12:00:00.000Z",
          learningSteps: 0,
          reps: 8,
          scheduledDays: elapsedDays,
          stability,
          state: "review"
        },
        now: new Date("2026-01-15T12:00:00.000Z"),
        rating
      });
      const official = selectOfficialRating(expected, rating).memory;

      expect(actual.elapsedDays).toBe(elapsedDays);
      expect(
        Math.abs(actual.stability - official.stability)
      ).toBeLessThanOrEqual(0.001);
      expect(
        Math.abs(actual.difficulty - official.difficulty)
      ).toBeLessThanOrEqual(0.001);
    }
  });

  it.each(["learning", "relearning"] as const)(
    "matches the long-term binding for overdue successful %s steps",
    (state) => {
      const stability = 0.5;
      const difficulty = 5;
      const elapsedDays = 4;
      const expected = new FSRSBinding().nextStates(
        new BindingMemoryState(stability, difficulty),
        0.9,
        elapsedDays
      );

      for (const rating of ["good", "easy"] as const) {
        const actual = scheduleReview({
          current: {
            difficulty,
            dueAt: "2030-01-15T12:10:00.000Z",
            lapses: state === "relearning" ? 1 : 0,
            lastReviewedAt: "2026-01-15T12:00:00.000Z",
            learningSteps: 1,
            reps: 3,
            scheduledDays: 0,
            stability,
            state
          },
          now: new Date("2026-01-19T12:10:00.000Z"),
          rating
        });
        const official = selectOfficialRating(expected, rating).memory;

        expect(actual.elapsedDays).toBe(elapsedDays);
        expect(actual.state).toBe("review");
        expect(
          Math.abs(actual.stability - official.stability)
        ).toBeLessThanOrEqual(0.001);
        expect(
          Math.abs(actual.difficulty - official.difficulty)
        ).toBeLessThanOrEqual(0.001);
      }
    }
  );

  it("uses the 21-parameter FSRS-6 model with internal fuzz disabled", () => {
    expect(reviewSchedulerConfig.fsrs.w).toHaveLength(21);
    expect(reviewSchedulerConfig.fsrs.enable_fuzz).toBe(false);
  });
});

function selectOfficialRating(
  states: ReturnType<FSRSBinding["nextStates"]>,
  rating: ReviewRating
) {
  return states[rating];
}

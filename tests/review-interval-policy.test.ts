import { describe, expect, it } from "vitest";

import {
  applyReviewDailyIntervalPolicy,
  buildReviewDailyIntervalSeed,
  canLoadBalanceReviewInterval,
  calculateReviewEasyDayModifiers,
  DEFAULT_REVIEW_EASY_DAYS,
  getReviewDailyIntervalPolicyKey,
  getReviewFuzzBounds,
  type ReviewEasyDays
} from "@/features/review/model/interval-policy";
import {
  getReviewIntervalPolicyBaseInterval,
  resolveReviewIntervalPolicySelection,
  scheduleReview,
  scheduleReviewBase
} from "@/features/review/model/scheduler";
import {
  addReviewStudyDays,
  differenceInReviewStudyDays,
  getReviewStudyDay
} from "@/features/review/model/study-day";

describe("Anki-style review daily interval policy", () => {
  it("matches Anki 25.07 golden fuzz ranges", () => {
    expect(getReviewFuzzBounds(1, 1, 1_000)).toEqual({
      lower: 1,
      upper: 1
    });
    expect(getReviewFuzzBounds(2.49, 1, 1_000)).toEqual({
      lower: 2,
      upper: 2
    });
    expect(getReviewFuzzBounds(2.5, 1, 1_000)).toEqual({
      lower: 2,
      upper: 4
    });
    expect(getReviewFuzzBounds(7, 1, 1_000)).toEqual({
      lower: 5,
      upper: 9
    });
    expect(getReviewFuzzBounds(17, 1, 1_000)).toEqual({
      lower: 14,
      upper: 20
    });
    expect(getReviewFuzzBounds(37, 1, 1_000)).toEqual({
      lower: 33,
      upper: 41
    });
  });

  it("evaluates Anki fuzz boundaries as f32", () => {
    expect(getReviewFuzzBounds(2.49999999, 1, 1_000)).toEqual({
      lower: 2,
      upper: 4
    });
  });

  it("constrains fuzz by minimum and maximum interval", () => {
    expect(getReviewFuzzBounds(100, 101, 1_000)).toEqual({
      lower: 101,
      upper: 108
    });
    expect(getReviewFuzzBounds(100, 1, 99)).toEqual({
      lower: 92,
      upper: 99
    });
    expect(getReviewFuzzBounds(100, 97, 103)).toEqual({
      lower: 97,
      upper: 103
    });
    expect(getReviewFuzzBounds(20, 30, 15)).toEqual({
      lower: 15,
      upper: 15
    });
  });

  it("uses one reproducible memory + reps seed across all ratings", () => {
    const input = {
      baseInterval: 17,
      rating: "good" as const,
      reps: 5,
      reviewedAt: "2026-03-28T12:00:00.000Z",
      schedulingKey: "card-1"
    };
    const first = applyReviewDailyIntervalPolicy(input);
    const second = applyReviewDailyIntervalPolicy(input);
    const nextRep = applyReviewDailyIntervalPolicy({ ...input, reps: 6 });

    expect(
      buildReviewDailyIntervalSeed({
        reps: input.reps,
        schedulingKey: input.schedulingKey
      })
    ).toBe("card-1:reps-5");
    expect(
      applyReviewDailyIntervalPolicy({ ...input, rating: "hard" }).interval
    ).toBe(first.interval);

    expect(first).toEqual({
      interval: 16,
      loadBalanced: false,
      lower: 14,
      upper: 20
    });
    expect(second).toEqual(first);
    expect(nextRep.interval).toBeGreaterThanOrEqual(nextRep.lower);
    expect(nextRep.interval).toBeLessThanOrEqual(nextRep.upper);
    expect(
      buildReviewDailyIntervalSeed({
        reps: input.reps + 1,
        schedulingKey: input.schedulingKey
      })
    ).not.toBe(
      buildReviewDailyIntervalSeed({
        reps: input.reps,
        schedulingKey: input.schedulingKey
      })
    );
    expect(getReviewDailyIntervalPolicyKey()).toContain("anki-25.07");
  });

  it("uses ts-fsrs' float interval before Anki fuzz rounding", () => {
    const input = {
      current: {
        difficulty: 4.2,
        dueAt: "2026-03-28T03:00:00.000Z",
        lapses: 0,
        lastReviewedAt: "2026-03-08T12:00:00.000Z",
        learningSteps: 0,
        reps: 8,
        scheduledDays: 20,
        stability: 20.123,
        state: "review" as const
      },
      intervalPolicy: { schedulingKey: "memory:recognition:term-1" },
      now: new Date("2026-03-28T12:00:00.000Z"),
      rating: "good" as const
    };
    const scheduled = scheduleReviewBase(input);
    const rawInterval = getReviewIntervalPolicyBaseInterval(scheduled);
    const selection = resolveReviewIntervalPolicySelection(scheduled, input);

    expect(rawInterval).not.toBe(scheduled.scheduledDays);
    expect(selection.selected).toMatchObject(
      getReviewFuzzBounds(
        rawInterval,
        selection.minimumInterval,
        selection.maximumInterval
      )
    );
  });

  it.each(["learning", "relearning"] as const)(
    "keeps ts-fsrs' rounded daily interval when exiting %s",
    (state) => {
      const scheduled = scheduleReviewBase({
        current: {
          difficulty: 5,
          dueAt: "2026-03-28T12:00:00.000Z",
          lapses: state === "relearning" ? 1 : 0,
          lastReviewedAt: "2026-03-28T11:50:00.000Z",
          learningSteps: 1,
          reps: 3,
          scheduledDays: 0,
          stability: 0.5,
          state
        },
        intervalPolicy: {
          schedulingKey: `memory-${state}-graduation`
        },
        now: new Date("2026-03-28T12:00:00.000Z"),
        rating: "easy"
      });

      expect(scheduled.scheduledDays).toBeGreaterThanOrEqual(1);
      expect(getReviewIntervalPolicyBaseInterval(scheduled)).toBe(
        scheduled.scheduledDays
      );
    }
  );

  it.each(["learning", "relearning"] as const)(
    "uses the unrounded Review interval for overdue successful %s steps",
    (state) => {
      const current = {
        difficulty: 5,
        dueAt: "2030-03-28T12:00:00.000Z",
        lapses: state === "relearning" ? 1 : 0,
        lastReviewedAt: "2026-03-24T12:00:00.000Z",
        learningSteps: 1,
        reps: 3,
        scheduledDays: 0,
        stability: 0.5,
        state
      };
      const overdue = scheduleReviewBase({
        current,
        intervalPolicy: {
          schedulingKey: `memory-${state}-overdue-graduation`
        },
        now: new Date("2026-03-28T12:00:00.000Z"),
        rating: "good"
      });
      const longTermReference = scheduleReviewBase({
        current: {
          ...current,
          learningSteps: 0,
          state: "review"
        },
        intervalPolicy: {
          schedulingKey: `memory-${state}-overdue-graduation`
        },
        now: new Date("2026-03-28T12:00:00.000Z"),
        rating: "good"
      });
      const rawInterval = getReviewIntervalPolicyBaseInterval(overdue);

      expect(overdue).toEqual(longTermReference);
      expect(rawInterval).toBe(
        getReviewIntervalPolicyBaseInterval(longTermReference)
      );
      expect(rawInterval).not.toBe(overdue.scheduledDays);
    }
  );

  it("keeps representative float-vs-rounded fuzz bounds within one day", () => {
    for (const rawInterval of [2.5, 2.51, 6.51, 7.49, 19.51, 37.49, 365.51]) {
      const fromFloat = getReviewFuzzBounds(rawInterval, 1, 1_000);
      const fromRounded = getReviewFuzzBounds(
        Math.round(rawInterval),
        1,
        1_000
      );

      expect(Math.abs(fromFloat.lower - fromRounded.lower)).toBeLessThanOrEqual(
        1
      );
      expect(Math.abs(fromFloat.upper - fromRounded.upper)).toBeLessThanOrEqual(
        1
      );
    }
  });

  it("does not fuzz or balance intraday steps", () => {
    const scheduled = applyReviewDailyIntervalPolicy({
      baseInterval: 0,
      dueCountsByInterval: new Map([[1, 999]]),
      rating: "again",
      reps: 3,
      reviewedAt: "2026-03-28T12:00:00.000Z",
      schedulingKey: "card-intraday"
    });
    const fromNew = scheduleReview({
      current: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        reps: 0,
        stability: null,
        state: "new"
      },
      intervalPolicy: { schedulingKey: "card-intraday" },
      now: new Date("2026-03-28T12:00:00.000Z"),
      rating: "good"
    });

    expect(scheduled).toEqual({
      interval: 0,
      loadBalanced: false,
      lower: 0,
      upper: 0
    });
    expect(fromNew.scheduledDays).toBe(0);
    expect(fromNew.dueAt).toBe("2026-03-28T12:10:00.000Z");
  });

  it("load-balances only inside fuzz bounds and at most 90 days", () => {
    const crowded = new Map(
      Array.from({ length: 7 }, (_, index) => [14 + index, 100])
    );
    crowded.set(16, 0);
    const balanced = applyReviewDailyIntervalPolicy({
      baseInterval: 17,
      dueCountsByInterval: crowded,
      rating: "good",
      reps: 5,
      reviewedAt: "2026-03-28T12:00:00.000Z",
      schedulingKey: "card-1"
    });
    const longTerm = applyReviewDailyIntervalPolicy({
      baseInterval: 120,
      dueCountsByInterval: new Map([[120, 0]]),
      rating: "good",
      reps: 5,
      reviewedAt: "2026-03-28T12:00:00.000Z",
      schedulingKey: "card-1"
    });

    expect(balanced).toEqual({
      interval: 16,
      loadBalanced: true,
      lower: 14,
      upper: 20
    });
    expect(longTerm.loadBalanced).toBe(false);
    expect(longTerm.interval).toBeGreaterThanOrEqual(longTerm.lower);
    expect(longTerm.interval).toBeLessThanOrEqual(longTerm.upper);
  });

  it("matches Anki's truncated 90-day load-balancing gate", () => {
    expect(canLoadBalanceReviewInterval(90.9, 90)).toBe(true);
    expect(canLoadBalanceReviewInterval(91, 90)).toBe(false);
    expect(canLoadBalanceReviewInterval(90.9, 91)).toBe(false);

    const base = {
      dueCountsByInterval: new Map<number, number>(),
      rating: "good" as const,
      reps: 5,
      reviewedAt: "2026-03-28T12:00:00.000Z",
      schedulingKey: "memory-90-boundary"
    };

    expect(
      applyReviewDailyIntervalPolicy({ ...base, baseInterval: 90.9 })
        .loadBalanced
    ).toBe(true);
    expect(
      applyReviewDailyIntervalPolicy({ ...base, baseInterval: 91 }).loadBalanced
    ).toBe(false);
  });

  it("supports Normal, Reduced and Minimum Easy Days with all-Normal default", () => {
    const counts = new Map(
      Array.from({ length: 7 }, (_, index) => [14 + index, 10])
    );
    const saturdayMinimum = [
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "minimum",
      "normal"
    ] as const satisfies ReviewEasyDays;
    const base = {
      baseInterval: 17,
      dueCountsByInterval: counts,
      rating: "good" as const,
      reps: 5,
      reviewedAt: "2026-03-28T12:00:00.000Z",
      schedulingKey: "card-1"
    };

    expect(
      applyReviewDailyIntervalPolicy({
        ...base,
        easyDays: DEFAULT_REVIEW_EASY_DAYS
      }).interval
    ).toBe(15);
    expect(
      applyReviewDailyIntervalPolicy({
        ...base,
        easyDays: saturdayMinimum
      }).interval
    ).toBe(16);
    expect(
      calculateReviewEasyDayModifiers(
        ["reduced", "normal", "normal", "normal", "normal", "normal", "normal"],
        [0, 1],
        [100, 1]
      )
    ).toEqual([0.0001, 1]);
  });

  it("preserves grade ordering and maximum interval after fuzz", () => {
    const now = new Date("2026-03-12T10:00:00.000Z");
    const current = {
      difficulty: 3.2,
      dueAt: "2026-03-12T10:00:00.000Z",
      lapses: 1,
      lastReviewedAt: "2026-03-09T10:00:00.000Z",
      reps: 5,
      scheduledDays: 3,
      stability: 3,
      state: "review" as const
    };
    const intervals = (["hard", "good", "easy"] as const).map(
      (rating) =>
        scheduleReview({
          current,
          intervalPolicy: { schedulingKey: "card-order" },
          now,
          rating,
          scheduler: { maximumInterval: 15 }
        }).scheduledDays
    );

    expect(intervals[0]).toBeLessThan(intervals[1]!);
    expect(intervals[1]).toBeLessThanOrEqual(intervals[2]!);
    expect(Math.max(...intervals)).toBeLessThanOrEqual(15);
  });

  it.each([
    ["spring DST", "2026-03-28T12:00:00.000Z"],
    ["fall DST", "2026-10-24T12:00:00.000Z"]
  ])(
    "anchors daily due dates to the logical 04:00 day across %s",
    (_, nowIso) => {
      const now = new Date(nowIso);
      const scheduled = scheduleReview({
        current: {
          difficulty: 4,
          dueAt: nowIso,
          lapses: 0,
          lastReviewedAt: "2026-03-01T12:00:00.000Z",
          reps: 8,
          scheduledDays: 20,
          stability: 20,
          state: "review"
        },
        intervalPolicy: { schedulingKey: `card-dst-${nowIso}` },
        now,
        rating: "good"
      });

      expect(differenceInReviewStudyDays(now, scheduled.dueAt)).toBe(
        scheduled.scheduledDays
      );
      expect(getReviewStudyDay(scheduled.dueAt)).toBe(
        addReviewStudyDays(getReviewStudyDay(now), scheduled.scheduledDays)
      );
    }
  );
});

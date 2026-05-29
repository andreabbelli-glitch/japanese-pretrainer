import { describe, expect, it } from "vitest";

import { getLocalDayBounds } from "@/db/queries/review-query-helpers";
import { resolveReviewCardReading } from "@/features/review/server/card-hydration";
import { scheduleReview } from "@/features/review/model/scheduler";

describe("review model", () => {
  it("derives grammar card reading from annotated fronts when the glossary reading is missing", () => {
    const reading = resolveReviewCardReading(
      {
        cardType: "concept",
        entryLinks: [
          {
            entryType: "grammar",
            entryId: "grammar-takei",
            relationshipType: "primary"
          }
        ],
        front: "た{{形|けい}}"
      } as unknown as Parameters<typeof resolveReviewCardReading>[0],
      new Map([
        [
          "grammar:grammar-takei",
          {
            href: "/media/demo/glossary/grammar/grammar-takei",
            id: "grammar-takei",
            kind: "grammar",
            label: "た形",
            meaning: "passato",
            reading: undefined
          }
        ]
      ]) as unknown as Parameters<typeof resolveReviewCardReading>[1]
    );

    expect(reading).toBe("たけい");
  });

  it("maps FSRS-native review cards into scheduling outputs", () => {
    const fromNew = scheduleReview({
      current: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        reps: 0,
        stability: null,
        state: null
      },
      now: new Date("2026-03-09T10:00:00.000Z"),
      rating: "good"
    });
    const now = new Date("2026-03-12T10:00:00.000Z");
    const scheduled = (["again", "hard", "good", "easy"] as const).map(
      (rating) =>
        scheduleReview({
          current: {
            difficulty: 3.2,
            dueAt: "2026-03-12T10:00:00.000Z",
            lapses: 1,
            lastReviewedAt: "2026-03-09T10:00:00.000Z",
            reps: 5,
            stability: 3,
            state: "review"
          },
          now,
          rating
        })
    );
    const dueTimes = scheduled.map((item) => new Date(item.dueAt).getTime());

    expect(fromNew).toEqual({
      difficulty: 2.118,
      dueAt: "2026-03-09T10:10:00.000Z",
      elapsedDays: 0,
      lapses: 0,
      learningSteps: 1,
      reps: 1,
      scheduledDays: 0,
      schedulerVersion: "fsrs_v1",
      stability: 2.307,
      state: "learning"
    });
    expect(dueTimes.every((value) => Number.isFinite(value))).toBe(true);
    expect(dueTimes[0]).toBeLessThanOrEqual(dueTimes[1]);
    expect(dueTimes[1]).toBeLessThanOrEqual(dueTimes[2]);
    expect(dueTimes[2]).toBeLessThanOrEqual(dueTimes[3]);
    expect(scheduled[0]).toMatchObject({
      dueAt: "2026-03-12T10:10:00.000Z",
      elapsedDays: 3,
      lapses: 2,
      learningSteps: 0,
      reps: 6,
      scheduledDays: 0,
      schedulerVersion: "fsrs_v1",
      stability: 0.716,
      state: "relearning"
    });
    expect(scheduled.map((item) => item.reps)).toEqual([6, 6, 6, 6]);
    expect(scheduled[0]?.lapses).toBe(2);
    expect(scheduled[1]?.lapses).toBe(1);
    expect(scheduled[2]?.lapses).toBe(1);
    expect(scheduled[3]?.lapses).toBe(1);
  });

  it("keeps day-level normalized intervals ordered near UTC midnight", () => {
    const now = new Date("2026-05-19T23:58:00.000Z");
    const scheduled = (["again", "hard", "good", "easy"] as const).map(
      (rating) =>
        scheduleReview({
          current: {
            difficulty: 5,
            dueAt: "2026-05-19T00:00:00.000Z",
            lapses: 0,
            lastReviewedAt: "2026-05-19T00:00:00.000Z",
            learningSteps: 1,
            reps: 1,
            scheduledDays: 0,
            stability: 0.1,
            state: "learning"
          },
          now,
          rating
        })
    );
    const dueTimes = scheduled.map((item) => new Date(item.dueAt).getTime());

    expect(dueTimes[0]).toBeLessThanOrEqual(dueTimes[1]);
    expect(dueTimes[1]).toBeLessThanOrEqual(dueTimes[2]);
    expect(dueTimes[2]).toBeLessThanOrEqual(dueTimes[3]);
    expect(scheduled[2]?.scheduledDays).toBe(1);
    expect(scheduled[3]?.scheduledDays).toBe(1);
  });

  it("derives study-day boundaries from the runtime local timezone", () => {
    const originalTimezone = process.env.TZ;

    try {
      process.env.TZ = "America/Los_Angeles";

      expect(getLocalDayBounds(new Date("2026-03-11T00:15:00.000Z"))).toEqual({
        dayEndIso: "2026-03-11T07:00:00.000Z",
        dayStartIso: "2026-03-10T07:00:00.000Z"
      });
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});

import { describe, expect, it } from "vitest";

import { getLocalDayBounds } from "@/db/queries/review-query-helpers";
import { resolveReviewCardReading } from "@/features/review/server/card-hydration";
import {
  replayReviewHistory,
  reviewSchedulerConfig,
  scheduleReview
} from "@/features/review/model/scheduler";

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
            href: "/glossary/grammar/%E3%81%9F%E5%BD%A2?media=demo&source=grammar-takei",
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
      schedulerVersion: "fsrs_v2_study_day",
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
      schedulerVersion: "fsrs_v2_study_day",
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
    expect(scheduled[3]?.scheduledDays).toBe(2);
  });

  it("keeps elapsed days at zero inside the same logical study day", () => {
    const scheduled = scheduleReview({
      current: {
        difficulty: 5,
        dueAt: "2026-05-20T00:00:00.000Z",
        lapses: 0,
        lastReviewedAt: "2026-05-19T23:58:00.000Z",
        learningSteps: 0,
        reps: 3,
        scheduledDays: 1,
        stability: 1,
        state: "review"
      },
      now: new Date("2026-05-20T00:02:00.000Z"),
      rating: "good"
    });

    expect(scheduled.elapsedDays).toBe(0);
    expect(scheduled.scheduledDays).toBeLessThanOrEqual(3);
  });

  it("replays zero elapsed days inside the same logical study day", () => {
    const firstReviewedAt = "2026-05-19T23:58:00.000Z";
    const secondReviewedAt = "2026-05-20T00:02:00.000Z";
    const first = scheduleReview({
      current: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        reps: 0,
        stability: null,
        state: "new"
      },
      now: new Date(firstReviewedAt),
      rating: "good"
    });
    const sequential = scheduleReview({
      current: {
        difficulty: first.difficulty,
        dueAt: first.dueAt,
        lapses: first.lapses,
        lastReviewedAt: firstReviewedAt,
        learningSteps: first.learningSteps,
        reps: first.reps,
        scheduledDays: first.scheduledDays,
        stability: first.stability,
        state: first.state
      },
      now: new Date(secondReviewedAt),
      rating: "good"
    });
    const replayed = replayReviewHistory([
      {
        answeredAt: firstReviewedAt,
        id: "utc-midnight-log-1",
        previousState: "new",
        rating: "good",
        responseMs: null
      },
      {
        answeredAt: secondReviewedAt,
        id: "utc-midnight-log-2",
        previousState: first.state,
        rating: "good",
        responseMs: null
      }
    ]);

    expect(replayed?.logs[1]?.elapsedDays).toBe(0);
    expect(replayed?.state.dueAt).toBe(sequential.dueAt);
    expect(replayed?.state.scheduledDays).toBe(sequential.scheduledDays);
  });

  it("replays the persisted logical-day distance instead of recalculating wall time", () => {
    const replayed = replayReviewHistory([
      {
        answeredAt: "2026-01-01T09:00:00.000Z",
        elapsedDays: 0,
        id: "persisted-day-log-1",
        previousState: "new",
        rating: "good",
        responseMs: null
      },
      {
        answeredAt: "2026-01-10T09:00:00.000Z",
        elapsedDays: 0,
        id: "persisted-day-log-2",
        previousState: "learning",
        rating: "good",
        responseMs: null
      }
    ]);

    expect(replayed?.logs[1]?.elapsedDays).toBe(0);
  });

  it("replays review history with a caller-provided scheduler config", () => {
    const logs = [
      {
        answeredAt: "2026-01-01T09:00:00.000Z",
        cardType: "recognition",
        id: "log-1",
        previousState: "new",
        rating: "good",
        responseMs: null
      },
      {
        answeredAt: "2026-01-03T09:00:00.000Z",
        cardType: "recognition",
        id: "log-2",
        previousState: "learning",
        rating: "good",
        responseMs: null
      },
      {
        answeredAt: "2026-01-08T09:00:00.000Z",
        cardType: "recognition",
        id: "log-3",
        previousState: "review",
        rating: "good",
        responseMs: null
      }
    ] as const;
    const defaultReplay = replayReviewHistory(logs);
    const optimizedReplay = replayReviewHistory(logs, {
      scheduler: () => ({
        desiredRetention: 0.8,
        weights: [...reviewSchedulerConfig.fsrs.w]
      })
    });

    expect(defaultReplay?.state.scheduledDays).toBe(21);
    expect(optimizedReplay?.state.scheduledDays).toBe(65);
    expect(optimizedReplay?.state.dueAt).toBe("2026-03-14T03:00:00.000Z");
  });

  it("uses one stable memory seed across physical-card replay logs", () => {
    const logs = [
      {
        answeredAt: "2026-01-01T09:00:00.000Z",
        id: "log-1",
        previousState: "new" as const,
        rating: "good" as const,
        responseMs: null,
        schedulingKey: "physical-card-a"
      },
      {
        answeredAt: "2026-01-03T09:00:00.000Z",
        id: "log-2",
        previousState: "learning" as const,
        rating: "good" as const,
        responseMs: null,
        schedulingKey: "physical-card-b"
      },
      {
        answeredAt: "2026-01-08T09:00:00.000Z",
        id: "log-3",
        previousState: "review" as const,
        rating: "good" as const,
        responseMs: null,
        schedulingKey: "physical-card-c"
      }
    ];
    const memoryKey = "mnemonic:v1:recognition:term:shared";
    const replayed = replayReviewHistory(logs, { schedulingKey: memoryKey });
    const equivalent = replayReviewHistory(
      logs.map((log) => ({ ...log, schedulingKey: memoryKey }))
    );

    expect(replayed?.finalIntervalPolicy?.schedulingKey).toBe(memoryKey);
    expect(replayed?.state).toEqual(equivalent?.state);
  });

  it("derives study-day boundaries from the explicit review policy", () => {
    const originalTimezone = process.env.TZ;

    try {
      process.env.TZ = "America/Los_Angeles";

      expect(getLocalDayBounds(new Date("2026-03-11T00:15:00.000Z"))).toEqual({
        dayEndIso: "2026-03-11T03:00:00.000Z",
        dayStartIso: "2026-03-10T03:00:00.000Z"
      });
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});

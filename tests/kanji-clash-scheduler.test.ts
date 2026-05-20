import { describe, expect, it } from "vitest";

import {
  createInitialKanjiClashPairState,
  kanjiClashSchedulerConfig,
  scheduleKanjiClashPair,
  transitionKanjiClashPairState
} from "@/lib/kanji-clash";

describe("kanji clash scheduler", () => {
  it("creates an initial pair state with the dedicated scheduler namespace", () => {
    const state = createInitialKanjiClashPairState({
      leftSubjectKey: "entry:term:left",
      now: "2026-04-09T08:00:00.000Z",
      pairKey: "entry:term:left::entry:term:right",
      rightSubjectKey: "entry:term:right"
    });

    expect(state).toMatchObject({
      difficulty: null,
      dueAt: null,
      leftSubjectKey: "entry:term:left",
      pairKey: "entry:term:left::entry:term:right",
      reps: 0,
      rightSubjectKey: "entry:term:right",
      schedulerVersion: "kanji_clash_fsrs_v1",
      state: "new"
    });
  });

  it("maps a correct answer to the dedicated good branch", () => {
    const scheduled = scheduleKanjiClashPair({
      current: createInitialKanjiClashPairState({
        leftSubjectKey: "entry:term:left",
        now: "2026-04-09T08:00:00.000Z",
        pairKey: "entry:term:left::entry:term:right",
        rightSubjectKey: "entry:term:right"
      }),
      now: new Date("2026-04-09T08:00:00.000Z"),
      result: "good"
    });

    expect(scheduled.schedulerVersion).toBe("kanji_clash_fsrs_v1");
    expect(scheduled.reps).toBe(1);
    expect(scheduled.state === "learning" || scheduled.state === "review").toBe(
      true
    );
  });

  it("does not collapse a day-level correct answer near UTC midnight", () => {
    const now = new Date("2026-05-19T23:58:00.000Z");
    const scheduled = scheduleKanjiClashPair({
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
      result: "good"
    });

    expect(scheduled.scheduledDays).toBe(1);
    expect(new Date(scheduled.dueAt).getTime() - now.getTime()).toBeGreaterThan(
      12 * 60 * 60_000
    );
  });

  it("maps a wrong answer to again and records the transition snapshot", () => {
    const initial = createInitialKanjiClashPairState({
      leftSubjectKey: "entry:term:left",
      now: "2026-04-09T08:00:00.000Z",
      pairKey: "entry:term:left::entry:term:right",
      rightSubjectKey: "entry:term:right"
    });
    const afterGood = transitionKanjiClashPairState({
      current: initial,
      now: "2026-04-09T08:00:00.000Z",
      result: "good"
    });
    const afterAgain = transitionKanjiClashPairState({
      current: afterGood.next,
      now: "2026-04-10T08:00:00.000Z",
      result: "again"
    });

    expect(afterAgain.previous.state).toBe(afterGood.next.state);
    expect(afterAgain.next.schedulerVersion).toBe("kanji_clash_fsrs_v1");
    expect(afterAgain.scheduled.elapsedDays).toBe(1);
    expect(afterAgain.next.lapses).toBeGreaterThanOrEqual(
      afterGood.next.lapses
    );
  });

  it("keeps scheduler parameters isolated from the review scheduler namespace", () => {
    expect(kanjiClashSchedulerConfig.schedulerVersion).toBe(
      "kanji_clash_fsrs_v1"
    );
    expect(kanjiClashSchedulerConfig.fsrs.request_retention).toBe(0.9);
  });
});

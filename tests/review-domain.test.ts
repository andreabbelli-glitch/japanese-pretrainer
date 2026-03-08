import { describe, expect, it } from "vitest";
import { scheduleReview } from "../src/domain/review/scheduler";

describe("review scheduler", () => {
  const now = new Date("2026-03-08T10:00:00.000Z");

  it("gestisce il caso base da new a learning/review", () => {
    const again = scheduleReview(
      {
        state: "new",
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        streak: 0,
        masteryScore: 0,
      },
      "Again",
      now,
    );

    const good = scheduleReview(
      {
        state: "new",
        intervalDays: 0,
        easeFactor: 2.5,
        reps: 0,
        lapses: 0,
        streak: 0,
        masteryScore: 0,
      },
      "Good",
      now,
    );

    expect(again.nextState).toBe("learning");
    expect(again.lapses).toBe(1);
    expect(again.intervalDays).toBe(0);

    expect(good.nextState).toBe("review");
    expect(good.intervalDays).toBe(3);
    expect(good.reps).toBe(1);
  });

  it("gestisce lapse e passaggio in relearning", () => {
    const result = scheduleReview(
      {
        state: "review",
        intervalDays: 12,
        easeFactor: 2.4,
        reps: 8,
        lapses: 1,
        streak: 4,
        masteryScore: 72,
      },
      "Again",
      now,
    );

    expect(result.nextState).toBe("relearning");
    expect(result.lapses).toBe(2);
    expect(result.streak).toBe(0);
    expect(result.masteryScore).toBeLessThan(72);
  });

  it("porta item relearning di nuovo in review con Good", () => {
    const result = scheduleReview(
      {
        state: "relearning",
        intervalDays: 0,
        easeFactor: 2.1,
        reps: 5,
        lapses: 2,
        streak: 0,
        masteryScore: 40,
      },
      "Good",
      now,
    );

    expect(result.nextState).toBe("review");
    expect(result.intervalDays).toBe(3);
    expect(result.reps).toBe(6);
    expect(result.streak).toBe(1);
  });

  it("avanza intervalli in modo prevedibile da review a mature", () => {
    const good = scheduleReview(
      {
        state: "review",
        intervalDays: 20,
        easeFactor: 2.5,
        reps: 10,
        lapses: 1,
        streak: 7,
        masteryScore: 82,
      },
      "Good",
      now,
    );

    const easy = scheduleReview(
      {
        state: "review",
        intervalDays: 20,
        easeFactor: 2.5,
        reps: 10,
        lapses: 1,
        streak: 7,
        masteryScore: 82,
      },
      "Easy",
      now,
    );

    expect(good.intervalDays).toBeGreaterThan(20);
    expect(good.nextState).toBe("mature");
    expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    expect(easy.masteryScore).toBeGreaterThan(good.masteryScore);
  });
});

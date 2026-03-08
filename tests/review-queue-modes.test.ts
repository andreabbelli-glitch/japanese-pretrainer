import { describe, expect, it } from "vitest";
import {
  buildBridgeQueue,
  buildMissingOnlyQueue,
  buildSessionQueue,
  filterGoalScopedEntries,
  isKnownForGoal,
} from "../src/domain/review";
import type { SessionQueueEntry } from "../src/domain/review/types";

function entry(itemId: string, overrides: Partial<SessionQueueEntry> = {}): SessionQueueEntry {
  return {
    itemId,
    isDue: false,
    isNew: true,
    dueAt: null,
    masteryScore: 0,
    ...overrides,
  };
}

describe("review queue modes", () => {
  it("builds global queue with due priority and new cap", () => {
    const plan = buildSessionQueue({
      dueItems: [entry("jp.v.005", { isDue: true }), entry("jp.v.007", { isDue: true })],
      newItems: [entry("jp.v.009"), entry("jp.v.010")],
      dailyReviewGoal: 3,
      dailyNewLimit: 2,
    });

    expect(plan.due.map((e) => e.itemId)).toEqual(["jp.v.005", "jp.v.007"]);
    expect(plan.newItems.map((e) => e.itemId)).toEqual(["jp.v.009"]);
  });

  it("builds goal queue by filtering scoped item ids", () => {
    const due = [entry("jp.v.005", { isDue: true }), entry("jp.v.007", { isDue: true }), entry("jp.v.009", { isDue: true })];
    const scoped = new Set(["jp.v.007", "jp.v.009"]);

    const plan = buildSessionQueue({
      dueItems: filterGoalScopedEntries(due, scoped),
      newItems: [],
      dailyReviewGoal: 10,
      dailyNewLimit: 0,
    });

    expect(plan.due.map((e) => e.itemId)).toEqual(["jp.v.007", "jp.v.009"]);
  });

  it("builds missing-only queue to include only missing target items", () => {
    const plan = buildMissingOnlyQueue({
      target: {
        id: "goal-1",
        targetType: "goal",
        itemIds: ["jp.v.005", "jp.v.007", "jp.v.009"],
      },
      masteryByItemId: new Map([
        ["jp.v.005", 90],
        ["jp.v.007", 55],
        ["jp.v.009", 20],
      ]),
      dueItems: [entry("jp.v.005", { isDue: true }), entry("jp.v.009", { isDue: true })],
      candidateNewItems: [entry("jp.v.007"), entry("jp.v.009")],
      dailyReviewGoal: 10,
      dailyNewLimit: 10,
    });

    expect(plan.due.map((e) => e.itemId)).toEqual(["jp.v.009"]);
    expect(plan.newItems.map((e) => e.itemId)).toEqual(["jp.v.009"]);
  });

  it("prevents fake new item for globally known mastery", () => {
    expect(isKnownForGoal(80)).toBe(true);
    expect(isKnownForGoal(95)).toBe(true);
    expect(isKnownForGoal(79)).toBe(false);
  });

  it("builds bridge queue with weak/missing due items only", () => {
    const plan = buildBridgeQueue({
      target: {
        id: "goal-2",
        targetType: "goal",
        itemIds: ["jp.v.005", "jp.v.007", "jp.v.009"],
      },
      masteryByItemId: new Map([
        ["jp.v.005", 90],
        ["jp.v.007", 65],
        ["jp.v.009", 20],
      ]),
      dueItems: [
        entry("jp.v.005", { isDue: true, masteryScore: 90 }),
        entry("jp.v.007", { isDue: true, masteryScore: 65 }),
        entry("jp.v.009", { isDue: true, masteryScore: 20 }),
      ],
      dailyReviewGoal: 10,
    });

    expect(plan.due.map((e) => e.itemId)).toEqual(["jp.v.009", "jp.v.007"]);
    expect(plan.newItems).toHaveLength(0);
  });
});

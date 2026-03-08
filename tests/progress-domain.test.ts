import { describe, expect, it } from "vitest";
import { computeMasteryFromProgress, computeDeckCoverage } from "../src/domain/progress";

describe("progress/mastery domain", () => {
  it("calcola mastery in range 0-100 coerente con stato", () => {
    const mastery = computeMasteryFromProgress(
      {
        id: "1",
        user_id: "u1",
        item_id: "V-001",
        state: "review",
        due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        last_reviewed_at: new Date().toISOString(),
        interval_days: 8,
        ease_factor: 2.5,
        reps: 4,
        lapses: 1,
        streak: 3,
        mastery_score: 0,
        last_rating: "Good",
        content_version: "v1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      new Date(),
    );

    expect(mastery.score).toBeGreaterThanOrEqual(0);
    expect(mastery.score).toBeLessThanOrEqual(100);
    expect(mastery.score).toBeGreaterThan(40);
  });

  it("coverage deck usa media pesata delle card coverage", () => {
    const map = new Map<string, number>([
      ["V-005", 90],
      ["V-007", 85],
      ["V-009", 80],
      ["V-010", 78],
    ]);

    const coverage = computeDeckCoverage("dm25-sd1", map);
    expect(coverage).not.toBeNull();
    expect(coverage!.coverage).toBeGreaterThanOrEqual(0);
    expect(coverage!.coverage).toBeLessThanOrEqual(100);
    expect(coverage!.cards.length).toBeGreaterThan(0);
  });
});

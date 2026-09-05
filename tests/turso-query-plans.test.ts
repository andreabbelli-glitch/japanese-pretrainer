import type { InStatement } from "@libsql/client";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { card, reviewMemoryAlias, reviewSubjectLog } from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { buildDailyKanjiCardDataset } from "@/features/daily-kanji/server/exporter";
import { countEligibleFsrsOptimizerReviewsByPreset } from "@/features/fsrs-optimizer/server/training-data";

import { withTestDatabase } from "./helpers/test-db";

const nowIso = "2026-09-05T08:42:26.000Z";

describe("Turso top query regressions", () => {
  it("counts snapshots and legacy fallbacks in one indexed statement", async () => {
    await withTestDatabase(
      { prefix: "jcs-preset-count-plan-", seedDevelopmentFixture: true },
      async ({ database }) => {
        await database.delete(reviewSubjectLog);
        await expect(
          countEligibleFsrsOptimizerReviewsByPreset(database)
        ).resolves.toEqual({ concept: 0, recognition: 0 });

        await database.insert(reviewSubjectLog).values([
          event("snapshot-recognition"),
          event("deleted-card-snapshot", { cardId: "deleted-card" }),
          event("snapshot-concept", { cardTypeSnapshot: "concept" }),
          event("legacy", { cardTypeSnapshot: null }),
          event("orphan-legacy", {
            cardId: "deleted-card",
            cardTypeSnapshot: null
          }),
          event("other-preset", { cardTypeSnapshot: "cloze" }),
          event("empty-preset", { cardTypeSnapshot: "" }),
          event("unrated", { rating: null }),
          event("reset", { eventKind: "reset" })
        ]);
        const executeSpy = vi.spyOn(database.$client, "execute");

        await expect(
          countEligibleFsrsOptimizerReviewsByPreset(database)
        ).resolves.toEqual({ concept: 1, recognition: 3 });
        expect(executeSpy).toHaveBeenCalledTimes(1);
        const statement = executeSpy.mock.calls[0]![0];
        executeSpy.mockRestore();

        const plan = await explain(database, statement);
        expect(
          plan.filter((line) =>
            line.includes("review_subject_log_preset_count_idx")
          )
        ).toHaveLength(2);
        expect(plan.join("\n")).not.toMatch(/SCAN review_subject_log/u);

        await database
          .update(card)
          .set({ cardType: "concept" })
          .where(eq(card.id, developmentFixture.primaryCardId));
        // Editing a live card affects only the legacy event without a snapshot.
        await expect(
          countEligibleFsrsOptimizerReviewsByPreset(database)
        ).resolves.toEqual({ concept: 2, recognition: 2 });
      }
    );
  });

  it("bounds recent errors by date and indexes their joins without changing aliases or cutoffs", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-query-plan-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const identity = await database.query.reviewCardIdentity.findFirst({
          where: (table, { eq }) =>
            eq(table.cardId, developmentFixture.primaryCardId)
        });
        const alias = "mnemonic:v1:recognition:entry:term:old-import-id";
        await database.insert(reviewMemoryAlias).values({
          aliasMemoryKey: alias,
          currentMemoryKey: identity!.memoryKey,
          migratedAt: nowIso,
          reason: "test import alias"
        });
        const recentEvent = {
          eventSchemaVersion: 2,
          memoryKey: alias,
          rating: "again" as const
        };
        await database.insert(reviewSubjectLog).values([
          event("cutoff", {
            ...recentEvent,
            answeredAt: "2026-09-02T08:42:26.000Z"
          }),
          event("now", { ...recentEvent, rating: "hard" }),
          event("expired", {
            ...recentEvent,
            answeredAt: "2026-09-02T08:42:25.999Z"
          }),
          event("future", {
            ...recentEvent,
            answeredAt: "2026-09-05T08:42:26.001Z"
          }),
          event("reset-recent", { ...recentEvent, eventKind: "reset" })
        ]);
        const executeSpy = vi.spyOn(database.$client, "execute");
        const result = await buildDailyKanjiCardDataset({ database, nowIso });
        const statements = executeSpy.mock.calls.map(
          ([statement]) => statement
        );
        executeSpy.mockRestore();
        const exported = result.cards.find(
          (entry) => entry.cardId === developmentFixture.primaryCardId
        );
        expect(exported?.srs).toMatchObject({
          recentHardAgainCount: 2,
          lastHardAgainAt: nowIso
        });
        expect(exported?.studyModes?.lastLessonsHardAgain).toBeDefined();
        expect(statements).toHaveLength(4);

        const plans = await Promise.all(
          statements.map((statement) => explain(database, statement))
        );
        const recentPlans = plans.filter((plan) =>
          plan.some((line) =>
            line.includes("review_subject_log_recent_rating_idx")
          )
        );
        expect(recentPlans).toHaveLength(2);
        for (const plan of recentPlans) {
          expect(plan.join("\n")).toMatch(/answered_at>\? AND answered_at<\?/u);
          expect(plan.join("\n")).not.toMatch(/SCAN rha(?:\s|$)/u);
        }
        const dailyPlan = plans.find((plan) =>
          plan.some((line) => line.includes("eligible_cards"))
        );
        // The largest query must not depend on automatic indexes on a CTE:
        // Turso and local SQLite can make different planner choices.
        expect(dailyPlan).toBeDefined();
        expect(dailyPlan?.join("\n")).not.toContain("rha");
        expect(dailyPlan?.join("\n")).not.toContain("review_subject_log");
        expect(plans.flat().join("\n")).toContain("MATERIALIZE recent_lessons");
      }
    );
  });
});

function event(
  id: string,
  overrides: Partial<typeof reviewSubjectLog.$inferInsert> = {}
): typeof reviewSubjectLog.$inferInsert {
  return {
    id,
    answeredAt: nowIso,
    cardId: developmentFixture.primaryCardId,
    cardTypeSnapshot: "recognition",
    eventKind: "grade",
    rating: "good",
    subjectKey: "test-subject",
    ...overrides
  };
}

async function explain(database: DatabaseClient, statement: InStatement) {
  const result = await database.$client.execute(
    typeof statement === "string"
      ? `EXPLAIN QUERY PLAN ${statement}`
      : { ...statement, sql: `EXPLAIN QUERY PLAN ${statement.sql}` }
  );
  return result.rows.map((row) => String(row.detail));
}

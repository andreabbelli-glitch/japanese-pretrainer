import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { reviewCanonicalControl, reviewMemoryAlias } from "@/db/schema";
import { withTestDatabase } from "./helpers/test-db";

type TableColumn = {
  name: string;
  notnull: number;
};

async function listIndexColumns(
  database: Parameters<Parameters<typeof withTestDatabase>[1]>[0]["database"],
  indexName: string
) {
  const columns = await database.all<{ name: string; seqno: number }>(
    `PRAGMA index_info('${indexName}')`
  );

  return columns.map(({ name, seqno }) => ({ name, seqno }));
}

describe("review memory schema foundation", () => {
  it("migrates additively with nullable transition columns and lookup indexes", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-review-memory-schema-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        const stateColumns = await database.all<TableColumn>(
          "PRAGMA table_info('review_subject_state')"
        );
        const consolidationColumns = await database.all<TableColumn>(
          "PRAGMA table_info('pre_review_consolidation_state')"
        );
        const logColumns = await database.all<TableColumn>(
          "PRAGMA table_info('review_subject_log')"
        );

        expect(
          stateColumns
            .filter((column) =>
              ["canonical_subject_key", "recall_task"].includes(column.name)
            )
            .map((column) => [column.name, column.notnull])
        ).toEqual([
          ["canonical_subject_key", 0],
          ["recall_task", 0]
        ]);
        expect(
          consolidationColumns
            .filter((column) =>
              ["canonical_subject_key", "recall_task"].includes(column.name)
            )
            .map((column) => [column.name, column.notnull])
        ).toEqual([
          ["canonical_subject_key", 0],
          ["recall_task", 0]
        ]);
        expect(
          logColumns
            .filter((column) => column.name === "memory_key")
            .map((column) => [column.name, column.notnull])
        ).toEqual([["memory_key", 0]]);

        await expect(
          Promise.all([
            listIndexColumns(
              database,
              "review_subject_state_canonical_task_idx"
            ),
            listIndexColumns(
              database,
              "pre_review_consolidation_canonical_task_idx"
            ),
            listIndexColumns(database, "review_subject_log_memory_idx"),
            listIndexColumns(database, "review_subject_log_training_v2_idx"),
            listIndexColumns(database, "review_subject_log_study_day_v2_idx"),
            listIndexColumns(database, "review_memory_alias_current_idx")
          ])
        ).resolves.toEqual([
          [
            { name: "canonical_subject_key", seqno: 0 },
            { name: "recall_task", seqno: 1 }
          ],
          [
            { name: "canonical_subject_key", seqno: 0 },
            { name: "recall_task", seqno: 1 }
          ],
          [{ name: "memory_key", seqno: 0 }],
          [
            { name: "event_kind", seqno: 0 },
            { name: "recall_task", seqno: 1 },
            { name: "memory_key", seqno: 2 },
            { name: "answered_at", seqno: 3 },
            { name: "id", seqno: 4 }
          ],
          [
            { name: "event_kind", seqno: 0 },
            { name: "study_day", seqno: 1 },
            { name: "previous_state", seqno: 2 },
            { name: "memory_key", seqno: 3 },
            { name: "media_id_snapshot", seqno: 4 }
          ],
          [{ name: "current_memory_key", seqno: 0 }]
        ]);
      }
    );
  });

  it("persists memory aliases and canonical manual controls", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-review-memory-control-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        const nowIso = "2026-07-16T12:00:00.000Z";

        await database.insert(reviewMemoryAlias).values({
          aliasMemoryKey: "mnemonic:v1:recognition:entry:term:old",
          currentMemoryKey: "mnemonic:v1:recognition:group:term:current",
          migratedAt: nowIso,
          reason: "canonical_merge"
        });
        await database.insert(reviewCanonicalControl).values({
          canonicalSubjectKey: "group:term:current",
          createdAt: nowIso,
          status: "known_manual",
          updatedAt: nowIso
        });

        await expect(
          database.query.reviewMemoryAlias.findFirst({
            where: eq(
              reviewMemoryAlias.aliasMemoryKey,
              "mnemonic:v1:recognition:entry:term:old"
            )
          })
        ).resolves.toMatchObject({
          currentMemoryKey: "mnemonic:v1:recognition:group:term:current",
          reason: "canonical_merge"
        });
        await expect(
          database.query.reviewCanonicalControl.findFirst({
            where: eq(
              reviewCanonicalControl.canonicalSubjectKey,
              "group:term:current"
            )
          })
        ).resolves.toMatchObject({ status: "known_manual" });
      }
    );
  });
});

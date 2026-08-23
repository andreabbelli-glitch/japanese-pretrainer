import { describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

import {
  ensureReviewCardIdentityCache,
  loadReviewCardIdentityCacheCoverage,
  refreshReviewCardIdentityCache
} from "@/db/backfills/review-card-identity";
import {
  buildComputedReviewSubjectIdentityCteSql,
  buildReviewSubjectIdentityCteSql
} from "@/db/queries/review-query-helpers";
import { buildListEligibleKanjiClashSubjectsSql } from "@/db/queries/kanji-clash-eligibility-policy";
import { listReviewCardIdsByEntryRefs } from "@/db/queries/review-subject";
import { card, cardEntryLink, term } from "@/db/schema";
import { developmentFixture } from "@/db/seed";

import { withTestDatabase } from "./helpers/test-db";

describe("review card identity cache", () => {
  it("keeps runtime identity reads on the materialized projection", () => {
    const runtimeSql = buildReviewSubjectIdentityCteSql();
    const rebuildSql = buildComputedReviewSubjectIdentityCteSql();

    expect(runtimeSql).toContain("INNER JOIN review_card_identity rci");
    expect(runtimeSql).toContain("rci.driving_link_count");
    expect(runtimeSql).not.toContain("driving_links");
    expect(runtimeSql).not.toContain("NOT EXISTS");
    expect(rebuildSql).toContain("driving_links");

    const kanjiClashSql = buildListEligibleKanjiClashSubjectsSql();

    expect(kanjiClashSql).toContain("review_card_identity");
    expect(kanjiClashSql).toContain("rci.driving_link_count = 1");
    expect(kanjiClashSql).not.toContain("card_entry_link");
    expect(kanjiClashSql).not.toContain("NOT EXISTS");
  });

  it("detects and repairs uncovered cards before runtime queries can use them", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-review-card-identity-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const before = await loadReviewCardIdentityCacheCoverage(database, {
          mediaIds: [developmentFixture.mediaId]
        });

        expect(before).toEqual({
          cardCount: 2,
          identityCount: 2,
          missingCount: 0,
          outdatedCount: 0
        });

        await database.insert(card).values({
          back: "senza link",
          cardType: "recognition",
          createdAt: "2026-08-23T12:00:00.000Z",
          front: "孤立",
          id: "card_identity_cache_uncovered",
          lessonId: developmentFixture.lessonId,
          mediaId: developmentFixture.mediaId,
          normalizedFront: "孤立",
          orderIndex: 99,
          segmentId: developmentFixture.segmentId,
          sourceFile: "tests/review-card-identity-cache.md",
          status: "active",
          updatedAt: "2026-08-23T12:00:00.000Z"
        });

        const uncovered = await loadReviewCardIdentityCacheCoverage(database, {
          mediaIds: [developmentFixture.mediaId]
        });

        expect(uncovered.missingCount).toBe(1);

        const repaired = await ensureReviewCardIdentityCache(database);
        const plan = await database.all<{ detail: string }>(`
          EXPLAIN QUERY PLAN
          WITH ${buildReviewSubjectIdentityCteSql()}
          SELECT subject_key
          FROM subject_identity
        `);
        const [identity] = await database.all<{
          canonicalSubjectKey: string;
          subjectKey: string;
        }>(`
          WITH ${buildReviewSubjectIdentityCteSql()}
          SELECT
            canonical_subject_key AS canonicalSubjectKey,
            subject_key AS subjectKey
          FROM subject_identity
          WHERE card_id = 'card_identity_cache_uncovered'
        `);

        expect(repaired).toEqual({
          cardCount: 3,
          identityCount: 3,
          missingCount: 0,
          outdatedCount: 0
        });
        expect(plan.map((row) => row.detail).join("\n")).toContain(
          "review_card_identity"
        );
        expect(plan.map((row) => row.detail).join("\n")).not.toContain(
          "CORRELATED"
        );
        expect(identity).toEqual({
          canonicalSubjectKey: "card:card_identity_cache_uncovered",
          subjectKey:
            "mnemonic:v1:recognition:card:card_identity_cache_uncovered"
        });

        const executeSpy = vi.spyOn(database.$client, "execute");
        const steadyState = await ensureReviewCardIdentityCache(database);
        const steadyStateQueryLog = executeSpy.mock.calls
          .map((call) => serializeExecuteInput((call as unknown[])[0]))
          .join("\n");

        expect(steadyState).toEqual(repaired);
        expect(steadyStateQueryLog).not.toContain("driving_links");
        expect(steadyStateQueryLog).not.toContain(
          "INSERT INTO review_card_identity"
        );
        executeSpy.mockRestore();

        await database.run(sql`
          UPDATE review_card_identity
          SET projection_version = 0
          WHERE card_id = ${developmentFixture.primaryCardId}
        `);
        expect(
          await loadReviewCardIdentityCacheCoverage(database)
        ).toMatchObject({ outdatedCount: 1 });
        expect(await ensureReviewCardIdentityCache(database)).toEqual(repaired);
      }
    );
  });

  it("resolves review mutation cards through the indexed identity cache", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-review-card-identity-lookup-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const executeSpy = vi.spyOn(database.$client, "execute");
        const cardIds = await listReviewCardIdsByEntryRefs(database, [
          {
            entryId: developmentFixture.termDbId,
            entryType: "term"
          }
        ]);
        const queryLog = executeSpy.mock.calls
          .map((call) => serializeExecuteInput((call as unknown[])[0]))
          .join("\n");

        expect(cardIds).toEqual([developmentFixture.primaryCardId]);
        expect(queryLog).toContain("review_card_identity");
        expect(queryLog).toContain("rci.driving_link_count = 1");
        expect(queryLog).not.toContain("card_entry_link");
        expect(queryLog).not.toContain("NOT EXISTS");

        executeSpy.mockRestore();
      }
    );
  });

  it("preserves singleton-link semantics without runtime aggregation", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-review-card-identity-singleton-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const competingTermId = "term_identity_cache_competing";

        await database.insert(term).values({
          createdAt: "2026-08-23T12:00:00.000Z",
          id: competingTermId,
          lemma: "競合",
          meaningIt: "conflitto",
          mediaId: developmentFixture.mediaId,
          reading: "きょうごう",
          romaji: "kyougou",
          searchLemmaNorm: "競合",
          searchReadingNorm: "きょうごう",
          searchRomajiNorm: "kyougou",
          segmentId: developmentFixture.segmentId,
          sourceId: competingTermId,
          updatedAt: "2026-08-23T12:00:00.000Z"
        });
        await database.insert(cardEntryLink).values({
          cardId: developmentFixture.primaryCardId,
          entryId: competingTermId,
          entryType: "term",
          id: "card_entry_link_identity_cache_competing",
          relationshipType: "primary"
        });
        await refreshReviewCardIdentityCache(database, {
          mediaIds: [developmentFixture.mediaId]
        });

        const identity = await database.query.reviewCardIdentity.findFirst({
          where: (table, { eq }) =>
            eq(table.cardId, developmentFixture.primaryCardId)
        });
        const cardIds = await listReviewCardIdsByEntryRefs(database, [
          {
            entryId: competingTermId,
            entryType: "term"
          }
        ]);

        expect(identity?.drivingLinkCount).toBe(2);
        expect(cardIds).toEqual([]);
      }
    );
  });
});

function serializeExecuteInput(input: unknown) {
  if (typeof input === "string") {
    return input;
  }

  if (input && typeof input === "object" && "sql" in input) {
    const { sql: querySql } = input as { sql?: unknown };

    return typeof querySql === "string" ? querySql : "";
  }

  return "";
}

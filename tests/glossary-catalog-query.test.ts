import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  countGlobalGlossaryBrowseGroups,
  listGlobalGlossaryBrowseGroupRefs
} from "@/db/queries";
import { card, term } from "@/db/schema";
import { developmentFixture } from "@/db/seed";

import { withTestDatabase } from "./helpers/test-db";

function statementSql(statement: string | { sql: string }) {
  return typeof statement === "string" ? statement : statement.sql;
}

describe("glossary catalog browse", () => {
  it("filters card presence without loading review states and ignores archived cards", async () => {
    await withTestDatabase(
      { prefix: "jcs-glossary-catalog-", seedDevelopmentFixture: true },
      async ({ database }) => {
        const existing = await database.query.term.findFirst();
        await database.insert(term).values({
          ...existing!,
          id: "term-without-card",
          sourceId: "term-without-card",
          crossMediaGroupId: null,
          lemma: "未登録"
        });

        const execute = vi.spyOn(database.$client, "execute");
        const scope = { entryType: "term" as const, page: 1, pageSize: 20 };
        try {
          const withCards = await listGlobalGlossaryBrowseGroupRefs(database, {
            ...scope,
            cards: "with_cards"
          });
          const withoutCards = await listGlobalGlossaryBrowseGroupRefs(
            database,
            {
              ...scope,
              cards: "without_cards"
            }
          );
          expect(withCards.map((row) => row.internalId)).toEqual([
            existing!.id
          ]);
          expect(withoutCards.map((row) => row.internalId)).toEqual([
            "term-without-card"
          ]);
          await expect(
            countGlobalGlossaryBrowseGroups(database, {
              cards: "all",
              entryType: "term"
            })
          ).resolves.toBe(2);

          const statements = execute.mock.calls.map(([statement]) =>
            statementSql(statement)
          );
          expect(
            statements.every((sql) => !sql.includes("review_subject_state"))
          ).toBe(true);

          await database
            .update(card)
            .set({ status: "archived" })
            .where(eq(card.id, developmentFixture.primaryCardId));
          await expect(
            countGlobalGlossaryBrowseGroups(database, {
              cards: "with_cards",
              entryType: "term"
            })
          ).resolves.toBe(0);
          await expect(
            countGlobalGlossaryBrowseGroups(database, {
              cards: "without_cards",
              entryType: "term"
            })
          ).resolves.toBe(2);

          execute.mockClear();
          await listGlobalGlossaryBrowseGroupRefs(database, {
            ...scope,
            cards: "all",
            study: "review"
          });
          const statement = execute.mock.calls[0]![0];
          expect(statementSql(statement)).toContain("review_subject_state");
        } finally {
          execute.mockRestore();
        }
      }
    );
  });
});

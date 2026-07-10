import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { listGlossarySearchCandidateRefs } from "@/db/queries";

describe("glossary search candidate limits", () => {
  it("applies the autocomplete row cap to both entry types in SQL", async () => {
    const execute = vi.fn(
      async (statement: { args: Array<number | string>; sql: string }) => {
        void statement;

        return { rows: [] };
      }
    );
    const database = {
      $client: {
        execute
      }
    } as unknown as DatabaseClient;

    await listGlossarySearchCandidateRefs(database, {
      grammarKana: "per",
      kana: "per",
      limit: 65,
      normalized: "per",
      romajiCompact: "per"
    });

    expect(execute).toHaveBeenCalledTimes(2);

    for (const [statement] of execute.mock.calls) {
      expect(statement.sql).toContain("limit ?");
      expect(statement.args.at(-1)).toBe(65);
    }
  });

  it("pushes media, card, and study filters into the capped candidate query", async () => {
    const execute = vi.fn(
      async (statement: { args: Array<number | string>; sql: string }) => {
        void statement;

        return { rows: [] };
      }
    );
    const database = {
      $client: {
        execute
      }
    } as unknown as DatabaseClient;

    await listGlossarySearchCandidateRefs(database, {
      cards: "with_cards",
      entryType: "term",
      grammarKana: "per",
      kana: "per",
      limit: 65,
      mediaSlug: "scoped-media",
      normalized: "per",
      romajiCompact: "per",
      study: "review"
    });

    expect(execute).toHaveBeenCalledTimes(1);
    const statement = execute.mock.calls[0]?.[0];

    expect(statement?.sql).toContain("search_scope_media.slug = ?");
    expect(statement?.sql).toContain("search_scope_card.status != 'archived'");
    expect(statement?.sql).toContain(
      "search_scope_state.state in ('review', 'relearning')"
    );
    expect(
      statement?.args.filter((argument) => argument === "scoped-media")
    ).toHaveLength(2);
    expect(statement?.args.at(-1)).toBe(65);
  });
});

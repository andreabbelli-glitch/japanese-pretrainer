import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { closeDatabaseClient, createDatabaseClient } from "@/db";
import { runMigrations } from "@/db/migrate";
import { importContentWorkspace } from "@/lib/content/importer";
import { parseMediaDirectory } from "@/lib/content";
import { repositoryRoot } from "./helpers/content-fixtures";
import { readDuelMastersRealBundleStats } from "./helpers/duel-masters-real-bundle-stats";
import { realDuelMastersMediaDirectory } from "./helpers/real-content-fixtures";

describe("real Duel Masters content canary", () => {
  it("parses the real bundle against aggregate canary stats", async () => {
    const expectedStats = await readDuelMastersRealBundleStats();
    const result = await parseMediaDirectory(realDuelMastersMediaDirectory);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.data.media?.frontmatter.id).toBe("media-duel-masters-dm25");
    expect(result.data.media?.frontmatter.slug).toBe("duel-masters-dm25");
    expect({
      lessons: result.data.lessons.length,
      cardFiles: result.data.cardFiles.length,
      terms: result.data.terms.length,
      grammarPatterns: result.data.grammarPatterns.length,
      cards: result.data.cards.length,
      references: result.data.references.length
    }).toEqual(expectedStats.parser);
  }, 60_000);

  it("imports the real bundle against aggregate canary stats", async () => {
    const expectedStats = await readDuelMastersRealBundleStats();
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-real-canary-"));
    const database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    try {
      await runMigrations(database);

      const result = await importContentWorkspace({
        contentRoot: path.join(repositoryRoot, "content"),
        database,
        mediaSlugs: ["duel-masters-dm25"],
        now: new Date("2026-03-10T09:00:00.000Z")
      });

      expect(result.status).toBe("completed");
      expect(result.issues).toEqual([]);
      expect(result.parseResult.data.bundles).toHaveLength(1);
      expect(result.parseResult.data.bundles[0]?.mediaSlug).toBe(
        "duel-masters-dm25"
      );
      expect({
        term: await countRows(database.query.term.findMany()),
        termAlias: await countRows(database.query.termAlias.findMany()),
        grammarPattern: await countRows(
          database.query.grammarPattern.findMany()
        ),
        grammarAlias: await countRows(database.query.grammarAlias.findMany()),
        entryLink: await countRows(database.query.entryLink.findMany()),
        card: await countRows(database.query.card.findMany()),
        cardEntryLink: await countRows(database.query.cardEntryLink.findMany())
      }).toEqual(expectedStats.importer);
    } finally {
      closeDatabaseClient(database);
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 60_000);
});

async function countRows<T>(promise: Promise<T[]>) {
  return (await promise).length;
}

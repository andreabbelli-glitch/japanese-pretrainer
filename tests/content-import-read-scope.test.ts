import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { importContentWorkspace } from "@/features/content/importer";
import { buildContentWorkspaceSyncPlan } from "@/features/content/importer/sync";
import { parseContentRoot } from "@/features/content/validator";
import {
  richContentFixture,
  writeRichContentFixture
} from "./helpers/content-fixtures";

describe("content import lesson text reads", () => {
  let directory: string;
  let contentRoot: string;
  let database: DatabaseClient;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "jcs-import-read-scope-"));
    contentRoot = path.join(directory, "content");
    database = createDatabaseClient({
      databaseUrl: path.join(directory, "test.sqlite")
    });
    await runMigrations(database);
    await writeRichContentFixture(contentRoot);

    for (let index = 0; index < 12; index += 1) {
      await writeFile(
        path.join(
          contentRoot,
          "media",
          richContentFixture.mediaSlug,
          "textbook",
          `read-scope-${index}.md`
        ),
        [
          "---",
          `id: lesson-read-scope-${index}`,
          `media_id: ${richContentFixture.mediaId}`,
          `slug: read-scope-${index}`,
          `title: Read scope ${index}`,
          `order: ${100 + index}`,
          "difficulty: n5",
          "status: active",
          "---",
          "",
          `Testo della lezione ${index}.`
        ].join("\n")
      );
    }

    expect(
      (await importContentWorkspace({ contentRoot, database })).status
    ).toBe("completed");
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(directory, { recursive: true, force: true });
  });

  it("loads only selected lesson bodies while retaining metadata for archival decisions", async () => {
    const parsed = await parseContentRoot(contentRoot);
    expect(parsed.ok).toBe(true);
    const plan = await database.transaction((transaction) =>
      buildContentWorkspaceSyncPlan(transaction, {
        contentRoot,
        lessonScopes: [
          {
            mediaSlug: richContentFixture.mediaSlug,
            lessonSlugs: [richContentFixture.lessonFollowupSlug]
          }
        ],
        nowIso: new Date().toISOString(),
        workspace: parsed.data
      })
    );

    expect(plan.filesChanged).toBe(0);
    const existing = plan.mediaPlans[0]!.existingState;
    expect(existing.lessons).toHaveLength(14);
    expect(existing.lessonContents.map((row) => row.lessonId)).toEqual([
      richContentFixture.lessonFollowupId
    ]);
    expect(await database.query.lessonContent.findMany()).toHaveLength(14);
  });

  it("reads all lesson bodies in bounded groups for a full import", async () => {
    const parsed = await parseContentRoot(contentRoot);
    expect(parsed.ok).toBe(true);
    const plan = await database.transaction(async (transaction) => {
      const reads = vi.spyOn(transaction.query.lessonContent, "findMany");
      const result = await buildContentWorkspaceSyncPlan(transaction, {
        contentRoot,
        nowIso: new Date().toISOString(),
        workspace: parsed.data
      });
      expect(reads.mock.calls.length).toBeGreaterThan(1);
      reads.mockRestore();
      return result;
    });

    expect(plan.filesChanged).toBe(0);
    expect(plan.mediaPlans[0]!.existingState.lessonContents).toHaveLength(14);
  });
});

import { access } from "node:fs/promises";

import { describe, expect, inject, it } from "vitest";

import { lessonProgress } from "@/db/schema";

import { TEST_DATABASE_TEMPLATE_CONTEXT_KEY } from "./test-db-context";
import {
  cleanupTestDatabase,
  markLessonsCompleted,
  setupTestDatabase,
  withTestDatabase
} from "./test-db";

describe("test database helpers", () => {
  it("creates and cleans up a migrated temporary database", async () => {
    const fixture = await setupTestDatabase({
      prefix: "jcs-test-db-helper-"
    });

    try {
      const mediaRows = await fixture.database.query.media.findMany();
      const schemaRows = await fixture.database.$client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );
      const migrationJournal = await fixture.database.$client.execute(
        "SELECT COUNT(*) AS migration_count FROM __drizzle_migrations"
      );
      const tableNames = schemaRows.rows.map((row) => String(row.name));

      expect(mediaRows).toEqual([]);
      expect(tableNames).toContain("media");
      expect(tableNames).toContain("__drizzle_migrations");
      expect(
        Number(migrationJournal.rows[0]?.migration_count ?? 0)
      ).toBeGreaterThan(0);
      expect(fixture.databasePath.endsWith("test.sqlite")).toBe(true);
      expect(fixture.tempDir).toContain("jcs-test-db-helper-");
    } finally {
      await cleanupTestDatabase(fixture);
    }
  });

  it("uses one migrated template while keeping concurrent copies isolated", async () => {
    const templatePath = inject(TEST_DATABASE_TEMPLATE_CONTEXT_KEY);
    await expect(access(templatePath)).resolves.toBeUndefined();

    const [seededFixture, emptyFixture] = await Promise.all([
      setupTestDatabase({
        prefix: "jcs-test-db-helper-concurrent-seeded-",
        seedDevelopmentFixture: true
      }),
      setupTestDatabase({
        prefix: "jcs-test-db-helper-concurrent-empty-"
      })
    ]);

    try {
      expect(seededFixture.databasePath).not.toBe(emptyFixture.databasePath);
      expect(await seededFixture.database.query.media.findMany()).toHaveLength(
        1
      );
      expect(await emptyFixture.database.query.media.findMany()).toEqual([]);
    } finally {
      await Promise.all([
        cleanupTestDatabase(seededFixture),
        cleanupTestDatabase(emptyFixture)
      ]);
    }
  });

  it("runs a callback with a temporary database and cleans it up", async () => {
    let databasePath: string | undefined;
    const mediaCount = await withTestDatabase(
      {
        prefix: "jcs-test-db-helper-callback-"
      },
      async ({ database, databasePath: callbackDatabasePath }) => {
        databasePath = callbackDatabasePath;
        await expect(access(callbackDatabasePath)).resolves.toBeUndefined();
        return (await database.query.media.findMany()).length;
      }
    );

    expect(mediaCount).toBe(0);
    expect(databasePath).toBeDefined();
    await expect(access(databasePath!)).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("marks selected lessons as completed", async () => {
    const completedAt = "2026-03-11T09:00:00.000Z";
    await withTestDatabase(
      {
        prefix: "jcs-test-db-helper-lessons-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const [lessonRow] = await database.query.lesson.findMany({
          limit: 1
        });

        expect(lessonRow).toBeDefined();

        await markLessonsCompleted(database, completedAt, {
          lessonIds: [lessonRow!.id]
        });

        const progressRows = await database.select().from(lessonProgress);

        expect(progressRows).toContainEqual(
          expect.objectContaining({
            completedAt,
            lastOpenedAt: completedAt,
            lessonId: lessonRow!.id,
            status: "completed"
          })
        );
      }
    );
  });
});

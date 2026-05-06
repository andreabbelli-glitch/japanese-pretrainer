import { describe, expect, it } from "vitest";

import { lessonProgress } from "@/db/schema";

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

      expect(mediaRows).toEqual([]);
      expect(fixture.databasePath.endsWith("test.sqlite")).toBe(true);
      expect(fixture.tempDir).toContain("jcs-test-db-helper-");
    } finally {
      await cleanupTestDatabase(fixture);
    }
  });

  it("runs a callback with a temporary database and cleans it up", async () => {
    const mediaCount = await withTestDatabase(
      {
        prefix: "jcs-test-db-helper-callback-"
      },
      async ({ database }) => {
        return (await database.query.media.findMany()).length;
      }
    );

    expect(mediaCount).toBe(0);
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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { lessonProgress } from "@/db/schema";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { recordLessonOpened } from "@/features/textbook/server";

describe("textbook progress write throttling", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-textbook-throttle-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reuses recent opened lesson state without rewriting last opened time", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        startedAt: "2026-03-09T10:00:00.000Z",
        completedAt: null,
        lastOpenedAt: "2026-03-10T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-03-10T10:04:00.000Z"));

      const openedState = await recordLessonOpened(
        developmentFixture.lessonId,
        database
      );
      const progress = await database.query.lessonProgress.findFirst({
        where: eq(lessonProgress.lessonId, developmentFixture.lessonId)
      });

      expect(openedState).toEqual({
        lastOpenedAt: "2026-03-10T10:00:00.000Z",
        startedAt: "2026-03-09T10:00:00.000Z",
        status: "in_progress"
      });
      expect(progress?.lastOpenedAt).toBe("2026-03-10T10:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});

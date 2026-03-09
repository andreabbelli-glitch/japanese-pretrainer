import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  mediaProgress,
  reviewState,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import { getDashboardData, getMediaDetailData } from "@/lib/app-shell";

describe("app shell live data", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-app-shell-"));
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

  it("derives overview metrics from live lesson, entry, and review tables", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z",
        lastOpenedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    await database
      .update(reviewState)
      .set({
        state: "known_manual",
        dueAt: "2026-03-01T00:00:00.000Z",
        manualOverride: true
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database
      .update(mediaProgress)
      .set({
        lessonsCompleted: 0,
        lessonsTotal: 99,
        entriesKnown: 0,
        entriesTotal: 99,
        cardsDue: 99,
        updatedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(mediaProgress.mediaId, developmentFixture.mediaId));

    const media = await getMediaDetailData(developmentFixture.mediaSlug, database);

    expect(media).not.toBeNull();
    expect(media?.lessonsCompleted).toBe(1);
    expect(media?.lessonsTotal).toBe(1);
    expect(media?.entriesKnown).toBe(2);
    expect(media?.entriesTotal).toBe(2);
    expect(media?.cardsDue).toBe(0);
    expect(media?.activeReviewCards).toBe(1);
    expect(media?.reviewStatValue).toBe("In pari");
    expect(media?.reviewStatDetail).toContain("rotazione");

    const dashboard = await getDashboardData(database);

    expect(dashboard.totals.lessonsCompleted).toBe(1);
    expect(dashboard.totals.entriesKnown).toBe(2);
    expect(dashboard.totals.cardsDue).toBe(0);
    expect(dashboard.totals.activeReviewCards).toBe(1);
  });
});

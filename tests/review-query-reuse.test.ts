import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import { getReviewPageData, getReviewQueueSnapshotForMedia } from "@/lib/review";

describe("review media query reuse", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-query-reuse-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("builds the media review page from the loaded media rows without a slug lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");
    const mediaFindManySpy = vi.spyOn(database.query.media, "findMany");

    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(pageData).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();
    expect(mediaFindManySpy).toHaveBeenCalledTimes(1);

    mediaFindFirstSpy.mockRestore();
    mediaFindManySpy.mockRestore();
  });

  it("builds the media queue snapshot from the loaded media rows without a slug lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");
    const mediaFindManySpy = vi.spyOn(database.query.media, "findMany");

    const queueSnapshot = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(queueSnapshot).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();
    expect(mediaFindManySpy).toHaveBeenCalledTimes(1);

    mediaFindFirstSpy.mockRestore();
    mediaFindManySpy.mockRestore();
  });
});

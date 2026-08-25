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
import {
  listEligibleReviewQueueSkeletonRowsByMediaIds,
  listEligibleReviewWorkspaceCardsByMediaIds
} from "@/db/queries";
import { runMigrations } from "@/db/migrate";
import { card, lesson, lessonProgress } from "@/db/schema";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { loadStableReviewWorkspaceV2 } from "@/features/review/server/loader";
import { loadStableReviewOverviewWorkspace } from "@/features/review/server/overview-loader";

describe("review workspace card query", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-card-query-"));
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

  it("returns only lesson-eligible cards while preserving the raw empty-state count", async () => {
    await database
      .update(lessonProgress)
      .set({ status: "in_progress", completedAt: null })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const mediaQuerySpy = vi.spyOn(database.query.media, "findMany");
    const blocked = await listEligibleReviewWorkspaceCardsByMediaIds(database, [
      developmentFixture.mediaId
    ]);

    expect(blocked.cards).toEqual([]);
    expect(blocked.rawCardCount).toBe(2);
    expect(mediaQuerySpy).toHaveBeenCalledTimes(1);

    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const eligible = await listEligibleReviewWorkspaceCardsByMediaIds(
      database,
      [developmentFixture.mediaId]
    );

    expect(eligible.cards.map((reviewCard) => reviewCard.id)).toEqual([
      developmentFixture.primaryCardId,
      developmentFixture.secondaryCardId
    ]);
    expect(eligible.cards[0]?.lesson).toMatchObject({
      progress: { status: "completed" },
      status: "active"
    });
    expect(eligible.cards[0]?.entryLinks).toHaveLength(1);
    expect(eligible.cards[0]?.segment?.title).toBe("Starter Core");
    expect(eligible.rawCardCount).toBe(2);

    mediaQuerySpy.mockRestore();
  });

  it("excludes inactive lessons and archived cards without hiding raw non-archived cards", async () => {
    await database
      .update(lesson)
      .set({ status: "archived" })
      .where(eq(lesson.id, developmentFixture.lessonId));
    await database
      .update(card)
      .set({ status: "archived" })
      .where(eq(card.id, developmentFixture.secondaryCardId));

    const result = await listEligibleReviewWorkspaceCardsByMediaIds(database, [
      developmentFixture.mediaId
    ]);

    expect(result.cards).toEqual([]);
    expect(result.rawCardCount).toBe(1);
  });

  it("does not query the database for an empty media scope", async () => {
    const mediaQuerySpy = vi.spyOn(database.query.media, "findMany");

    await expect(
      listEligibleReviewWorkspaceCardsByMediaIds(database, [])
    ).resolves.toEqual({
      cards: [],
      rawCardCount: 0
    });
    expect(mediaQuerySpy).not.toHaveBeenCalled();

    mediaQuerySpy.mockRestore();
  });

  it("loads only stable queue fields while preserving the raw-card empty state", async () => {
    await database
      .update(lessonProgress)
      .set({ status: "in_progress", completedAt: null })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const blocked = await listEligibleReviewQueueSkeletonRowsByMediaIds(
      database,
      [developmentFixture.mediaId]
    );

    expect(blocked).toMatchObject({
      hasRawCards: true,
      rows: []
    });

    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const eligible = await listEligibleReviewQueueSkeletonRowsByMediaIds(
      database,
      [developmentFixture.mediaId]
    );

    expect(eligible.rows.map((row) => row.id)).toEqual([
      developmentFixture.primaryCardId,
      developmentFixture.secondaryCardId
    ]);
    expect(eligible.rows[0]).toMatchObject({
      mediaId: developmentFixture.mediaId,
      memoryKey: expect.stringMatching(/^mnemonic:v1:/u),
      status: "active"
    });
    expect(eligible.rows[0]).not.toHaveProperty("back");
    expect(eligible.rows[0]).not.toHaveProperty("front");
  });

  it("keeps both stable workspace loaders on the SQL-filtered relational result", async () => {
    const mediaQuerySpy = vi.spyOn(database.query.media, "findMany");
    const cardQuerySpy = vi.spyOn(database.query.card, "findMany");

    const pageWorkspace = await loadStableReviewWorkspaceV2({
      database,
      mediaIds: [developmentFixture.mediaId]
    });
    const overviewWorkspace = await loadStableReviewOverviewWorkspace({
      database,
      mediaIds: [developmentFixture.mediaId]
    });

    expect(pageWorkspace.cards).toHaveLength(2);
    expect(pageWorkspace.rawCardCount).toBe(2);
    expect(pageWorkspace.terms).toHaveLength(1);
    expect(pageWorkspace.grammar).toHaveLength(1);
    expect(overviewWorkspace.cards).toHaveLength(2);
    expect(overviewWorkspace.rawCardCount).toBe(2);
    expect(overviewWorkspace.terms).toHaveLength(1);
    expect(overviewWorkspace.grammar).toHaveLength(1);
    expect(mediaQuerySpy).toHaveBeenCalledTimes(2);
    expect(cardQuerySpy).not.toHaveBeenCalled();

    mediaQuerySpy.mockRestore();
    cardQuerySpy.mockRestore();
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as dataCacheModule from "@/lib/data-cache";
import * as dbModule from "@/db";
import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  media,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import {
  getReviewCardDetailData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  hydrateReviewCard,
  loadGlobalReviewOverviewSnapshot,
  loadReviewOverviewSnapshots
} from "@/lib/review";

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

  it("builds the review card detail without a separate media slug lookup", async () => {
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData).not.toBeNull();
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();

    mediaFindFirstSpy.mockRestore();
  });

  it("does not expose review card detail for archived media slugs", async () => {
    await database
      .update(media)
      .set({ status: "archived" })
      .where(eq(media.id, developmentFixture.mediaId));

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData).toBeNull();
  });

  it("hydrates a single review card with one FSRS settings read when the cache path is enabled", async () => {
    const canUseDataCacheSpy = vi
      .spyOn(dataCacheModule, "canUseDataCache")
      .mockReturnValue(true);
    const runWithTaggedCacheSpy = vi
      .spyOn(dataCacheModule, "runWithTaggedCache")
      .mockImplementation(async ({ loader }) => loader());
    const userSettingFindManySpy = vi.spyOn(database.query.userSetting, "findMany");

    const hydratedCard = await hydrateReviewCard({
      cardId: developmentFixture.primaryCardId,
      database
    });

    expect(hydratedCard).not.toBeNull();
    expect(userSettingFindManySpy).toHaveBeenCalledTimes(1);

    userSettingFindManySpy.mockRestore();
    runWithTaggedCacheSpy.mockRestore();
    canUseDataCacheSpy.mockRestore();
  });

  it("builds the global review overview from a single raw overview query", async () => {
    const databaseAllSpy = vi.spyOn(
      database as DatabaseClient & {
        all: (sql: string) => Promise<unknown[]>;
      },
      "all"
    );

    const overview = await loadGlobalReviewOverviewSnapshot(database);

    expect(overview.queueCount).toBeGreaterThanOrEqual(0);
    expect(
      databaseAllSpy.mock.calls.filter(
        ([sql]) =>
          typeof sql === "string" &&
          sql.includes("global_subject_card_candidates")
      )
    ).toHaveLength(1);

    databaseAllSpy.mockRestore();
  });

  it("builds a single-media overview snapshot without hydrating the full review workspace", async () => {
    const reviewCardsSpy = vi.spyOn(dbModule, "listReviewCardsByMediaIds");
    const termsSpy = vi.spyOn(dbModule, "listTermEntryReviewSummariesByIds");
    const grammarSpy = vi.spyOn(
      dbModule,
      "listGrammarEntryReviewSummariesByIds"
    );

    const snapshots = await loadReviewOverviewSnapshots(database, [
      {
        id: developmentFixture.mediaId,
        slug: developmentFixture.mediaSlug
      }
    ]);

    expect(snapshots.get(developmentFixture.mediaId)?.queueCount).toBeGreaterThanOrEqual(
      0
    );
    expect(reviewCardsSpy).not.toHaveBeenCalled();
    expect(termsSpy).not.toHaveBeenCalled();
    expect(grammarSpy).not.toHaveBeenCalled();

    reviewCardsSpy.mockRestore();
    termsSpy.mockRestore();
    grammarSpy.mockRestore();
  });
});

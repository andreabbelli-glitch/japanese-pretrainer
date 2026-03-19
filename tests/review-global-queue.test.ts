import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  media,
  runMigrations,
  userSetting,
  type DatabaseClient
} from "@/db";
import {
  getGlobalReviewPageData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  loadReviewOverviewSnapshots
} from "@/lib/review";

describe("global review queue filtering", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-global-queue-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("keeps local review pages and per-media snapshots scoped to the selected media while the global queue stays daily-limited", async () => {
    await database.insert(media).values([
      {
        id: "media_a",
        slug: "media-a",
        title: "Media A",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture A",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        id: "media_b",
        slug: "media-b",
        title: "Media B",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture B",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(card).values([
      {
        id: "card_a",
        mediaId: "media_a",
        segmentId: null,
        sourceFile: "tests/review-global-queue/media-a.md",
        cardType: "recognition",
        front: "A",
        back: "A back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T10:00:00.000Z",
        updatedAt: "2026-03-10T10:00:00.000Z"
      },
      {
        id: "card_b",
        mediaId: "media_b",
        segmentId: null,
        sourceFile: "tests/review-global-queue/media-b.md",
        cardType: "recognition",
        front: "B",
        back: "B back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(userSetting).values({
      key: "review_daily_limit",
      valueJson: "1",
      updatedAt: "2026-03-10T11:00:00.000Z"
    });

    const [
      globalPage,
      mediaAPage,
      mediaBPage,
      mediaAQueue,
      mediaBQueue,
      snapshots
    ] = await Promise.all([
      getGlobalReviewPageData({}, database),
      getReviewPageData("media-a", {}, database),
      getReviewPageData("media-b", {}, database),
      getReviewQueueSnapshotForMedia("media-a", database),
      getReviewQueueSnapshotForMedia("media-b", database),
      loadReviewOverviewSnapshots(database, [
        { id: "media_a", slug: "media-a" },
        { id: "media_b", slug: "media-b" }
      ])
    ]);

    expect(globalPage.queue.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_a"
    ]);

    expect(mediaAPage?.queue.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_a"
    ]);
    expect(mediaAPage?.queue.newQueuedCount).toBe(1);
    expect(mediaAPage?.queue.queueCount).toBe(1);

    expect(mediaBPage?.queue.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_b"
    ]);
    expect(mediaBPage?.queue.newAvailableCount).toBe(1);
    expect(mediaBPage?.queue.newQueuedCount).toBe(1);
    expect(mediaBPage?.queue.queueCount).toBe(1);
    expect(mediaBPage?.selectedCard?.id).toBe("card_b");

    expect(mediaAQueue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_a"
    ]);
    expect(mediaAQueue?.newQueuedCount).toBe(1);
    expect(mediaBQueue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_b"
    ]);
    expect(mediaBQueue?.newAvailableCount).toBe(1);
    expect(mediaBQueue?.newQueuedCount).toBe(1);

    expect(snapshots.get("media_a")?.queueCount).toBe(1);
    expect(snapshots.get("media_a")?.newQueuedCount).toBe(1);
    expect(snapshots.get("media_b")?.queueCount).toBe(0);
    expect(snapshots.get("media_b")?.newAvailableCount).toBe(1);
    expect(snapshots.get("media_b")?.newQueuedCount).toBe(0);
  });
});

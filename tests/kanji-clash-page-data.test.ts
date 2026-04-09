import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient
} from "@/db";
import { getKanjiClashPageData } from "@/lib/kanji-clash";
import { updateStudySettings } from "@/lib/settings";
import { seedKanjiClashFixture } from "./helpers/kanji-clash-fixture";

describe("kanji clash page data", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-page-data-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedKanjiClashFixture(database, {
      includeSecondaryMedia: true
    });
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("loads global page data from persisted settings with explicit media catalog", async () => {
    const snapshotAt = new Date("2026-04-09T12:00:00.000Z");

    await updateStudySettings(
      {
        kanjiClashDailyNewLimit: 7,
        kanjiClashDefaultScope: "media",
        kanjiClashManualDefaultSize: 40
      },
      database
    );

    const data = await getKanjiClashPageData({}, database, snapshotAt);

    expect(data.mode).toBe("automatic");
    expect(data.scope).toBe("global");
    expect(data.settings).toMatchObject({
      dailyNewLimit: 7,
      defaultScope: "media",
      manualDefaultSize: 40
    });
    expect(data.settings.manualSizeOptions).toEqual([10, 20, 40]);
    expect(data.availableMedia.map((item) => item.slug)).toEqual(["alpha", "beta"]);
    expect(data.selectedMedia).toBeNull();
    expect(data.queue.scope).toBe("global");
    expect(data.queue.snapshotAtIso).toBe(snapshotAt.toISOString());
    expect(data.currentRound?.pairKey).toBe(data.queue.rounds[0]?.pairKey ?? null);
    expect(data.snapshotAtIso).toBe(snapshotAt.toISOString());
  });

  it("applies explicit manual params, validates size server-side, and filters by media", async () => {
    await updateStudySettings(
      {
        kanjiClashDailyNewLimit: 9,
        kanjiClashManualDefaultSize: 40
      },
      database
    );

    const filtered = await getKanjiClashPageData(
      {
        media: "beta",
        mode: "manual",
        size: "999"
      },
      database,
      new Date("2026-04-09T12:00:00.000Z")
    );
    const global = await getKanjiClashPageData(
      {
        mode: "manual",
        size: "10"
      },
      database,
      new Date("2026-04-09T12:00:00.000Z")
    );

    expect(filtered.mode).toBe("manual");
    expect(filtered.scope).toBe("media");
    expect(filtered.selectedMedia?.slug).toBe("beta");
    expect(filtered.queue.requestedSize).toBe(40);
    expect(filtered.queue.scope).toBe("media");
    expect(filtered.queue.totalCount).toBe(1);
    expect(global.queue.totalCount).toBeGreaterThan(filtered.queue.totalCount);
  });
});

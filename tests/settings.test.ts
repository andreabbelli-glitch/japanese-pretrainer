import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  defaultStudySettings,
  getStudySettings,
  resolveKanjiClashDefaultScope,
  updateStudySettings
} from "@/lib/settings";

describe("study settings", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-settings-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    vi.useRealTimers();
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads kanji clash defaults from an empty database", async () => {
    expect(await getStudySettings(database)).toMatchObject(defaultStudySettings);
  });

  it("persists kanji clash settings alongside the existing study settings", async () => {
    await updateStudySettings(
      {
        kanjiClashDailyNewLimit: 8,
        kanjiClashDefaultScope: "media",
        kanjiClashManualDefaultSize: 40
      },
      database
    );

    expect(await getStudySettings(database)).toMatchObject({
      kanjiClashDailyNewLimit: 8,
      kanjiClashDefaultScope: "media",
      kanjiClashManualDefaultSize: 40
    });
  });

  it("writes only the settings that actually change", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-04-16T10:00:00.000Z"));
    await updateStudySettings(
      {
        furiganaMode: "off",
        reviewDailyLimit: 12
      },
      database
    );

    vi.setSystemTime(new Date("2026-04-16T10:05:00.000Z"));
    await updateStudySettings(
      {
        furiganaMode: "on"
      },
      database
    );

    const rows = await database.query.userSetting.findMany();
    const rowsByKey = new Map(rows.map((row) => [row.key, row]));

    expect(rows).toHaveLength(2);
    expect(rowsByKey.get("furigana_mode")?.valueJson).toBe('"on"');
    expect(rowsByKey.get("furigana_mode")?.updatedAt).toBe(
      "2026-04-16T10:05:00.000Z"
    );
    expect(rowsByKey.get("review_daily_limit")?.valueJson).toBe("12");
    expect(rowsByKey.get("review_daily_limit")?.updatedAt).toBe(
      "2026-04-16T10:00:00.000Z"
    );
  });

  it("falls back to global scope when media is missing", () => {
    expect(resolveKanjiClashDefaultScope("media", null)).toBe("global");
    expect(resolveKanjiClashDefaultScope("media", "fixture-tcg")).toBe("media");
    expect(resolveKanjiClashDefaultScope("global", null)).toBe("global");
  });
});

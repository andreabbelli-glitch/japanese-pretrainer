import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { userSetting } from "@/db/schema";
import {
  defaultStudySettings,
  getGlossaryDefaultSort,
  getReviewDailyLimit,
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
    expect(await getStudySettings(database)).toMatchObject(
      defaultStudySettings
    );
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

  it("deduplicates concurrent study setting getters into one database read", async () => {
    const settingsQuerySpy = vi.spyOn(database.query.userSetting, "findMany");

    const [settings, reviewDailyLimit, glossaryDefaultSort] = await Promise.all(
      [
        getStudySettings(database),
        getReviewDailyLimit(database),
        getGlossaryDefaultSort(database)
      ]
    );

    expect(settings).toMatchObject(defaultStudySettings);
    expect(reviewDailyLimit).toBe(defaultStudySettings.reviewDailyLimit);
    expect(glossaryDefaultSort).toBe(defaultStudySettings.glossaryDefaultSort);
    expect(settingsQuerySpy).toHaveBeenCalledTimes(1);

    settingsQuerySpy.mockRestore();
  });

  it("does not reuse a stale in-flight snapshot after settings are updated", async () => {
    let releaseInitialSnapshot!: () => void;
    const initialSnapshotGate = new Promise<void>((resolve) => {
      releaseInitialSnapshot = resolve;
    });
    const originalFindMany = database.query.userSetting.findMany.bind(
      database.query.userSetting
    );
    let queryCount = 0;
    const settingsQuerySpy = vi
      .spyOn(database.query.userSetting, "findMany")
      .mockImplementation(((...args) => {
        queryCount += 1;

        if (queryCount === 1) {
          return originalFindMany(...args).then(async (rows) => {
            await initialSnapshotGate;
            return rows;
          });
        }

        return originalFindMany(...args);
      }) as typeof database.query.userSetting.findMany);

    const initialSettingsPromise = getStudySettings(database);
    await Promise.resolve();

    await updateStudySettings(
      {
        reviewDailyLimit: 12
      },
      database
    );

    const updatedDailyLimitPromise = getReviewDailyLimit(database);
    releaseInitialSnapshot();

    expect(await initialSettingsPromise).toMatchObject(defaultStudySettings);
    await expect(updatedDailyLimitPromise).resolves.toBe(12);

    settingsQuerySpy.mockRestore();
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

  it("repairs dirty persisted settings when saving unchanged values", async () => {
    vi.useFakeTimers();

    await database.insert(userSetting).values([
      {
        key: "furigana_mode",
        valueJson: '"hover"',
        updatedAt: "2026-04-16T09:00:00.000Z"
      },
      {
        key: "kanji_clash_daily_new_limit",
        valueJson: '"8"',
        updatedAt: "2026-04-16T09:00:00.000Z"
      },
      {
        key: "kanji_clash_manual_default_size",
        valueJson: '"40"',
        updatedAt: "2026-04-16T09:00:00.000Z"
      },
      {
        key: "review_daily_limit",
        valueJson: '"12"',
        updatedAt: "2026-04-16T09:00:00.000Z"
      }
    ]);

    vi.setSystemTime(new Date("2026-04-16T10:00:00.000Z"));
    await updateStudySettings({}, database);

    const rows = await database.query.userSetting.findMany();
    const rowsByKey = new Map(rows.map((row) => [row.key, row]));

    expect(rows).toHaveLength(4);
    expect(rowsByKey.get("furigana_mode")?.valueJson).toBe('"hover"');
    expect(rowsByKey.get("furigana_mode")?.updatedAt).toBe(
      "2026-04-16T09:00:00.000Z"
    );
    expect(rowsByKey.get("kanji_clash_daily_new_limit")?.valueJson).toBe("8");
    expect(rowsByKey.get("kanji_clash_daily_new_limit")?.updatedAt).toBe(
      "2026-04-16T10:00:00.000Z"
    );
    expect(rowsByKey.get("kanji_clash_manual_default_size")?.valueJson).toBe(
      "40"
    );
    expect(rowsByKey.get("kanji_clash_manual_default_size")?.updatedAt).toBe(
      "2026-04-16T10:00:00.000Z"
    );
    expect(rowsByKey.get("review_daily_limit")?.valueJson).toBe("12");
    expect(rowsByKey.get("review_daily_limit")?.updatedAt).toBe(
      "2026-04-16T10:00:00.000Z"
    );
  });

  it("does not rewrite canonical settings on a no-op save", async () => {
    vi.useFakeTimers();

    await database.insert(userSetting).values({
      key: "review_daily_limit",
      valueJson: "20",
      updatedAt: "2026-04-16T09:00:00.000Z"
    });

    vi.setSystemTime(new Date("2026-04-16T10:00:00.000Z"));
    await updateStudySettings({}, database);

    const rows = await database.query.userSetting.findMany();

    expect(rows).toEqual([
      {
        key: "review_daily_limit",
        valueJson: "20",
        updatedAt: "2026-04-16T09:00:00.000Z"
      }
    ]);
  });

  it("falls back to global scope when media is missing", () => {
    expect(resolveKanjiClashDefaultScope("media", null)).toBe("global");
    expect(resolveKanjiClashDefaultScope("media", "fixture-tcg")).toBe("media");
    expect(resolveKanjiClashDefaultScope("global", null)).toBe("global");
  });
});

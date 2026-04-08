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

  it("falls back to global scope when media is missing", () => {
    expect(resolveKanjiClashDefaultScope("media", null)).toBe("global");
    expect(resolveKanjiClashDefaultScope("media", "fixture-tcg")).toBe("media");
    expect(resolveKanjiClashDefaultScope("global", null)).toBe("global");
  });
});

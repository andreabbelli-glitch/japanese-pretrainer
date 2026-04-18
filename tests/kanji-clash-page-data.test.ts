import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState,
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  getKanjiClashPageData,
  verifyKanjiClashQueueToken
} from "@/lib/kanji-clash";
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
    expect(data.availableMedia.map((item) => item.slug)).toEqual([
      "alpha",
      "beta"
    ]);
    expect(data.selectedMedia).toBeNull();
    expect(data.queue.scope).toBe("global");
    expect(data.queue.snapshotAtIso).toBe(snapshotAt.toISOString());
    expect(verifyKanjiClashQueueToken(data.queueToken)).toEqual(data.queue);
    expect(data.currentRound?.pairKey).toBe(
      data.queue.rounds[0]?.pairKey ?? null
    );
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

  it("accepts custom manual size top-ups in steps of 10 from the query string", async () => {
    await updateStudySettings(
      {
        kanjiClashManualDefaultSize: 20
      },
      database
    );

    const data = await getKanjiClashPageData(
      {
        mode: "manual",
        size: "30"
      },
      database,
      new Date("2026-04-09T12:00:00.000Z")
    );

    expect(data.queue.requestedSize).toBe(30);
  });

  it("rejects malformed manual size params instead of partially parsing them", async () => {
    await updateStudySettings(
      {
        kanjiClashManualDefaultSize: 40
      },
      database
    );

    const data = await getKanjiClashPageData(
      {
        mode: "manual",
        size: "20abc"
      },
      database,
      new Date("2026-04-09T12:00:00.000Z")
    );

    expect(data.queue.requestedSize).toBe(40);
  });

  it("skips duplicated empty or invalid query params until a valid manual selection is found", async () => {
    await updateStudySettings(
      {
        kanjiClashManualDefaultSize: 40
      },
      database
    );

    const data = await getKanjiClashPageData(
      {
        media: ["", "missing", "beta"],
        mode: ["", "manual"],
        size: ["999", "20"]
      },
      database,
      new Date("2026-04-09T12:00:00.000Z")
    );

    expect(data.mode).toBe("manual");
    expect(data.scope).toBe("media");
    expect(data.selectedMedia?.slug).toBe("beta");
    expect(data.queue.requestedSize).toBe(20);
  });

  it("surfaces active manual contrasts in page data and queues both restored directions first", async () => {
    const baseline = await getKanjiClashPageData(
      {},
      database,
      new Date("2026-04-09T12:00:00.000Z")
    );
    const firstRound = baseline.queue.rounds[0];

    if (!firstRound) {
      throw new Error("Expected a baseline Kanji Clash round.");
    }

    const contrastKey = firstRound.pairKey;

    await database.insert(kanjiClashManualContrast).values({
      contrastKey,
      createdAt: "2026-04-09T11:00:00.000Z",
      forcedDueAt: "2026-04-09T12:05:00.000Z",
      source: "forced",
      status: "active",
      subjectAKey: firstRound.candidate.leftSubjectKey,
      subjectBKey: firstRound.candidate.rightSubjectKey,
      timesConfirmed: 1,
      updatedAt: "2026-04-09T11:00:00.000Z"
    });
    await database.insert(kanjiClashManualContrastRoundState).values([
      {
        contrastKey,
        createdAt: "2026-04-09T11:00:00.000Z",
        difficulty: null,
        direction: "subject_a",
        dueAt: "2026-04-09T12:05:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-09T11:00:00.000Z",
        lastReviewedAt: null,
        learningSteps: 0,
        leftSubjectKey: firstRound.candidate.leftSubjectKey,
        reps: 0,
        rightSubjectKey: firstRound.candidate.rightSubjectKey,
        roundKey: `${contrastKey}::subject_a`,
        scheduledDays: 0,
        stability: null,
        state: "new",
        targetSubjectKey: firstRound.candidate.leftSubjectKey,
        updatedAt: "2026-04-09T11:00:00.000Z"
      },
      {
        contrastKey,
        createdAt: "2026-04-09T11:00:00.000Z",
        difficulty: null,
        direction: "subject_b",
        dueAt: "2026-04-09T12:05:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-09T11:00:00.000Z",
        lastReviewedAt: null,
        learningSteps: 0,
        leftSubjectKey: firstRound.candidate.leftSubjectKey,
        reps: 0,
        rightSubjectKey: firstRound.candidate.rightSubjectKey,
        roundKey: `${contrastKey}::subject_b`,
        scheduledDays: 0,
        stability: null,
        state: "new",
        targetSubjectKey: firstRound.candidate.rightSubjectKey,
        updatedAt: "2026-04-09T11:00:00.000Z"
      }
    ]);

    const data = await getKanjiClashPageData(
      {},
      database,
      new Date("2026-04-09T12:10:00.000Z")
    );

    expect(data.manualContrasts).toEqual([
      expect.objectContaining({
        contrastKey,
        status: "active"
      })
    ]);
    expect(data.queue.rounds[0]?.origin).toEqual({
      contrastKey,
      direction: "subject_a",
      type: "manual-contrast"
    });
    expect(data.queue.rounds[1]?.origin).toEqual({
      contrastKey,
      direction: "subject_b",
      type: "manual-contrast"
    });
  });
});

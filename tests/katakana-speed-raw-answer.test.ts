import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  katakanaAttemptLog,
  katakanaSession,
  katakanaTrial
} from "@/db/schema";
import { submitKatakanaSpeedAnswer } from "@/features/katakana-speed/server";

describe("katakana speed raw answer scoring", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-katakana-raw-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("scores persisted expectedSurface for raw choice trials instead of catalog item surface", async () => {
    await database.insert(katakanaSession).values({
      createdAt: "2026-04-26T08:00:00.000Z",
      id: "session-raw-answer",
      startedAt: "2026-04-26T08:00:00.000Z",
      status: "active",
      updatedAt: "2026-04-26T08:00:00.000Z"
    });
    await database.insert(katakanaTrial).values({
      correctItemId: "word-security",
      expectedSurface: "違う",
      featuresJson: JSON.stringify({
        exerciseCode: "E05",
        interaction: "raw_choice"
      }),
      focusChunksJson: JSON.stringify(["ティ"]),
      itemId: "word-security",
      itemType: "same_different",
      metricsJson: JSON.stringify({ targetRtMs: 950 }),
      mode: "minimal_pair",
      optionItemIdsJson: JSON.stringify(["raw:同じ", "raw:違う"]),
      promptSurface: "セキュリティ / セキュリテイ",
      sessionId: "session-raw-answer",
      sortOrder: 0,
      status: "planned",
      targetRtMs: 950,
      trialId: "trial-raw-answer"
    });

    const result = await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-26T08:00:01.000Z"),
      responseMs: 640,
      sessionId: "session-raw-answer",
      trialId: "trial-raw-answer",
      userAnswer: "違う"
    });
    const attempt = await database.query.katakanaAttemptLog.findFirst({
      where: eq(katakanaAttemptLog.trialId, "trial-raw-answer")
    });

    expect(result).toMatchObject({
      errorTags: [],
      idempotent: false,
      isCorrect: true
    });
    expect(attempt).toMatchObject({
      expectedAnswer: "違う",
      expectedSurface: "違う",
      isCorrect: 1,
      promptSurface: "セキュリティ / セキュリテイ",
      userAnswer: "違う"
    });
  });

  it("accepts a chunk spotting display segment that contains the expected chunk", async () => {
    await database.insert(katakanaSession).values({
      createdAt: "2026-04-26T08:00:00.000Z",
      id: "session-segment-answer",
      startedAt: "2026-04-26T08:00:00.000Z",
      status: "active",
      updatedAt: "2026-04-26T08:00:00.000Z"
    });
    await database.insert(katakanaTrial).values({
      correctItemId: "word-security",
      expectedSurface: "フィ",
      featuresJson: JSON.stringify({
        chunk: "フィ",
        exerciseCode: "E09",
        interaction: "segment_select"
      }),
      focusChunksJson: JSON.stringify(["フィ"]),
      itemId: "word-security",
      itemType: "segment_select",
      metricsJson: JSON.stringify({ targetRtMs: 1400 }),
      mode: "minimal_pair",
      optionItemIdsJson: JSON.stringify([
        "raw:%E3%83%97",
        "raw:%E3%83%AD",
        "raw:%E3%83%95%E3%82%A3%E3%83%BC",
        "raw:%E3%83%AB"
      ]),
      promptSurface: "プロフィール",
      sessionId: "session-segment-answer",
      sortOrder: 0,
      status: "planned",
      targetRtMs: 1400,
      trialId: "trial-segment-answer"
    });

    const result = await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-26T08:00:01.000Z"),
      responseMs: 850,
      sessionId: "session-segment-answer",
      trialId: "trial-segment-answer",
      userAnswer: "フィー"
    });
    const attempt = await database.query.katakanaAttemptLog.findFirst({
      where: eq(katakanaAttemptLog.trialId, "trial-segment-answer")
    });

    expect(result).toMatchObject({
      errorTags: [],
      idempotent: false,
      isCorrect: true
    });
    expect(attempt).toMatchObject({
      expectedAnswer: "フィ",
      expectedSurface: "フィ",
      isCorrect: 1,
      promptSurface: "プロフィール",
      userAnswer: "フィー"
    });
  });
});

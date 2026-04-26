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
});

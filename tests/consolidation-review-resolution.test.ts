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
import { preReviewConsolidationState } from "@/db/schema";
import { buildReviewSubjectCardIdentity } from "@/features/review/model/subject";
import { applyReviewGrade } from "@/features/review/server/service";

import { seedTwoMediaGlobalQueueFixture } from "./helpers/review-fixture";

const SUBJECT_IDENTITY = buildReviewSubjectCardIdentity(
  "card_a",
  "recognition"
);
const SUBJECT_KEY = SUBJECT_IDENTITY.subjectKey;
const RETRAINING_UPDATED_AT = "2026-04-01T10:01:00.000Z";
const REVIEWED_AT = "2026-04-01T11:00:00.000Z";

describe("review consolidation resolution", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-consolidation-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedTwoMediaGlobalQueueFixture(database);
    await seedRetrainingConsolidation(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it.each(["hard", "good", "easy"] as const)(
    "removes retraining consolidation after a correct %s review grade",
    async (rating) => {
      const result = await applyReviewGrade({
        cardId: "card_a",
        database,
        expectedUpdatedAt: null,
        now: new Date(REVIEWED_AT),
        rating
      });
      const consolidationRow = await loadConsolidationRow(database);

      expect(result.consolidationChanged).toBe(true);
      expect(result.consolidationQueued).toBe(false);
      expect(consolidationRow).toMatchObject({
        completedAt: REVIEWED_AT,
        status: "passed",
        subjectKey: SUBJECT_KEY,
        updatedAt: REVIEWED_AT
      });
    }
  );

  it("keeps retraining consolidation after an incorrect review grade", async () => {
    const result = await applyReviewGrade({
      cardId: "card_a",
      database,
      expectedUpdatedAt: null,
      now: new Date(REVIEWED_AT),
      rating: "again"
    });
    const consolidationRow = await loadConsolidationRow(database);

    expect(result.consolidationChanged).toBe(false);
    expect(result.consolidationQueued).toBe(false);
    expect(consolidationRow).toMatchObject({
      completedAt: null,
      status: "retraining",
      updatedAt: RETRAINING_UPDATED_AT
    });
  });
});

async function seedRetrainingConsolidation(database: DatabaseClient) {
  await database.insert(preReviewConsolidationState).values({
    canonicalSubjectKey: SUBJECT_IDENTITY.canonicalSubjectKey,
    recallTask: SUBJECT_IDENTITY.recallTask,
    subjectKey: SUBJECT_KEY,
    subjectType: "card",
    representativeCardId: "card_a",
    lessonId: "lesson_a",
    mediaId: "media_a",
    status: "retraining",
    attemptCount: 1,
    lastAttemptAt: RETRAINING_UPDATED_AT,
    completedAt: null,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: RETRAINING_UPDATED_AT
  });
}

function loadConsolidationRow(database: DatabaseClient) {
  return database.query.preReviewConsolidationState.findFirst({
    where: eq(preReviewConsolidationState.subjectKey, SUBJECT_KEY)
  });
}

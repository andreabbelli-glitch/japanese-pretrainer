import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import {
  buildEffectiveReviewEventMemoryKeySql,
  quoteSqlString
} from "@/db/queries/review-query-helpers";
import type { ReviewRecallTask } from "@/domain/review";
import { resolveEffectiveReviewEventMemoryKey } from "@/features/review/model/recall-task";
import { buildReviewSubjectIdentityFromCanonical } from "@/features/review/model/subject";
import { appendReviewEvent } from "@/features/review/server/event-ledger";

type EventMemoryFixture = {
  canonicalSubjectKey: string | null;
  cardId: string;
  eventSchemaVersion: number;
  memoryKey: string | null;
  recallTask: ReviewRecallTask | null;
  subjectKey: string;
};

describe("effective review event memory identity", () => {
  let database: DatabaseClient;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-event-memory-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
  });

  it.each<EventMemoryFixture>([
    {
      canonicalSubjectKey: "entry:term:ignored-for-v2",
      cardId: "card-v2",
      eventSchemaVersion: 2,
      memoryKey: "mnemonic:v1:recognition:entry:term:persisted",
      recallTask: "recognition",
      subjectKey: "entry:term:legacy"
    },
    {
      canonicalSubjectKey: "group:term:shared",
      cardId: "card-v1-canonical",
      eventSchemaVersion: 1,
      memoryKey: null,
      recallTask: "concept",
      subjectKey: "entry:term:legacy"
    },
    {
      canonicalSubjectKey: null,
      cardId: "card-v0-raw",
      eventSchemaVersion: 0,
      memoryKey: null,
      recallTask: "recognition",
      subjectKey: "entry:term:raw-fallback"
    },
    {
      canonicalSubjectKey: "group:term:must-not-collapse-other",
      cardId: "card-other",
      eventSchemaVersion: 1,
      memoryKey: null,
      recallTask: "other",
      subjectKey: "group:term:must-not-collapse-other"
    }
  ])(
    "keeps TS and SQL event identity aligned for schema $eventSchemaVersion/$recallTask",
    async (fixture) => {
      const [row] = await database.all<{ memoryKey: string }>(`
        SELECT ${buildEffectiveReviewEventMemoryKeySql({
          canonicalSubjectKeyExpression: sqlValue(fixture.canonicalSubjectKey),
          cardIdExpression: sqlValue(fixture.cardId),
          eventSchemaVersionExpression: String(fixture.eventSchemaVersion),
          memoryKeyExpression: sqlValue(fixture.memoryKey),
          recallTaskExpression: sqlValue(fixture.recallTask),
          subjectKeyExpression: sqlValue(fixture.subjectKey)
        })} AS memoryKey
      `);

      expect(row?.memoryKey).toBe(
        resolveEffectiveReviewEventMemoryKey(fixture)
      );
    }
  );
});

describe("review event writer memory identity", () => {
  it("persists schema-v2 events with the explicit memory key", async () => {
    const values = vi.fn(async () => undefined);
    const database = {
      insert: vi.fn(() => ({ values }))
    };
    const identity = buildReviewSubjectIdentityFromCanonical({
      canonicalSubjectKey: "entry:term:iku",
      cardId: "card-iku",
      cardType: "recognition",
      crossMediaGroupId: null,
      entryId: "iku",
      entryType: "term",
      subjectKind: "entry"
    });

    await appendReviewEvent(database as never, {
      afterState: null,
      answeredAt: "2026-07-16T12:00:00.000Z",
      beforeState: null,
      cardId: "card-iku",
      cardType: "recognition",
      eventKind: "manual",
      identity,
      mediaId: "media-japanese",
      reason: "identity_contract_test"
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalSubjectKey: "entry:term:iku",
        eventSchemaVersion: 2,
        memoryKey: "mnemonic:v1:recognition:entry:term:iku",
        subjectKey: "mnemonic:v1:recognition:entry:term:iku"
      })
    );
  });
});

function sqlValue(value: string | null) {
  return value === null ? "NULL" : quoteSqlString(value);
}

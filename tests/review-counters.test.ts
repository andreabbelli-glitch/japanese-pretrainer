import { revalidatePathMock } from "./helpers/review-next-mocks";

import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/db";
import {
  countReviewSubjectsIntroducedOnDay,
  countReviewSubjectsIntroducedOnDayByMediaId,
  countReviewSubjectsIntroducedOnDayByMediaIds,
  listReviewSubjectLogsBySubjectKey
} from "@/db/queries";
import {
  card,
  lesson,
  media,
  reviewMemoryAlias,
  reviewSubjectLog,
  reviewSubjectState
} from "@/db/schema";
import { importContentWorkspace } from "@/features/content/importer";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";
import { loadCrossMediaTermSubjectContext } from "./helpers/review-shared";

describe("review counters", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    revalidatePathMock.mockReset();
    ({ database, tempDir } = await setupReviewDatabase({
      prefix: "jcs-review-minimal-"
    }));
  });

  afterEach(async () => {
    await cleanupReviewDatabase({ database, tempDir });
  });

  it("creates a covering index for introduced-today review log counts", async () => {
    const indexes = await database.all<{ name: string }>(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name = 'review_subject_log'
        AND name = 'review_subject_log_introduced_day_idx'
    `);
    const indexColumns = await database.all<{ name: string; seqno: number }>(
      "PRAGMA index_info('review_subject_log_introduced_day_idx')"
    );

    expect(indexes).toEqual([
      {
        name: "review_subject_log_introduced_day_idx"
      }
    ]);
    expect(indexColumns.map((column) => column.name)).toEqual([
      "previous_state",
      "answered_at",
      "subject_key",
      "card_id"
    ]);
  });

  it("counts newly introduced cards against the local study day", async () => {
    await database.insert(media).values({
      id: "media_timezone_fixture",
      slug: "timezone-fixture",
      title: "Timezone Fixture",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture per il boundary locale della review.",
      status: "active",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(lesson).values({
      id: "lesson_timezone_fixture",
      mediaId: "media_timezone_fixture",
      segmentId: null,
      slug: "timezone-fixture-intro",
      title: "Timezone Fixture Intro",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson fixture for timezone review tests.",
      status: "active",
      sourceFile: "tests/fixtures/db/timezone/lesson.md",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(card).values([
      {
        id: "card_timezone_fixture_before",
        mediaId: "media_timezone_fixture",
        lessonId: "lesson_timezone_fixture",
        segmentId: null,
        sourceFile: "tests/fixtures/db/timezone/before.md",
        cardType: "recognition",
        front: "前日",
        back: "giorno precedente",
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z"
      },
      {
        id: "card_timezone_fixture_target",
        mediaId: "media_timezone_fixture",
        lessonId: "lesson_timezone_fixture",
        segmentId: null,
        sourceFile: "tests/fixtures/db/timezone/target.md",
        cardType: "recognition",
        front: "当日",
        back: "giorno target",
        notesIt: null,
        status: "active",
        orderIndex: 2,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z"
      }
    ]);
    await database.insert(media).values({
      id: "media_timezone_fixture_other",
      slug: "timezone-fixture-other",
      title: "Timezone Fixture Other",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Secondo media per verificare il limite globale dei nuovi.",
      status: "active",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(lesson).values({
      id: "lesson_timezone_fixture_other",
      mediaId: "media_timezone_fixture_other",
      segmentId: null,
      slug: "timezone-fixture-other-intro",
      title: "Timezone Fixture Other Intro",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Second lesson fixture for timezone review tests.",
      status: "active",
      sourceFile: "tests/fixtures/db/timezone/other-lesson.md",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card_timezone_fixture_other",
      mediaId: "media_timezone_fixture_other",
      lessonId: "lesson_timezone_fixture_other",
      segmentId: null,
      sourceFile: "tests/fixtures/db/timezone/other.md",
      cardType: "recognition",
      front: "翌日",
      back: "giorno successivo",
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values([
      {
        subjectKey: "entry:term:term_timezone_fixture_before",
        subjectType: "entry",
        entryType: "term",
        entryId: "term_timezone_fixture_before",
        crossMediaGroupId: null,
        cardId: "card_timezone_fixture_before",
        state: "review",
        stability: 2,
        difficulty: 3,
        dueAt: "2026-03-11T23:59:59.000Z",
        lastReviewedAt: "2026-03-10T23:59:59.000Z",
        lastInteractionAt: "2026-03-10T23:59:59.000Z",
        scheduledDays: 1,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T23:59:59.000Z"
      },
      {
        subjectKey: "entry:term:term_timezone_fixture_target",
        subjectType: "entry",
        entryType: "term",
        entryId: "term_timezone_fixture_target",
        crossMediaGroupId: null,
        cardId: "card_timezone_fixture_target",
        state: "review",
        stability: 2,
        difficulty: 3,
        dueAt: "2026-03-12T00:00:00.000Z",
        lastReviewedAt: "2026-03-11T00:00:00.000Z",
        lastInteractionAt: "2026-03-11T00:00:00.000Z",
        scheduledDays: 1,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z"
      },
      {
        subjectKey: "entry:term:term_timezone_fixture_other",
        subjectType: "entry",
        entryType: "term",
        entryId: "term_timezone_fixture_other",
        crossMediaGroupId: null,
        cardId: "card_timezone_fixture_other",
        state: "review",
        stability: 2,
        difficulty: 3,
        dueAt: "2026-03-12T02:15:00.000Z",
        lastReviewedAt: "2026-03-11T02:15:00.000Z",
        lastInteractionAt: "2026-03-11T02:15:00.000Z",
        scheduledDays: 1,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T02:15:00.000Z"
      }
    ]);
    await database.insert(reviewSubjectLog).values([
      {
        id: "review_subject_log_timezone_before",
        subjectKey: "entry:term:term_timezone_fixture_before",
        cardId: "card_timezone_fixture_before",
        answeredAt: "2026-03-10T23:59:59.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-11T23:59:59.000Z",
        elapsedDays: 0,
        responseMs: null
      },
      {
        id: "review_subject_log_timezone_target",
        subjectKey: "entry:term:term_timezone_fixture_target",
        cardId: "card_timezone_fixture_target",
        answeredAt: "2026-03-11T00:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T00:00:00.000Z",
        elapsedDays: 0,
        responseMs: null
      },
      {
        id: "review_subject_log_timezone_other",
        subjectKey: "entry:term:term_timezone_fixture_other",
        cardId: "card_timezone_fixture_other",
        answeredAt: "2026-03-11T02:15:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T02:15:00.000Z",
        elapsedDays: 0,
        responseMs: null
      }
    ]);

    const originalTimezone = process.env.TZ;

    try {
      process.env.TZ = "America/Los_Angeles";

      const asOf = new Date("2026-03-11T00:30:00.000Z");
      const [introducedCount, singleMediaCount, groupedCounts] =
        await Promise.all([
          countReviewSubjectsIntroducedOnDay(database, asOf),
          countReviewSubjectsIntroducedOnDayByMediaId(
            database,
            "media_timezone_fixture",
            asOf
          ),
          countReviewSubjectsIntroducedOnDayByMediaIds(
            database,
            ["media_timezone_fixture", "media_timezone_fixture_other"],
            asOf
          )
        ]);
      const groupedCountsByMedia = new Map(
        groupedCounts.map((row) => [row.mediaId, row.count])
      );

      expect(introducedCount).toBe(3);
      expect(singleMediaCount).toBe(2);
      expect(groupedCountsByMedia.get("media_timezone_fixture")).toBe(2);
      expect(groupedCountsByMedia.get("media_timezone_fixture_other")).toBe(1);
      expect(
        [...groupedCountsByMedia.values()].reduce(
          (sum, count) => sum + count,
          0
        )
      ).toBe(3);
    } finally {
      process.env.TZ = originalTimezone;
    }
  });

  it("counts introduced subjects from canonical review subject logs without double-counting shared cross-media cards", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-count");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
      state: "review",
      stability: 2.4,
      difficulty: 3.1,
      dueAt: "2026-03-12T08:00:00.000Z",
      lastReviewedAt: "2026-03-11T08:00:00.000Z",
      lastInteractionAt: "2026-03-11T08:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 1,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-11T08:00:00.000Z",
      updatedAt: "2026-03-11T08:00:00.000Z"
    });

    await database.insert(reviewSubjectLog).values([
      {
        id: "review_subject_log_cross_media_alpha",
        subjectKey,
        canonicalSubjectKey: subjectKey,
        eventSchemaVersion: 1,
        recallTask: "recognition",
        cardId: crossMediaFixture.alpha.termCardId,
        answeredAt: "2026-03-11T08:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T08:00:00.000Z",
        elapsedDays: 0,
        responseMs: null
      },
      {
        id: "review_subject_log_cross_media_beta",
        subjectKey,
        canonicalSubjectKey: subjectKey,
        eventSchemaVersion: 1,
        recallTask: "recognition",
        cardId: crossMediaFixture.beta.termCardId,
        answeredAt: "2026-03-11T09:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T09:00:00.000Z",
        elapsedDays: 0,
        responseMs: null
      }
    ]);

    const introducedCount = await countReviewSubjectsIntroducedOnDay(
      database,
      new Date("2026-03-11T12:00:00.000Z")
    );

    expect(introducedCount).toBe(1);
  });

  it("counts distinct task memories and resolves historical aliases only once", async () => {
    const canonicalSubjectKey = "entry:term:shared-memory";
    const oldRecognitionMemoryKey =
      "mnemonic:v1:recognition:entry:term:shared-memory-old";
    const recognitionMemoryKey =
      "mnemonic:v1:recognition:entry:term:shared-memory";
    const conceptMemoryKey = "mnemonic:v1:concept:entry:term:shared-memory";

    await database.delete(reviewSubjectLog);
    await database.insert(reviewMemoryAlias).values({
      aliasMemoryKey: oldRecognitionMemoryKey,
      currentMemoryKey: recognitionMemoryKey,
      migratedAt: "2026-03-11T08:00:00.000Z",
      reason: "canonical_rekey"
    });
    await database.insert(reviewSubjectLog).values([
      buildMemoryLog({
        canonicalSubjectKey,
        id: "introduced-recognition-old",
        memoryKey: oldRecognitionMemoryKey,
        recallTask: "recognition"
      }),
      buildMemoryLog({
        canonicalSubjectKey,
        id: "introduced-recognition-current",
        memoryKey: recognitionMemoryKey,
        recallTask: "recognition"
      }),
      buildMemoryLog({
        canonicalSubjectKey,
        id: "introduced-concept",
        memoryKey: conceptMemoryKey,
        recallTask: "concept"
      }),
      {
        ...buildMemoryLog({
          canonicalSubjectKey,
          id: "introduced-non-grade",
          memoryKey: recognitionMemoryKey,
          recallTask: "recognition"
        }),
        eventKind: "reset" as const
      }
    ]);

    const introducedCount = await countReviewSubjectsIntroducedOnDay(
      database,
      new Date("2026-03-11T12:00:00.000Z")
    );
    const recognitionLogs = await listReviewSubjectLogsBySubjectKey(
      database,
      recognitionMemoryKey
    );

    expect(introducedCount).toBe(2);
    expect(recognitionLogs.map((log) => log.id)).toEqual([
      "introduced-recognition-current",
      "introduced-non-grade",
      "introduced-recognition-old"
    ]);
  });
});

function buildMemoryLog(input: {
  canonicalSubjectKey: string;
  id: string;
  memoryKey: string;
  recallTask: "concept" | "recognition";
}): typeof reviewSubjectLog.$inferInsert {
  const answeredAtById: Record<string, string> = {
    "introduced-recognition-current": "2026-03-11T09:00:00.000Z",
    "introduced-non-grade": "2026-03-11T09:30:00.000Z",
    "introduced-recognition-old": "2026-03-11T10:00:00.000Z"
  };

  return {
    answeredAt: answeredAtById[input.id] ?? "2026-03-11T11:00:00.000Z",
    canonicalSubjectKey: input.canonicalSubjectKey,
    cardId: `card-${input.id}`,
    cardTypeSnapshot: input.recallTask,
    eventKind: "grade",
    eventSchemaVersion: 2,
    id: input.id,
    memoryKey: input.memoryKey,
    newState: "review",
    previousState: "new",
    rating: "good",
    recallTask: input.recallTask,
    scheduledDueAt: "2026-03-12T09:00:00.000Z",
    subjectKey: input.memoryKey
  };
}

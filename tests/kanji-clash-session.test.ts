import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  card,
  cardEntryLink,
  kanjiClashPairLog,
  kanjiClashPairState,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  segment,
  term,
  type DatabaseClient
} from "@/db";
import {
  applyKanjiClashSessionAction,
  buildKanjiClashPairKey,
  loadKanjiClashQueueSnapshot
} from "@/lib/kanji-clash";

describe("kanji clash session service", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-session-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedKanjiClashSessionFixture(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("tops up automatic sessions with only the remaining new-pair budget for today", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const duePairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-alpha-shokuhin"
    );
    const introducedTodayPairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-alpha-shokutaku"
    );

    await database.insert(kanjiClashPairState).values([
      {
        createdAt: "2026-04-08T08:00:00.000Z",
        difficulty: 2.4,
        dueAt: "2026-04-09T09:00:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-08T08:00:00.000Z",
        lastReviewedAt: "2026-04-08T08:00:00.000Z",
        learningSteps: 0,
        leftSubjectKey: "entry:term:term-alpha-shokuhi",
        pairKey: duePairKey,
        reps: 3,
        rightSubjectKey: "entry:term:term-alpha-shokuhin",
        scheduledDays: 2,
        stability: 8.4,
        state: "review",
        updatedAt: "2026-04-08T08:00:00.000Z"
      },
      {
        createdAt: "2026-04-09T07:30:00.000Z",
        difficulty: 3.2,
        dueAt: "2026-04-10T07:30:00.000Z",
        lapses: 1,
        lastInteractionAt: "2026-04-09T07:30:00.000Z",
        lastReviewedAt: "2026-04-09T07:30:00.000Z",
        learningSteps: 1,
        leftSubjectKey: "entry:term:term-alpha-shokuhi",
        pairKey: introducedTodayPairKey,
        reps: 1,
        rightSubjectKey: "entry:term:term-alpha-shokutaku",
        scheduledDays: 1,
        stability: 0.8,
        state: "learning",
        updatedAt: "2026-04-09T07:30:00.000Z"
      }
    ]);
    await database.insert(kanjiClashPairLog).values({
      answeredAt: "2026-04-09T07:30:00.000Z",
      chosenSubjectKey: "entry:term:term-alpha-shokuhi",
      correctSubjectKey: "entry:term:term-alpha-shokuhi",
      elapsedDays: 0,
      id: "kanji-clash-log-introduced-today",
      leftSubjectKey: "entry:term:term-alpha-shokuhi",
      mode: "automatic",
      newState: "learning",
      pairKey: introducedTodayPairKey,
      previousState: "new",
      responseMs: 240,
      result: "good",
      rightSubjectKey: "entry:term:term-alpha-shokutaku",
      scheduledDueAt: "2026-04-10T07:30:00.000Z",
      schedulerVersion: "kanji_clash_fsrs_v1",
      targetSubjectKey: "entry:term:term-alpha-shokuhi"
    });

    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 2,
      database,
      mode: "automatic",
      now,
      scope: "global"
    });

    expect(queue.introducedTodayCount).toBe(1);
    expect(queue.dueCount).toBe(1);
    expect(queue.newQueuedCount).toBe(1);
    expect(queue.totalCount).toBe(2);
    expect(queue.rounds[0]?.pairKey).toBe(duePairKey);
    expect(
      queue.rounds.some((round) => round.pairKey === introducedTodayPairKey)
    ).toBe(false);
  });

  it("persists kanji clash pair state and log mutations without touching review state", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const reviewStateBefore = await database.query.reviewSubjectState.findMany({
      orderBy: (table, { asc }) => asc(table.subjectKey)
    });
    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 1,
      database,
      mode: "manual",
      now,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a Kanji Clash round in the session fixture.");
    }

    const result = await applyKanjiClashSessionAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      now,
      queue,
      responseMs: 180
    });

    const storedPairState = await database.query.kanjiClashPairState.findFirst({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });
    const storedLog = await database.query.kanjiClashPairLog.findFirst({
      where: (table, { eq }) => eq(table.id, result.logId)
    });
    const reviewStateAfter = await database.query.reviewSubjectState.findMany({
      orderBy: (table, { asc }) => asc(table.subjectKey)
    });

    expect(result.isCorrect).toBe(true);
    expect(result.nextQueue.currentRoundIndex).toBe(1);
    expect(result.nextQueue.seenPairKeys).toContain(currentRound.pairKey);
    expect(storedPairState?.pairKey).toBe(currentRound.pairKey);
    expect(storedPairState?.reps).toBe(result.pairState.reps);
    expect(storedLog).toMatchObject({
      pairKey: currentRound.pairKey,
      mode: "manual",
      result: "good",
      targetSubjectKey: currentRound.targetSubjectKey
    });
    expect(reviewStateAfter).toEqual(reviewStateBefore);
  });
});

async function seedKanjiClashSessionFixture(database: DatabaseClient) {
  const now = "2026-04-08T12:00:00.000Z";

  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt: now,
    description: "Alpha media",
    id: "media-alpha",
    language: "ja",
    mediaType: "game",
    segmentKind: "chapter",
    slug: "alpha",
    status: "active",
    title: "Alpha",
    updatedAt: now
  });
  await database.insert(segment).values({
    id: "segment-alpha",
    mediaId: "media-alpha",
    notes: null,
    orderIndex: 1,
    segmentType: "chapter",
    slug: "segment-alpha",
    title: "Segment alpha"
  });
  await database.insert(lesson).values({
    createdAt: now,
    difficulty: "beginner",
    id: "lesson-alpha",
    mediaId: "media-alpha",
    orderIndex: 1,
    segmentId: "segment-alpha",
    slug: "lesson-alpha",
    sourceFile: "tests/lesson-alpha.md",
    status: "active",
    summary: "Lesson alpha",
    title: "Lesson alpha",
    updatedAt: now
  });
  await database.insert(lessonProgress).values({
    completedAt: now,
    lastOpenedAt: now,
    lessonId: "lesson-alpha",
    startedAt: now,
    status: "completed"
  });
  await database.insert(term).values([
    buildTermRow(
      {
        id: "term-alpha-shokuhi",
        lemma: "食費",
        meaningIt: "spese per il cibo",
        reading: "しょくひ",
        sourceId: "term-alpha-shokuhi"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-shokuhin",
        lemma: "食品",
        meaningIt: "alimento",
        reading: "しょくひん",
        sourceId: "term-alpha-shokuhin"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-shokutaku",
        lemma: "食卓",
        meaningIt: "tavolo da pranzo",
        reading: "しょくたく",
        sourceId: "term-alpha-shokutaku"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-inshoku",
        lemma: "飲食",
        meaningIt: "cibo e bevande",
        reading: "いんしょく",
        sourceId: "term-alpha-inshoku"
      },
      now
    )
  ]);
  await database
    .insert(card)
    .values([
      buildCardRow("card-alpha-shokuhi", "食費", now),
      buildCardRow("card-alpha-shokuhin", "食品", now),
      buildCardRow("card-alpha-shokutaku", "食卓", now),
      buildCardRow("card-alpha-inshoku", "飲食", now)
    ]);
  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLinkRow("card-alpha-shokuhi", "term-alpha-shokuhi"),
      buildCardEntryLinkRow("card-alpha-shokuhin", "term-alpha-shokuhin"),
      buildCardEntryLinkRow("card-alpha-shokutaku", "term-alpha-shokutaku"),
      buildCardEntryLinkRow("card-alpha-inshoku", "term-alpha-inshoku")
    ]);
  await database
    .insert(reviewSubjectState)
    .values([
      buildReviewSubjectStateRow(
        "card-alpha-shokuhi",
        "term-alpha-shokuhi",
        "entry:term:term-alpha-shokuhi",
        now,
        8.2,
        3,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-alpha-shokuhin",
        "term-alpha-shokuhin",
        "entry:term:term-alpha-shokuhin",
        now,
        9.1,
        4,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-alpha-shokutaku",
        "term-alpha-shokutaku",
        "entry:term:term-alpha-shokutaku",
        now,
        8.7,
        3,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-alpha-inshoku",
        "term-alpha-inshoku",
        "entry:term:term-alpha-inshoku",
        now,
        10.2,
        5,
        "relearning"
      )
    ]);
}

function buildTermRow(
  input: {
    id: string;
    lemma: string;
    meaningIt: string;
    reading: string;
    sourceId: string;
  },
  now: string
) {
  return {
    createdAt: now,
    crossMediaGroupId: null,
    id: input.id,
    lemma: input.lemma,
    meaningIt: input.meaningIt,
    mediaId: "media-alpha",
    reading: input.reading,
    romaji: input.reading,
    searchLemmaNorm: input.lemma,
    searchReadingNorm: input.reading,
    searchRomajiNorm: input.reading,
    segmentId: "segment-alpha",
    sourceId: input.sourceId,
    updatedAt: now
  };
}

function buildCardRow(
  id: string,
  front: string,
  now: string
): typeof card.$inferInsert {
  return {
    back: `${front} meaning`,
    cardType: "recognition",
    createdAt: now,
    front,
    id,
    lessonId: "lesson-alpha",
    mediaId: "media-alpha",
    normalizedFront: front,
    orderIndex: 1,
    segmentId: "segment-alpha",
    sourceFile: `tests/${id}.md`,
    status: "active",
    updatedAt: now
  };
}

function buildCardEntryLinkRow(cardId: string, entryId: string) {
  return {
    cardId,
    entryId,
    entryType: "term" as const,
    id: `${cardId}-${entryId}`,
    relationshipType: "primary" as const
  };
}

function buildReviewSubjectStateRow(
  cardId: string,
  entryId: string,
  subjectKey: string,
  now: string,
  stability: number,
  reps: number,
  state: "review" | "relearning"
) {
  return {
    cardId,
    createdAt: now,
    crossMediaGroupId: null,
    difficulty: 2.5,
    dueAt: now,
    entryId,
    entryType: "term" as const,
    lapses: 0,
    lastInteractionAt: now,
    lastReviewedAt: now,
    learningSteps: 0,
    manualOverride: false,
    reps,
    scheduledDays: 3,
    stability,
    state,
    subjectKey,
    subjectType: "entry" as const,
    suspended: false,
    updatedAt: now
  };
}

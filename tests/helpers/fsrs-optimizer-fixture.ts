import type { DatabaseClient } from "@/db";
import {
  card,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  userSetting
} from "@/db/schema";

const DAY = 24 * 60 * 60_000;

export async function seedFsrsFixture(
  database: DatabaseClient,
  input: {
    conceptLogCount: number;
    recognitionLogCount: number;
  }
) {
  const createdAt = "2026-03-01T09:00:00.000Z";
  const updatedAt = "2026-03-01T09:00:00.000Z";

  await database.insert(media).values({
    id: "media-fsrs",
    slug: "media-fsrs",
    title: "FSRS Fixture",
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: "Fixture minima per optimizer FSRS.",
    status: "active",
    createdAt,
    updatedAt
  });
  await database.insert(lesson).values({
    id: "lesson-fsrs",
    mediaId: "media-fsrs",
    segmentId: null,
    slug: "intro",
    title: "Intro",
    orderIndex: 1,
    difficulty: "beginner",
    summary: "Lesson fixture.",
    status: "active",
    sourceFile: "tests/fsrs-optimizer/intro.md",
    createdAt,
    updatedAt
  });
  await database.insert(lessonProgress).values({
    lessonId: "lesson-fsrs",
    status: "completed",
    completedAt: createdAt,
    lastOpenedAt: createdAt,
    startedAt: createdAt
  });
  await database.insert(card).values([
    {
      id: "recognition-card",
      mediaId: "media-fsrs",
      lessonId: "lesson-fsrs",
      segmentId: null,
      sourceFile: "tests/fsrs-optimizer/recognition.md",
      cardType: "recognition",
      front: "認識",
      normalizedFront: "認識",
      back: "recognition",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt,
      updatedAt
    },
    {
      id: "concept-card",
      mediaId: "media-fsrs",
      lessonId: "lesson-fsrs",
      segmentId: null,
      sourceFile: "tests/fsrs-optimizer/concept.md",
      cardType: "concept",
      front: "概念",
      normalizedFront: "概念",
      back: "concept",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 2,
      createdAt,
      updatedAt
    }
  ]);
  await database.insert(reviewSubjectState).values([
    {
      subjectKey: optimizerMemoryKey("recognition-card"),
      canonicalSubjectKey: "card:recognition-card",
      recallTask: "recognition",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "recognition-card",
      state: "review",
      stability: 4.2,
      difficulty: 3.1,
      dueAt: "2026-04-20T09:00:00.000Z",
      lastReviewedAt: "2026-04-10T09:00:00.000Z",
      lastInteractionAt: "2026-04-10T09:00:00.000Z",
      scheduledDays: 10,
      learningSteps: 0,
      lapses: 1,
      reps: 4,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt,
      updatedAt
    },
    {
      subjectKey: optimizerMemoryKey("concept-card"),
      canonicalSubjectKey: "card:concept-card",
      recallTask: "concept",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "concept-card",
      state: "review",
      stability: 3.4,
      difficulty: 3.7,
      dueAt: "2026-04-18T09:00:00.000Z",
      lastReviewedAt: "2026-04-08T09:00:00.000Z",
      lastInteractionAt: "2026-04-08T09:00:00.000Z",
      scheduledDays: 7,
      learningSteps: 0,
      lapses: 2,
      reps: 4,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt,
      updatedAt
    }
  ]);
  await database.insert(reviewSubjectLog).values([
    ...buildReviewLogs({
      cardId: "recognition-card",
      count: input.recognitionLogCount,
      subjectKey: optimizerMemoryKey("recognition-card")
    }),
    ...buildReviewLogs({
      cardId: "concept-card",
      count: input.conceptLogCount,
      subjectKey: optimizerMemoryKey("concept-card")
    })
  ]);
  await database.insert(userSetting).values({
    key: "review_daily_limit",
    valueJson: JSON.stringify(20),
    updatedAt
  });
}

export async function installConceptWriteAbortTrigger(
  database: DatabaseClient
) {
  await database.$client.execute({
    sql: `
      create trigger if not exists fsrs_params_concept_insert_block
      before insert on user_setting
      when new.key = 'fsrs_params_concept'
      begin
        select raise(abort, 'concept write blocked');
      end;
    `
  });
  await database.$client.execute({
    sql: `
      create trigger if not exists fsrs_params_concept_update_block
      before update on user_setting
      when new.key = 'fsrs_params_concept'
      begin
        select raise(abort, 'concept write blocked');
      end;
    `
  });
}

export async function installOptimizerStateWriteAbortTrigger(
  database: DatabaseClient
) {
  await database.$client.execute({
    sql: `
      create trigger if not exists fsrs_optimizer_state_insert_block
      before insert on user_setting
      when new.key = 'fsrs_optimizer_state'
      begin
        select raise(abort, 'optimizer state write blocked');
      end;
    `
  });
  await database.$client.execute({
    sql: `
      create trigger if not exists fsrs_optimizer_state_update_block
      before update on user_setting
      when new.key = 'fsrs_optimizer_state'
      begin
        select raise(abort, 'optimizer state write blocked');
      end;
    `
  });
}

export function buildReviewLogs(input: {
  cardId: string;
  count: number;
  subjectKey: string;
  startIndex?: number;
}): Array<typeof reviewSubjectLog.$inferInsert> {
  const baseTime = new Date("2026-01-01T09:00:00.000Z").getTime();
  const startIndex = input.startIndex ?? 0;
  const ratings = ["good", "hard", "easy", "good"] as const;

  return Array.from({ length: input.count }, (_, index) => {
    const reviewIndex = startIndex + index;
    const answeredAt = new Date(baseTime + reviewIndex * DAY).toISOString();
    const scheduledDueAt = new Date(
      baseTime + (reviewIndex + 1) * DAY
    ).toISOString();

    return {
      id: `${input.cardId}-log-${reviewIndex + 1}`,
      subjectKey: input.subjectKey,
      eventSchemaVersion: 2,
      memoryKey: input.subjectKey,
      cardId: input.cardId,
      answeredAt,
      rating: ratings[reviewIndex % ratings.length],
      previousState: reviewIndex === 0 ? "new" : "review",
      newState: "review",
      scheduledDueAt,
      elapsedDays: reviewIndex === 0 ? 0 : reviewIndex,
      responseMs: 1_000 + reviewIndex,
      schedulerVersion: "fsrs_v1" as const
    };
  });
}

export function optimizerMemoryKey(
  cardId: "concept-card" | "recognition-card"
) {
  const recallTask = cardId === "concept-card" ? "concept" : "recognition";

  return `mnemonic:v1:${recallTask}:card:${cardId}`;
}

export function buildLogRow(input: {
  answeredAt: string;
  cardId: string;
  cardType: string;
  elapsedDays: number | null;
  eventKind?: string;
  id: string;
  previousState?: string | null;
  rating: string | null;
  studyDay?: string | null;
  studyDayPolicy?: string | null;
  subjectKey: string;
}) {
  return {
    answeredAt: input.answeredAt,
    cardType: input.cardType,
    elapsedDays: input.elapsedDays,
    eventKind: input.eventKind,
    id: input.id,
    previousState: input.previousState,
    rating: input.rating,
    studyDay: input.studyDay,
    studyDayPolicy: input.studyDayPolicy,
    subjectKey: input.subjectKey
  };
}

export function buildOptimizerMemoryEvent(input: {
  answeredAt: string;
  canonicalSubjectKey: string;
  id: string;
  memoryKey: string;
}): typeof reviewSubjectLog.$inferInsert {
  return {
    answeredAt: input.answeredAt,
    canonicalSubjectKey: input.canonicalSubjectKey,
    cardId: `card-${input.id}`,
    cardTypeSnapshot: "recognition",
    eventKind: "grade",
    eventSchemaVersion: 2,
    id: input.id,
    memoryKey: input.memoryKey,
    newState: "review",
    previousState: input.id.endsWith("old") ? "new" : "review",
    rating: "good",
    recallTask: "recognition",
    scheduledDueAt: "2026-01-10T09:00:00.000Z",
    subjectKey: input.memoryKey
  };
}

export function buildSingleReviewLogs(input: {
  cardId: string;
  count: number;
  idPrefix: string;
  subjectKeyPrefix: string;
}) {
  return Array.from({ length: input.count }, (_, index) => ({
    answeredAt: new Date(
      Date.UTC(2026, 2, 1 + Math.floor(index / 20), 9, index % 60, 0, 0)
    ).toISOString(),
    cardId: input.cardId,
    elapsedDays: 0,
    id: `${input.idPrefix}-${index + 1}`,
    newState: "learning" as const,
    previousState: "new" as const,
    rating: "good" as const,
    responseMs: 900,
    scheduledDueAt: new Date(
      Date.UTC(2026, 2, 2 + Math.floor(index / 20), 9, index % 60, 0, 0)
    ).toISOString(),
    schedulerVersion: "fsrs_v1" as const,
    subjectKey: `${input.subjectKeyPrefix}-${index + 1}`,
    eventSchemaVersion: 2,
    memoryKey: `${input.subjectKeyPrefix}-${index + 1}`
  }));
}

export function buildSingleReviewSubjectStates(input: {
  cardId: string;
  count: number;
  subjectKeyPrefix: string;
}) {
  return Array.from({ length: input.count }, (_, index) => ({
    cardId: input.cardId,
    createdAt: "2026-03-01T09:00:00.000Z",
    crossMediaGroupId: null,
    difficulty: null,
    dueAt: null,
    entryId: null,
    entryType: null,
    lapses: 0,
    lastInteractionAt: "2026-03-01T09:00:00.000Z",
    lastReviewedAt: null,
    learningSteps: 0,
    manualOverride: false,
    reps: 0,
    scheduledDays: 0,
    schedulerVersion: "fsrs_v1" as const,
    stability: null,
    state: "new" as const,
    subjectKey: `${input.subjectKeyPrefix}-${index + 1}`,
    subjectType: "card" as const,
    suspended: false,
    updatedAt: "2026-03-01T09:00:00.000Z"
  }));
}

import { eq } from "drizzle-orm";

import {
  card,
  cardEntryLink,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  term,
  userSetting
} from "@/db/schema";
import type { DatabaseClient } from "@/db";
import {
  buildReviewMemoryKey,
  REVIEW_MEMORY_KEY_VERSION
} from "@/features/review/model/recall-task";

const REVIEW_FIXTURE_CREATED_AT = "2026-03-10T09:00:00.000Z";
const REVIEW_FIXTURE_SETTINGS_UPDATED_AT = "2026-03-10T11:00:00.000Z";

type ReviewBundleSeed = {
  cardBack: string;
  cardFront: string;
  cardId: string;
  cardSourceFile: string;
  description: string;
  lessonId: string;
  lessonSlug: string;
  lessonSourceFile: string;
  lessonTitle: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
};

type ReviewSubjectStateRow = typeof reviewSubjectState.$inferInsert;
type ReviewSubjectLogRow = typeof reviewSubjectLog.$inferInsert;
type ReviewSubjectStateValue = NonNullable<ReviewSubjectLogRow["newState"]>;

export async function seedTwoMediaGlobalQueueFixture(database: DatabaseClient) {
  await insertReviewBundles(database, [
    {
      cardBack: "A back",
      cardFront: "A",
      cardId: "card_a",
      cardSourceFile: "tests/review-global-queue/media-a.md",
      description: "Fixture A",
      lessonId: "lesson_a",
      lessonSlug: "intro-a",
      lessonSourceFile: "tests/review-global-queue/media-a.md",
      lessonTitle: "Lesson A",
      mediaId: "media_a",
      mediaSlug: "media-a",
      mediaTitle: "Media A"
    },
    {
      cardBack: "B back",
      cardFront: "B",
      cardId: "card_b",
      cardSourceFile: "tests/review-global-queue/media-b.md",
      description: "Fixture B",
      lessonId: "lesson_b",
      lessonSlug: "intro-b",
      lessonSourceFile: "tests/review-global-queue/media-b.md",
      lessonTitle: "Lesson B",
      mediaId: "media_b",
      mediaSlug: "media-b",
      mediaTitle: "Media B"
    }
  ]);
  await database.insert(userSetting).values(buildReviewDailyLimitSetting());
}

export async function seedSingleReviewCardFixture(database: DatabaseClient) {
  await insertReviewBundles(database, [
    {
      cardBack: "A back",
      cardFront: "A",
      cardId: "card_a",
      cardSourceFile: "tests/review-first-candidate-cache/media-a.md",
      description: "Fixture A",
      lessonId: "lesson_a",
      lessonSlug: "intro-a",
      lessonSourceFile: "tests/review-first-candidate-cache/media-a.md",
      lessonTitle: "Lesson A",
      mediaId: "media_a",
      mediaSlug: "media-a",
      mediaTitle: "Media A"
    }
  ]);
  await database.insert(userSetting).values(buildReviewDailyLimitSetting());
}

export async function createIsolatedNewMediaFixture(
  client: DatabaseClient,
  input: {
    cardCount: number;
    mediaId: string;
    mediaSlug: string;
    title: string;
  }
) {
  await client.insert(media).values({
    id: input.mediaId,
    slug: input.mediaSlug,
    title: input.title,
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: `${input.title} fixture`,
    status: "active",
    createdAt: "2026-03-11T09:00:00.000Z",
    updatedAt: "2026-03-11T09:00:00.000Z"
  });
  await client.insert(lesson).values({
    id: `${input.mediaId}_lesson`,
    mediaId: input.mediaId,
    segmentId: null,
    slug: `${input.mediaSlug}-intro`,
    title: `${input.title} Intro`,
    orderIndex: 1,
    difficulty: "beginner",
    summary: `${input.title} Intro`,
    status: "active",
    sourceFile: `tests/review/${input.mediaSlug}.md`,
    createdAt: "2026-03-11T09:00:00.000Z",
    updatedAt: "2026-03-11T09:00:00.000Z"
  });
  await client.insert(lessonProgress).values({
    lessonId: `${input.mediaId}_lesson`,
    status: "completed",
    completedAt: "2026-03-11T09:00:00.000Z"
  });

  const cards = Array.from({ length: input.cardCount }, (_, index) => ({
    id: `${input.mediaId}_card_${index + 1}`,
    mediaId: input.mediaId,
    lessonId: `${input.mediaId}_lesson`,
    segmentId: null,
    sourceFile: `tests/review/${input.mediaSlug}.md`,
    cardType: "recognition" as const,
    front: `新規 ${index + 1}`,
    back: `nuova ${index + 1}`,
    notesIt: `Card nuova ${index + 1}`,
    status: "active" as const,
    orderIndex: index + 1,
    createdAt: `2026-03-11T09:0${index}:00.000Z`,
    updatedAt: `2026-03-11T09:0${index}:00.000Z`
  }));
  const terms = Array.from({ length: input.cardCount }, (_, index) => ({
    id: `${input.mediaId}_term_${index + 1}`,
    sourceId: `${input.mediaSlug}-term-${index + 1}`,
    mediaId: input.mediaId,
    segmentId: null,
    lemma: `新規${index + 1}`,
    reading: `しんき${index + 1}`,
    romaji: `shinki-${index + 1}`,
    pos: "sostantivo",
    meaningIt: `nuova ${index + 1}`,
    meaningLiteralIt: null,
    notesIt: `Termine ${index + 1}`,
    levelHint: null,
    searchLemmaNorm: `新規${index + 1}`,
    searchReadingNorm: `しんき${index + 1}`,
    searchRomajiNorm: `shinki-${index + 1}`,
    createdAt: `2026-03-11T09:0${index}:00.000Z`,
    updatedAt: `2026-03-11T09:0${index}:00.000Z`
  }));
  const entryLinks = Array.from({ length: input.cardCount }, (_, index) => ({
    id: `${input.mediaId}_link_${index + 1}`,
    cardId: `${input.mediaId}_card_${index + 1}`,
    entryType: "term" as const,
    entryId: `${input.mediaId}_term_${index + 1}`,
    relationshipType: "primary" as const
  }));

  await client.insert(card).values(cards);
  await client.insert(term).values(terms);
  await client.insert(cardEntryLink).values(entryLinks);

  return {
    cardIds: cards.map((item) => item.id),
    mediaSlug: input.mediaSlug,
    termIds: terms.map((item) => item.id)
  };
}

export async function prepareChainedBufferedAdvanceFixture(
  database: DatabaseClient,
  input: {
    lessonId: string;
    mediaId: string;
    secondarySubjectKey: string;
    segmentId: string;
  }
) {
  const bufferedCardBId = "card_fixture_buffered_b";
  const bufferedCardCId = "card_fixture_buffered_c";

  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2026-03-09T08:03:00.000Z",
      manualOverride: false,
      state: "learning"
    })
    .where(eq(reviewSubjectState.subjectKey, input.secondarySubjectKey));

  await database.insert(card).values([
    {
      back: "B back",
      cardType: "recognition",
      createdAt: "2026-03-08T09:00:00.000Z",
      exampleJp: null,
      exampleIt: null,
      front: "B",
      id: bufferedCardBId,
      lessonId: input.lessonId,
      mediaId: input.mediaId,
      notesIt: null,
      orderIndex: 2,
      segmentId: input.segmentId,
      sourceFile: "tests/review-buffered-advance/card-b.md",
      status: "active",
      updatedAt: "2026-03-08T09:00:00.000Z"
    },
    {
      back: "C back",
      cardType: "recognition",
      createdAt: "2026-03-08T09:00:00.000Z",
      exampleJp: null,
      exampleIt: null,
      front: "C",
      id: bufferedCardCId,
      lessonId: input.lessonId,
      mediaId: input.mediaId,
      notesIt: null,
      orderIndex: 3,
      segmentId: input.segmentId,
      sourceFile: "tests/review-buffered-advance/card-c.md",
      status: "active",
      updatedAt: "2026-03-08T09:00:00.000Z"
    }
  ]);

  await database.insert(reviewSubjectState).values([
    buildReviewSubjectStateRow({
      cardId: bufferedCardBId,
      difficulty: 4,
      dueAt: "2026-03-09T08:01:00.000Z",
      lapses: 0,
      learningSteps: 0,
      lastInteractionAt: "2026-03-08T09:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      reps: 1,
      scheduledDays: 0,
      state: "learning",
      stability: 1.6,
      subjectKey: `card:${bufferedCardBId}`
    }),
    buildReviewSubjectStateRow({
      cardId: bufferedCardCId,
      difficulty: 4,
      dueAt: "2026-03-09T08:02:00.000Z",
      lapses: 0,
      learningSteps: 0,
      lastInteractionAt: "2026-03-08T09:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      reps: 1,
      scheduledDays: 0,
      state: "learning",
      stability: 1.6,
      subjectKey: `card:${bufferedCardCId}`
    })
  ]);

  return {
    bufferedCardBId,
    bufferedCardCId
  };
}

export function buildReviewDailyLimitSetting(
  updatedAt = REVIEW_FIXTURE_SETTINGS_UPDATED_AT
) {
  return {
    key: "review_daily_limit",
    updatedAt,
    valueJson: "1"
  } satisfies typeof userSetting.$inferInsert;
}

export function buildReviewSubjectStateRow(
  input: {
    cardId: string;
    canonicalSubjectKey?: string;
    crossMediaGroupId?: string | null;
    difficulty: number;
    dueAt: string;
    entryId?: string | null;
    entryType?: "term" | "grammar" | null;
    lastInteractionAt?: string;
    lastReviewedAt?: string | null;
    learningSteps: number;
    lapses: number;
    manualOverride?: boolean;
    reps: number;
    recallTask?: "recognition" | "concept" | "other";
    scheduledDays: number;
    schedulerVersion?: "fsrs_v1";
    state: "new" | "learning" | "review" | "relearning";
    stability: number;
    subjectKey: string;
    suspended?: boolean;
  },
  now = REVIEW_FIXTURE_CREATED_AT
) {
  const recallTask = input.recallTask ?? "recognition";
  const canonicalSubjectKey = input.canonicalSubjectKey ?? input.subjectKey;
  const subjectKey = input.subjectKey.startsWith(
    `${REVIEW_MEMORY_KEY_VERSION}:`
  )
    ? input.subjectKey
    : buildReviewMemoryKey({
        canonicalSubjectKey,
        cardId: input.cardId,
        recallTask
      });

  return {
    cardId: input.cardId,
    canonicalSubjectKey,
    createdAt: now,
    crossMediaGroupId: input.crossMediaGroupId ?? null,
    difficulty: input.difficulty,
    dueAt: input.dueAt,
    entryId: input.entryId ?? null,
    entryType: input.entryType ?? null,
    lastInteractionAt: input.lastInteractionAt ?? now,
    lastReviewedAt: input.lastReviewedAt ?? now,
    learningSteps: input.learningSteps,
    lapses: input.lapses,
    manualOverride: input.manualOverride ?? false,
    recallTask,
    reps: input.reps,
    scheduledDays: input.scheduledDays,
    schedulerVersion: input.schedulerVersion ?? "fsrs_v1",
    state: input.state,
    stability: input.stability,
    subjectKey,
    subjectType: "card",
    suspended: input.suspended ?? false,
    updatedAt: now
  } satisfies ReviewSubjectStateRow;
}

export function buildReviewSubjectLogRow(input: {
  answeredAt: string;
  cardId: string;
  elapsedDays: number;
  id: string;
  newState: ReviewSubjectStateValue;
  previousState: ReviewSubjectStateValue;
  rating: "again" | "hard" | "good" | "easy";
  responseMs: number | null;
  scheduledDueAt: string;
  subjectKey: string;
}) {
  const memoryKey = input.subjectKey.startsWith(`${REVIEW_MEMORY_KEY_VERSION}:`)
    ? input.subjectKey
    : buildReviewMemoryKey({
        canonicalSubjectKey: input.subjectKey,
        cardId: input.cardId,
        recallTask: "recognition"
      });

  return {
    answeredAt: input.answeredAt,
    cardId: input.cardId,
    canonicalSubjectKey: input.subjectKey,
    elapsedDays: input.elapsedDays,
    id: input.id,
    memoryKey,
    newState: input.newState,
    previousState: input.previousState,
    rating: input.rating,
    recallTask: "recognition",
    responseMs: input.responseMs,
    scheduledDueAt: input.scheduledDueAt,
    subjectKey: memoryKey
  } satisfies ReviewSubjectLogRow;
}

async function insertReviewBundles(
  database: DatabaseClient,
  seeds: ReviewBundleSeed[]
) {
  const bundles = seeds.map((seed) => buildReviewBundle(seed));

  await database.insert(media).values(bundles.map((bundle) => bundle.media));
  await database.insert(lesson).values(bundles.map((bundle) => bundle.lesson));
  await database
    .insert(lessonProgress)
    .values(bundles.map((bundle) => bundle.lessonProgress));
  await database.insert(card).values(bundles.map((bundle) => bundle.card));
}

function buildReviewBundle(
  input: ReviewBundleSeed,
  now = REVIEW_FIXTURE_CREATED_AT
) {
  return {
    card: {
      back: input.cardBack,
      cardType: "recognition",
      createdAt: now,
      exampleIt: null,
      exampleJp: null,
      front: input.cardFront,
      id: input.cardId,
      lessonId: input.lessonId,
      mediaId: input.mediaId,
      notesIt: null,
      orderIndex: 1,
      segmentId: null,
      sourceFile: input.cardSourceFile,
      status: "active",
      updatedAt: now
    } satisfies typeof card.$inferInsert,
    lesson: {
      createdAt: now,
      difficulty: "beginner",
      id: input.lessonId,
      mediaId: input.mediaId,
      orderIndex: 1,
      segmentId: null,
      slug: input.lessonSlug,
      sourceFile: input.lessonSourceFile,
      status: "active",
      summary: input.lessonTitle,
      title: input.lessonTitle,
      updatedAt: now
    } satisfies typeof lesson.$inferInsert,
    lessonProgress: {
      completedAt: now,
      lastOpenedAt: now,
      lessonId: input.lessonId,
      startedAt: now,
      status: "completed"
    } satisfies typeof lessonProgress.$inferInsert,
    media: {
      baseExplanationLanguage: "it",
      createdAt: now,
      description: input.description,
      id: input.mediaId,
      language: "ja",
      mediaType: "game",
      segmentKind: "chapter",
      slug: input.mediaSlug,
      status: "active",
      title: input.mediaTitle,
      updatedAt: now
    } satisfies typeof media.$inferInsert
  };
}

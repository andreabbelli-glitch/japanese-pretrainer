import { eq } from "drizzle-orm";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  lesson,
  lessonProgress,
  reviewSubjectState,
  type DatabaseClient
} from "../../db/index.ts";

const E2E_APP_BASE_URL = "http://127.0.0.1:3100";
const E2E_DATABASE_URL = "E2E_DATABASE_URL";
const CONTENT_CACHE_REVALIDATE_SECRET = "CONTENT_CACHE_REVALIDATE_SECRET";

const duelMastersMediaSlug = "duel-masters-dm25";
const duelMastersReviewLessonSlug = "tcg-core-overview";
const duelMastersReviewLessonId = "lesson-duel-masters-dm25-tcg-core-overview";
const duelMastersReviewCardId = "card-deck-recognition";

export function getE2EDatabaseUrl() {
  const databaseUrl = process.env[E2E_DATABASE_URL]?.trim();

  if (!databaseUrl) {
    throw new Error("E2E_DATABASE_URL is not configured.");
  }

  return databaseUrl;
}

export async function prepareDuelMastersReviewBaseline() {
  const database = createDatabaseClient({
    databaseUrl: getE2EDatabaseUrl()
  });

  try {
    await seedDuelMastersReviewBaseline(database);
  } finally {
    closeDatabaseClient(database);
  }

  await revalidateDuelMastersReviewBaselineCache();
}

export async function seedDuelMastersReviewBaseline(
  database: DatabaseClient,
  now = new Date()
) {
  const nowIso = now.toISOString();
  const [lessonRow, cardRow, reviewSubjectStateRow] = await Promise.all([
    database.query.lesson.findFirst({
      where: eq(lesson.id, duelMastersReviewLessonId)
    }),
    database.query.card.findFirst({
      where: eq(card.id, duelMastersReviewCardId)
    }),
    database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.cardId, duelMastersReviewCardId)
    })
  ]);

  if (!lessonRow) {
    throw new Error(
      `Missing Duel Masters review lesson ${duelMastersReviewLessonId}.`
    );
  }

  if (!cardRow) {
    throw new Error(`Missing Duel Masters review card ${duelMastersReviewCardId}.`);
  }

  if (!reviewSubjectStateRow) {
    throw new Error(
      `Missing Duel Masters review subject for card ${duelMastersReviewCardId}.`
    );
  }

  await database.transaction(async (tx) => {
    await tx
      .insert(lessonProgress)
      .values({
        completedAt: nowIso,
        lastOpenedAt: nowIso,
        lessonId: lessonRow.id,
        startedAt: nowIso,
        status: "completed"
      })
      .onConflictDoUpdate({
        target: lessonProgress.lessonId,
        set: {
          completedAt: nowIso,
          lastOpenedAt: nowIso,
          startedAt: nowIso,
          status: "completed"
        }
      });

    await tx
      .update(card)
      .set({
        status: "active",
        updatedAt: nowIso
      })
      .where(eq(card.id, cardRow.id));

    await tx
      .update(reviewSubjectState)
      .set({
        cardId: cardRow.id,
        difficulty: null,
        dueAt: nowIso,
        lastInteractionAt: nowIso,
        lastReviewedAt: null,
        learningSteps: 0,
        lapses: 0,
        manualOverride: false,
        reps: 0,
        scheduledDays: 0,
        stability: null,
        state: "new",
        suspended: false,
        updatedAt: nowIso
      })
      .where(eq(reviewSubjectState.cardId, cardRow.id));
  });
}

async function revalidateDuelMastersReviewBaselineCache() {
  const secret = process.env[CONTENT_CACHE_REVALIDATE_SECRET]?.trim();

  if (!secret) {
    throw new Error("CONTENT_CACHE_REVALIDATE_SECRET is not configured.");
  }

  const response = await fetch(
    new URL("/api/internal/content-cache/revalidate", E2E_APP_BASE_URL),
    {
      body: JSON.stringify({
        lessons: [
          {
            lessonSlug: duelMastersReviewLessonSlug,
            mediaSlug: duelMastersMediaSlug
          }
        ],
        mediaSlugs: [duelMastersMediaSlug]
      }),
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret
      },
      method: "POST"
    }
  );

  if (response.ok) {
    return;
  }

  const errorText = await response.text();

  throw new Error(
    `Failed to revalidate Duel Masters review baseline cache (${response.status}): ${errorText}`
  );
}

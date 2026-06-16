import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type DatabaseClient } from "@/db";
import { card, lesson, lessonProgress, media } from "@/db/schema";
import { getReviewPageData } from "@/features/review/server";

import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";

describe("review prestudy mode", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    ({ database, tempDir } = await setupReviewDatabase({
      prefix: "jcs-review-prestudy-",
      seedDevelopmentFixture: true
    }));
  });

  afterEach(async () => {
    await cleanupReviewDatabase({ database, tempDir });
  });

  it("builds prestudy from the next incomplete media lesson and advances after completion", async () => {
    const now = "2026-03-12T09:00:00.000Z";

    await database.insert(media).values({
      id: "media_prestudy",
      slug: "media-prestudy",
      title: "Media Prestudy",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture per prestudy",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await database.insert(lesson).values([
      {
        id: "lesson_prestudy_one",
        mediaId: "media_prestudy",
        segmentId: null,
        slug: "lesson-one",
        title: "Lesson One",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lesson One",
        status: "active",
        sourceFile: "tests/review/prestudy/lesson-one.md",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "lesson_prestudy_two",
        mediaId: "media_prestudy",
        segmentId: null,
        slug: "lesson-two",
        title: "Lesson Two",
        orderIndex: 2,
        difficulty: "beginner",
        summary: "Lesson Two",
        status: "active",
        sourceFile: "tests/review/prestudy/lesson-two.md",
        createdAt: now,
        updatedAt: now
      }
    ]);
    await database.insert(lessonProgress).values({
      lessonId: "lesson_prestudy_one",
      status: "in_progress",
      startedAt: now,
      lastOpenedAt: now
    });
    await database.insert(card).values([
      {
        id: "card_prestudy_one",
        mediaId: "media_prestudy",
        lessonId: "lesson_prestudy_one",
        segmentId: null,
        sourceFile: "tests/review/prestudy/cards-one.md",
        cardType: "recognition",
        front: "予習一",
        back: "prestudio uno",
        notesIt: "Card della prima lesson incompleta.",
        status: "active",
        orderIndex: 1,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "card_prestudy_two",
        mediaId: "media_prestudy",
        lessonId: "lesson_prestudy_two",
        segmentId: null,
        sourceFile: "tests/review/prestudy/cards-two.md",
        cardType: "recognition",
        front: "予習二",
        back: "prestudio due",
        notesIt: "Card della seconda lesson incompleta.",
        status: "active",
        orderIndex: 2,
        createdAt: now,
        updatedAt: now
      }
    ]);

    const standardPage = await getReviewPageData(
      "media-prestudy",
      {},
      database
    );
    const prestudyPage = await getReviewPageData(
      "media-prestudy",
      {
        mode: "prestudy"
      },
      database
    );

    expect(standardPage?.selectedCard).toBeNull();
    expect(prestudyPage?.mode).toBe("prestudy");
    expect(prestudyPage?.session.prestudy?.lessonTitle).toBe("Lesson One");
    expect(prestudyPage?.session.prestudy?.lessonHref).toBe(
      "/media/media-prestudy/textbook/lesson-one"
    );
    expect(prestudyPage?.queueCardIds).toEqual(["card_prestudy_one"]);
    expect(prestudyPage?.selectedCard?.id).toBe("card_prestudy_one");
    expect(prestudyPage?.selectedCard?.bucketLabel).toBe("Prestudio");
    expect(prestudyPage?.selectedCardContext).toMatchObject({
      isQueueCard: true,
      position: 1,
      remainingCount: 0
    });

    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-12T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, "lesson_prestudy_one"));

    const nextPrestudyPage = await getReviewPageData(
      "media-prestudy",
      {
        mode: "prestudy"
      },
      database
    );

    expect(nextPrestudyPage?.session.prestudy?.lessonTitle).toBe("Lesson Two");
    expect(nextPrestudyPage?.queueCardIds).toEqual(["card_prestudy_two"]);
    expect(nextPrestudyPage?.selectedCard?.id).toBe("card_prestudy_two");
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviewPage } from "@/components/review/review-page";
import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  reviewLog,
  reviewState,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import {
  getReviewCardDetailData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia
} from "@/lib/review";
import {
  applyReviewGrade,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";
import { scheduleReview } from "@/lib/review-scheduler";
import { updateStudySettings } from "@/lib/settings";

describe("review system", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("uses a simple step-based scheduler that stays evolvable", () => {
    const fromNew = scheduleReview({
      current: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        reps: 0,
        stability: null,
        state: null
      },
      now: new Date("2026-03-09T10:00:00.000Z"),
      rating: "good"
    });
    const fromReview = scheduleReview({
      current: {
        difficulty: 3.2,
        dueAt: "2026-03-12T10:00:00.000Z",
        lapses: 1,
        lastReviewedAt: "2026-03-09T10:00:00.000Z",
        reps: 5,
        stability: 3,
        state: "review"
      },
      now: new Date("2026-03-12T10:00:00.000Z"),
      rating: "again"
    });

    expect(fromNew.state).toBe("review");
    expect(fromNew.stability).toBe(1);
    expect(fromNew.dueAt).toBe("2026-03-10T10:00:00.000Z");

    expect(fromReview.state).toBe("relearning");
    expect(fromReview.lapses).toBe(2);
    expect(fromReview.reps).toBe(6);
    expect(fromReview.dueAt).toBe("2026-03-12T10:00:00.000Z");
  });

  it("builds a daily queue that separates due, new, manual, and suspended cards", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database.insert(card).values([
      {
        id: "card_demo_new_context",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "content/media/demo-anime/cards/basic/new-context.md",
        cardType: "production",
        front: "行きます",
        back: "andare (forma educata)",
        notesIt: "Nuova card da introdurre nel daily queue.",
        status: "active",
        orderIndex: 3,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      },
      {
        id: "card_demo_suspended",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "content/media/demo-anime/cards/basic/suspended.md",
        cardType: "recognition",
        front: "行った",
        back: "andato",
        notesIt: "Card sospesa ma con scheduling preservato.",
        status: "suspended",
        orderIndex: 4,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_demo_new_context_primary",
        cardId: "card_demo_new_context",
        entryType: "term",
        entryId: developmentFixture.termId,
        relationshipType: "primary"
      },
      {
        id: "card_entry_link_demo_suspended_primary",
        cardId: "card_demo_suspended",
        entryType: "term",
        entryId: developmentFixture.termId,
        relationshipType: "primary"
      }
    ]);
    await database.insert(reviewState).values({
      cardId: "card_demo_suspended",
      state: "review",
      stability: 4,
      difficulty: 3,
      dueAt: "2999-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-08T10:00:00.000Z",
      lapses: 0,
      reps: 4,
      manualOverride: false,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });

    const queue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(queue).not.toBeNull();
    expect(queue?.dueCount).toBe(1);
    expect(queue?.newAvailableCount).toBe(1);
    expect(queue?.newQueuedCount).toBe(1);
    expect(queue?.queueCount).toBe(2);
    expect(queue?.manualCount).toBe(1);
    expect(queue?.suspendedCount).toBe(1);
    expect(queue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      developmentFixture.primaryCardId,
      "card_demo_new_context"
    ]);
  });

  it("persists grading into review_state and review_log without overwriting history", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T12:00:00.000Z"),
      rating: "good"
    });

    const persistedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const logs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });

    expect(persistedState?.state).toBe("review");
    expect(persistedState?.reps).toBe(4);
    expect(persistedState?.lapses).toBe(1);
    expect(persistedState?.dueAt).toBe("2026-03-10T12:00:00.000Z");
    expect(logs).toHaveLength(2);
    expect(logs.at(-1)?.previousState).toBe("learning");
    expect(logs.at(-1)?.newState).toBe("review");
    expect(logs.at(-1)?.rating).toBe("good");
  });

  it("does not keep backfilling fresh new cards after the daily new limit has been used", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );

    await database
      .update(reviewState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database.insert(card).values([
      {
        id: "card_demo_new_limit_a",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "content/media/demo-anime/cards/basic/new-limit-a.md",
        cardType: "recognition",
        front: "一枚目",
        back: "prima carta",
        notesIt: "Prima nuova del giorno.",
        status: "active",
        orderIndex: 10,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      },
      {
        id: "card_demo_new_limit_b",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "content/media/demo-anime/cards/basic/new-limit-b.md",
        cardType: "recognition",
        front: "二枚目",
        back: "seconda carta",
        notesIt: "Non deve rimpiazzare la prima nello stesso giorno.",
        status: "active",
        orderIndex: 11,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_demo_new_limit_a",
        cardId: "card_demo_new_limit_a",
        entryType: "term",
        entryId: developmentFixture.termId,
        relationshipType: "secondary"
      },
      {
        id: "card_entry_link_demo_new_limit_b",
        cardId: "card_demo_new_limit_b",
        entryType: "term",
        entryId: developmentFixture.termId,
        relationshipType: "secondary"
      }
    ]);

    const initialPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(initialPage?.queue.dueCount).toBe(0);
    expect(initialPage?.queue.newQueuedCount).toBe(1);
    expect(initialPage?.queue.queueCount).toBe(1);
    expect(initialPage?.selectedCard?.id).toBe("card_demo_new_limit_a");

    await applyReviewGrade({
      cardId: "card_demo_new_limit_a",
      database,
      rating: "good"
    });

    const afterFirstNew = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(afterFirstNew?.queue.newAvailableCount).toBe(1);
    expect(afterFirstNew?.queue.newQueuedCount).toBe(0);
    expect(afterFirstNew?.queue.queueCount).toBe(0);
    expect(afterFirstNew?.selectedCard).toBeNull();

    const completionMarkup = renderToStaticMarkup(
      ReviewPage({ data: afterFirstNew! })
    );

    expect(completionMarkup).toContain("Aggiungi ancora 1 nuova");

    const toppedUpPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        extraNew: "10"
      },
      database
    );

    expect(toppedUpPage?.queue.effectiveDailyLimit).toBe(11);
    expect(toppedUpPage?.queue.newQueuedCount).toBe(1);
    expect(toppedUpPage?.queue.queueCount).toBe(1);
    expect(toppedUpPage?.selectedCard?.id).toBe("card_demo_new_limit_b");
  });

  it("keeps the main stage in a completion state when the queue is empty unless a card is explicitly selected", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-11T12:00:00.000Z"),
      rating: "good"
    });

    const completionPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        answered: "1"
      },
      database
    );
    const explicitSelectionPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        answered: "1",
        card: developmentFixture.secondaryCardId
      },
      database
    );

    expect(completionPage).not.toBeNull();
    expect(completionPage?.queue.queueCount).toBe(0);
    expect(completionPage?.selectedCard).toBeNull();
    expect(completionPage?.queue.manualCount).toBe(1);
    expect(completionPage?.queue.upcomingCount).toBe(1);

    expect(explicitSelectionPage?.selectedCard?.id).toBe(
      developmentFixture.secondaryCardId
    );
  });

  it("exposes reading and example sentences in review answers", async () => {
    const primaryPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId,
        show: "answer"
      },
      database
    );
    const secondaryPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.secondaryCardId,
        show: "answer"
      },
      database
    );
    const primaryDetail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(primaryPage?.selectedCard?.reading).toBe("いく");
    expect(primaryPage?.selectedCard?.exampleJp).toBe("{{駅|えき}}まで {{行|い}}く。");
    expect(primaryPage?.selectedCard?.exampleIt).toBe("Vado fino alla stazione.");
    expect(secondaryPage?.selectedCard?.reading).toBe("〜ている");
    expect(primaryDetail?.card.reading).toBe("いく");
    expect(primaryDetail?.card.exampleJp).toBe("{{駅|えき}}まで {{行|い}}く。");
    expect(primaryDetail?.card.exampleIt).toBe("Vado fino alla stazione.");

    const primaryMarkup = renderToStaticMarkup(
      ReviewPage({ data: primaryPage! })
    );

    expect(primaryMarkup).toContain("review-stage__reading");
    expect(primaryMarkup).toContain("いく");
    expect(primaryMarkup).toContain("reader-example-sentence");
    expect(primaryMarkup).toContain("Mostra traduzione italiana");
    expect(primaryMarkup).toContain("Vado fino alla stazione.");
  });

  it("renders grading actions from easy to again with next-review previews", async () => {
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId,
        show: "answer"
      },
      database
    );

    expect(reviewPage?.selectedCardContext.gradePreviews).toHaveLength(4);
    expect(
      reviewPage?.selectedCardContext.gradePreviews.map((preview) => preview.rating)
    ).toEqual(["again", "hard", "good", "easy"]);

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));
    const easyIndex = markup.indexOf(">Easy<");
    const goodIndex = markup.indexOf(">Good<");
    const hardIndex = markup.indexOf(">Hard<");
    const againIndex = markup.indexOf(">Again<");

    expect(easyIndex).toBeGreaterThan(-1);
    expect(goodIndex).toBeGreaterThan(easyIndex);
    expect(hardIndex).toBeGreaterThan(goodIndex);
    expect(againIndex).toBeGreaterThan(hardIndex);
    expect(markup).toContain("Prossima review:");
    expect(markup).toContain("Subito");
    expect(markup).toContain("Tra 30 min");
  });

  it("keeps the review page focused on the active card instead of rendering the lower queue panels", async () => {
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId
      },
      database
    );

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));

    expect(markup).not.toContain("Pronte oggi");
    expect(markup).not.toContain("Contesto utile");
    expect(markup).not.toContain("Fuori coda");
  });

  it("uses entry_status for manual mastery and restores the queue when reopened", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "known_manual"
    });

    const manualQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const persistedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const logs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });

    expect(
      manualQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(false);
    expect(manualQueue?.manualCount).toBe(2);
    expect(persistedState?.state).toBe("learning");
    expect(logs).toHaveLength(1);

    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:05:00.000Z"),
      status: "learning"
    });

    const reopenedQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(
      reopenedQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(true);
    expect(reopenedQueue?.manualCount).toBe(1);
  });

  it("suspends and resets cards without destroying the underlying review history", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    const originalState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });

    await setReviewCardSuspended({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T14:00:00.000Z"),
      suspended: true
    });

    const suspendedQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const suspendedCard = await database.query.card.findFirst({
      where: eq(card.id, developmentFixture.primaryCardId)
    });
    const preservedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });

    expect(suspendedCard?.status).toBe("suspended");
    expect(suspendedQueue?.suspendedCount).toBe(1);
    expect(preservedState?.dueAt).toBe(originalState?.dueAt);

    await setReviewCardSuspended({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T14:05:00.000Z"),
      suspended: false
    });
    await resetReviewCardProgress({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T14:10:00.000Z")
    });

    const resetState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const logs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });
    const resetQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(resetState?.state).toBe("new");
    expect(resetState?.reps).toBe(0);
    expect(resetState?.lapses).toBe(0);
    expect(resetState?.dueAt).toBe("2026-03-09T14:10:00.000Z");
    expect(logs).toHaveLength(1);
    expect(resetQueue?.cards[0]?.id).toBe(developmentFixture.primaryCardId);
  });
});

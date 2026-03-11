import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

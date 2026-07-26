import { revalidatePathMock } from "./helpers/review-next-mocks";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewPage } from "@/components/review/review-page";
import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  card,
  cardEntryLink,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  term
} from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import * as fsrsOptimizer from "@/features/fsrs-optimizer/server";
import { importContentWorkspace } from "@/features/content/importer";
import {
  getGlobalReviewPageData,
  getGlobalReviewPageLoadResult,
  getReviewLaunchMedia,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  loadGlobalReviewOverviewSnapshot,
  loadReviewOverviewSnapshots
} from "@/features/review/server";
import { applyReviewGrade } from "@/features/review/server/service";
import { buildCanonicalReviewSessionHref } from "@/features/navigation";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
import * as settings from "@/features/settings/server";
import { updateStudySettings } from "@/features/settings/server";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import { createIsolatedNewMediaFixture } from "./helpers/review-fixture";
import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";
import {
  loadCrossMediaTermSubjectContext,
  primarySubjectKey,
  secondarySubjectKey
} from "./helpers/review-shared";

describe("review queue", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    revalidatePathMock.mockReset();
    ({ database, tempDir } = await setupReviewDatabase({
      prefix: "jcs-review-",
      seedDevelopmentFixture: true
    }));
  });

  afterEach(async () => {
    await cleanupReviewDatabase({ database, tempDir });
  });

  it("hides cards tied to incomplete lessons and also excludes orphan cards", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    await database.insert(term).values({
      id: "term_fixture_orphan",
      sourceId: "term_fixture_orphan",
      mediaId: developmentFixture.mediaId,
      segmentId: developmentFixture.segmentId,
      lemma: "孤立",
      reading: "こりつ",
      romaji: "koritsu",
      pos: "sostantivo",
      meaningIt: "isolamento",
      meaningLiteralIt: null,
      notesIt: "Termine non introdotto in alcuna lesson.",
      levelHint: null,
      searchLemmaNorm: "孤立",
      searchReadingNorm: "こりつ",
      searchRomajiNorm: "koritsu",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card_fixture_orphan",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/orphan.md",
      cardType: "recognition",
      front: "孤立",
      back: "orfana",
      notesIt: "Card senza entry lesson-linked.",
      status: "active",
      orderIndex: 99,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_orphan_primary",
      cardId: "card_fixture_orphan",
      entryType: "term",
      entryId: "term_fixture_orphan",
      relationshipType: "primary"
    });

    const queue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(queue?.cards).toHaveLength(0);
    expect(queue?.dueCount).toBe(0);
    expect(queue?.newAvailableCount).toBe(0);
    expect(queue?.newQueuedCount).toBe(0);
  });

  it("builds a daily queue that separates due, new, manual, and suspended cards", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await database.insert(card).values([
      {
        id: "card_fixture_new_context",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-context.md",
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
        id: "card_fixture_suspended",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/suspended.md",
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
        id: "card_entry_link_fixture_new_context_primary",
        cardId: "card_fixture_new_context",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      },
      {
        id: "card_entry_link_fixture_suspended_primary",
        cardId: "card_fixture_suspended",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      }
    ]);
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
    expect(queue?.suspendedCount).toBe(0);
    expect(queue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      developmentFixture.primaryCardId,
      "card_fixture_new_context"
    ]);
  });

  it("counts only due and upcoming cards as active review cards in overview snapshots", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await database.insert(card).values([
      {
        id: "card_fixture_overview_new",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/overview-new.md",
        cardType: "production",
        front: "行きます",
        back: "andare (forma educata)",
        notesIt: "Nuova card che non deve contare come attiva.",
        status: "active",
        orderIndex: 30,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      },
      {
        id: "card_fixture_overview_suspended",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/overview-suspended.md",
        cardType: "recognition",
        front: "行った",
        back: "andato",
        notesIt: "Card sospesa che non deve contare come attiva.",
        status: "suspended",
        orderIndex: 31,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_fixture_overview_new_primary",
        cardId: "card_fixture_overview_new",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      },
      {
        id: "card_entry_link_fixture_overview_suspended_primary",
        cardId: "card_fixture_overview_suspended",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      }
    ]);
    const [queue, overviewSnapshots] = await Promise.all([
      getReviewQueueSnapshotForMedia(developmentFixture.mediaSlug, database),
      loadReviewOverviewSnapshots(database, [
        {
          id: developmentFixture.mediaId,
          slug: developmentFixture.mediaSlug
        }
      ])
    ]);
    const overview = overviewSnapshots.get(developmentFixture.mediaId);

    expect(queue).not.toBeNull();
    expect(overview).not.toBeUndefined();
    expect(overview?.activeCards).toBe(
      (queue?.dueCount ?? 0) + (queue?.upcomingCount ?? 0)
    );
    expect(overview?.activeCards).toBe(1);
  });

  it("selects the best review launch media without loading the dashboard", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await database.insert(media).values({
      id: "media_duel_masters",
      slug: "duel-masters-dm25",
      title: "Duel Masters",
      mediaType: "tcg",
      segmentKind: "deck",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Media con review veramente pronta.",
      status: "active",
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(lesson).values({
      id: "lesson_duel_masters_intro",
      mediaId: "media_duel_masters",
      segmentId: null,
      slug: "tcg-core-overview",
      title: "TCG Core Overview",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson Duel Masters.",
      status: "active",
      sourceFile:
        "content/media/duel-masters-dm25/textbook/001-tcg-core-overview.md",
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(lessonProgress).values({
      lessonId: "lesson_duel_masters_intro",
      status: "completed",
      completedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(term).values({
      id: "term_duel_masters_review",
      sourceId: "term_duel_masters_review",
      mediaId: "media_duel_masters",
      segmentId: null,
      lemma: "シールド",
      reading: "シールド",
      romaji: "shiirudo",
      pos: "sostantivo",
      meaningIt: "scudo",
      meaningLiteralIt: null,
      notesIt: null,
      levelHint: null,
      searchLemmaNorm: "シールド",
      searchReadingNorm: "シールド",
      searchRomajiNorm: "shiirudo",
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(card).values({
      id: "card_duel_masters_due",
      mediaId: "media_duel_masters",
      lessonId: "lesson_duel_masters_intro",
      segmentId: null,
      sourceFile: "content/media/duel-masters-dm25/cards/001-tcg-core.md",
      cardType: "recognition",
      front: "シールド",
      back: "scudo",
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_duel_masters_primary",
      cardId: "card_duel_masters_due",
      entryType: "term",
      entryId: "term_duel_masters_review",
      relationshipType: "primary"
    });
    await database.insert(reviewSubjectState).values({
      canonicalSubjectKey: "entry:term:term_duel_masters_review",
      recallTask: "recognition",
      subjectKey: buildReviewMemoryKey({
        canonicalSubjectKey: "entry:term:term_duel_masters_review",
        cardId: "card_duel_masters_due",
        recallTask: "recognition"
      }),
      subjectType: "entry",
      entryType: "term",
      entryId: "term_duel_masters_review",
      crossMediaGroupId: null,
      cardId: "card_duel_masters_due",
      state: "review",
      stability: 3,
      difficulty: 2.5,
      dueAt: "2026-03-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      lastInteractionAt: "2026-03-08T09:00:00.000Z",
      scheduledDays: 0,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });

    const launchMedia = await getReviewLaunchMedia(database);

    expect(launchMedia?.slug).toBe("duel-masters-dm25");
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
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    await database.insert(card).values([
      {
        id: "card_fixture_new_limit_a",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-limit-a.md",
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
        id: "card_fixture_new_limit_b",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-limit-b.md",
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
        id: "card_entry_link_fixture_new_limit_a",
        cardId: "card_fixture_new_limit_a",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "secondary"
      },
      {
        id: "card_entry_link_fixture_new_limit_b",
        cardId: "card_fixture_new_limit_b",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "secondary"
      }
    ]);

    const initialPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(initialPage?.queue.dueCount).toBe(0);
    expect(initialPage?.queue.newAvailableCount).toBe(0);
    expect(initialPage?.queue.newQueuedCount).toBe(0);
    expect(initialPage?.queue.queueCount).toBe(0);
    expect(initialPage?.selectedCard).toBeNull();
    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });

    await applyReviewGrade({
      cardId: "card_fixture_new_limit_a",
      database,
      expectedUpdatedAt: beforeState?.updatedAt ?? null,
      rating: "good"
    });

    const afterFirstNew = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(afterFirstNew?.queue.newAvailableCount).toBe(0);
    expect(afterFirstNew?.queue.newQueuedCount).toBe(0);
    expect(afterFirstNew?.queue.queueCount).toBe(0);
    expect(afterFirstNew?.selectedCard).toBeNull();

    const completionMarkup = renderToStaticMarkup(
      ReviewPage({ data: afterFirstNew! })
    );

    expect(completionMarkup).not.toContain("Aggiungi ancora 1 nuova");

    const toppedUpPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        extraNew: "10"
      },
      database
    );

    expect(toppedUpPage?.queue.effectiveDailyLimit).toBe(11);
    expect(toppedUpPage?.queue.newQueuedCount).toBe(0);
    expect(toppedUpPage?.queue.queueCount).toBe(0);
    expect(toppedUpPage?.selectedCard).toBeNull();
  });

  it("still queues a new card when a top-up is requested after other new subjects were already introduced today", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );
    const fixture = await createIsolatedNewMediaFixture(database, {
      cardCount: 3,
      mediaId: "topup_followup_media",
      mediaSlug: "topup-followup-media",
      title: "Top-up Follow-up Media"
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T13:00:00.000Z"));

    try {
      await applyReviewGrade({
        cardId: fixture.cardIds[0],
        database,
        rating: "good"
      });

      const firstTopUpPage = await getReviewPageData(
        fixture.mediaSlug,
        {
          extraNew: "1"
        },
        database
      );

      const firstTopUpCardId = firstTopUpPage?.selectedCard?.id ?? null;

      expect(firstTopUpCardId).not.toBeNull();
      expect(fixture.cardIds.slice(1)).toContain(firstTopUpCardId);
      expect(firstTopUpPage?.queue.newQueuedCount).toBe(1);

      await applyReviewGrade({
        cardId: firstTopUpCardId!,
        database,
        rating: "good"
      });

      const completionPage = await getReviewPageData(
        fixture.mediaSlug,
        {},
        database
      );

      expect(completionPage?.queue.newAvailableCount).toBe(1);
      expect(completionPage?.queue.newQueuedCount).toBe(0);
      expect(completionPage?.queue.queueCount).toBe(2);
      expect(completionPage?.selectedCard?.bucket).toBe("upcoming");
      expect([fixture.cardIds[0], firstTopUpCardId]).toContain(
        completionPage?.selectedCard?.id
      );

      const toppedUpPage = await getReviewPageData(
        fixture.mediaSlug,
        {
          extraNew: "1"
        },
        database
      );

      expect(toppedUpPage?.queue.newAvailableCount).toBe(1);
      expect(toppedUpPage?.queue.newQueuedCount).toBe(1);
      expect(toppedUpPage?.queue.queueCount).toBe(1);
      expect(toppedUpPage?.selectedCard?.id).toBe(
        fixture.cardIds.slice(1).find((cardId) => cardId !== firstTopUpCardId)
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the main stage in a completion state when the queue is empty unless a card is explicitly selected", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      expectedUpdatedAt: beforeState?.updatedAt ?? null,
      now: new Date("2026-03-11T12:00:00.000Z"),
      rating: "good"
    });
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

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
    expect(explicitSelectionPage?.selectedCard?.gradePreviews).toEqual([]);
    expect(
      explicitSelectionPage?.selectedCardContext.gradePreviews
    ).toHaveLength(4);
  });

  it("builds canonical review session urls and tracks only cards remaining after the current one", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    await database.insert(card).values({
      id: "card_fixture_remaining_count",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/remaining-count.md",
      cardType: "recognition",
      front: "残り",
      back: "restante",
      notesIt: "Serve a verificare il conteggio delle card rimanenti.",
      status: "active",
      orderIndex: 2,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(term).values({
      id: "term_fixture_remaining_count",
      sourceId: "term-fixture-remaining-count",
      mediaId: developmentFixture.mediaId,
      segmentId: developmentFixture.segmentId,
      lemma: "残り",
      reading: "のこり",
      romaji: "nokori",
      pos: "sostantivo",
      meaningIt: "restante",
      meaningLiteralIt: null,
      notesIt: "Termine dedicato al test del conteggio rimanente.",
      levelHint: null,
      searchLemmaNorm: "残り",
      searchReadingNorm: "のこり",
      searchRomajiNorm: "nokori",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_remaining_count",
      cardId: "card_fixture_remaining_count",
      entryType: "term",
      entryId: "term_fixture_remaining_count",
      relationshipType: "primary"
    });
    await database.insert(reviewSubjectState).values({
      canonicalSubjectKey: "entry:term:term_fixture_remaining_count",
      recallTask: "recognition",
      subjectKey: buildReviewMemoryKey({
        canonicalSubjectKey: "entry:term:term_fixture_remaining_count",
        cardId: "card_fixture_remaining_count",
        recallTask: "recognition"
      }),
      subjectType: "entry",
      entryType: "term",
      entryId: "term_fixture_remaining_count",
      crossMediaGroupId: null,
      cardId: "card_fixture_remaining_count",
      state: "review",
      stability: 2.1,
      difficulty: 3.6,
      dueAt: "2000-01-01T00:05:00.000Z",
      lastReviewedAt: "2026-03-09T09:00:00.000Z",
      lastInteractionAt: "2026-03-09T09:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 2,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-09T09:00:00.000Z",
      updatedAt: "2026-03-09T09:00:00.000Z"
    });

    const frontQueuePage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const explicitQueuePage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: "card_fixture_remaining_count"
      },
      database
    );

    expect(frontQueuePage?.selectedCard?.id).toBe(
      developmentFixture.primaryCardId
    );
    expect(frontQueuePage?.queueCardIds).toEqual([
      developmentFixture.primaryCardId,
      "card_fixture_remaining_count"
    ]);
    expect(frontQueuePage?.selectedCardContext.position).toBe(1);
    expect(frontQueuePage?.selectedCardContext.remainingCount).toBe(1);
    expect(
      buildCanonicalReviewSessionHref({
        answeredCount: frontQueuePage?.session.answeredCount,
        cardId: frontQueuePage?.selectedCard?.id ?? null,
        extraNewCount: frontQueuePage?.session.extraNewCount,
        isQueueCard: frontQueuePage?.selectedCardContext.isQueueCard ?? false,
        mediaSlug: developmentFixture.mediaSlug,
        position: frontQueuePage?.selectedCardContext.position ?? null,
        showAnswer: frontQueuePage?.selectedCardContext.showAnswer
      })
    ).toBe(`/media/${developmentFixture.mediaSlug}/review`);

    expect(explicitQueuePage?.selectedCard?.id).toBe(
      "card_fixture_remaining_count"
    );
    expect(explicitQueuePage?.selectedCardContext.position).toBe(2);
    expect(explicitQueuePage?.selectedCardContext.remainingCount).toBe(0);
    expect(
      buildCanonicalReviewSessionHref({
        answeredCount: explicitQueuePage?.session.answeredCount,
        cardId: explicitQueuePage?.selectedCard?.id ?? null,
        extraNewCount: explicitQueuePage?.session.extraNewCount,
        isQueueCard:
          explicitQueuePage?.selectedCardContext.isQueueCard ?? false,
        mediaSlug: developmentFixture.mediaSlug,
        position: explicitQueuePage?.selectedCardContext.position ?? null,
        showAnswer: explicitQueuePage?.selectedCardContext.showAnswer
      })
    ).toBe(
      `/media/${developmentFixture.mediaSlug}/review?card=card_fixture_remaining_count`
    );
  });

  it("uses shared cross-media subject state in both global and local queues", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-fallback");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const {
      alphaTermEntry,
      canonicalSubjectKey,
      crossMediaGroupId,
      subjectKey
    } = await loadCrossMediaTermSubjectContext(database);

    await database.insert(lessonProgress).values([
      {
        lessonId: crossMediaFixture.alpha.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        lessonId: crossMediaFixture.beta.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      canonicalSubjectKey,
      recallTask: "recognition",
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
      state: "review",
      stability: 2.4,
      difficulty: 3.1,
      dueAt: "2000-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      lastInteractionAt: "2026-03-10T08:00:00.000Z",
      scheduledDays: 2,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      })
    ).not.toBeNull();

    const [globalPage, globalOverview, betaPage] = await Promise.all([
      getGlobalReviewPageData({}, database),
      loadGlobalReviewOverviewSnapshot(database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database)
    ]);
    expect(globalPage.queue.dueCount).toBe(1);
    expect(globalPage.queue.advanceCards.map((card) => card.id)).toEqual([
      crossMediaFixture.beta.mixedCardTermCardId,
      crossMediaFixture.alpha.grammarCardId
    ]);
    expect(globalPage.queue.queueCount).toBeGreaterThan(0);
    expect(globalPage.selectedCard?.id).toBe(
      crossMediaFixture.alpha.termCardId
    );
    expect(globalPage.selectedCard?.back).toContain(
      crossMediaFixture.alpha.termMeaning
    );
    expect(globalPage.selectedCard?.back).toContain(
      crossMediaFixture.beta.termMeaning
    );
    expect(globalPage.selectedCard?.bucket).toBe("due");
    expect(globalPage.selectedCard?.contexts).toHaveLength(2);

    expect(globalOverview.dueCount).toBe(1);

    expect(betaPage).not.toBeNull();
    expect(betaPage?.queue.dueCount).toBe(1);
    expect(betaPage?.selectedCard?.id).toBe(crossMediaFixture.beta.termCardId);
    expect(betaPage?.selectedCard?.bucket).toBe("due");
    expect(betaPage?.selectedCard?.contexts).toHaveLength(1);
  });

  it("excludes a graded cross-media sibling from local review rebuilds", async () => {
    const contentRoot = path.join(tempDir, "cross-media-local-exclude");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const {
      alphaTermEntry,
      canonicalSubjectKey,
      crossMediaGroupId,
      subjectKey
    } = await loadCrossMediaTermSubjectContext(database);

    await database.insert(lessonProgress).values([
      {
        lessonId: crossMediaFixture.alpha.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        lessonId: crossMediaFixture.beta.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      canonicalSubjectKey,
      recallTask: "recognition",
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
      state: "review",
      stability: 2.4,
      difficulty: 3.1,
      dueAt: "2000-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      lastInteractionAt: "2026-03-10T08:00:00.000Z",
      scheduledDays: 2,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });

    const [betaPage, excludedBetaPage] = await Promise.all([
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database, {
        excludeCardIds: [crossMediaFixture.beta.termCardId]
      })
    ]);

    expect(betaPage).not.toBeNull();
    expect(betaPage?.selectedCard?.id).toBe(crossMediaFixture.beta.termCardId);

    expect(excludedBetaPage).not.toBeNull();
    expect(excludedBetaPage?.queue.queueCount).toBe(
      (betaPage?.queue.queueCount ?? 0) - 1
    );
    expect(excludedBetaPage?.queue.dueCount).toBe(
      (betaPage?.queue.dueCount ?? 0) - 1
    );
    expect(excludedBetaPage?.selectedCard?.id).not.toBe(
      crossMediaFixture.beta.termCardId
    );
  });

  it("returns null for a missing media slug even if study settings already started loading", async () => {
    const settingsQuerySpy = vi
      .spyOn(settings, "getStudySettings")
      .mockResolvedValue(settings.defaultStudySettings);

    try {
      await expect(
        getReviewPageData("missing-media-slug", {}, database)
      ).resolves.toBeNull();

      expect(settingsQuerySpy).toHaveBeenCalledTimes(1);
    } finally {
      settingsQuerySpy.mockRestore();
    }
  });

  it("skips loading the FSRS runtime snapshot when the review queue has no selected card", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

    const fsrsSnapshotSpy = vi
      .spyOn(fsrsOptimizer, "getFsrsOptimizerRuntimeSnapshot")
      .mockImplementation(async () => {
        throw new Error(
          "fsrs runtime snapshot should not load without a selected card"
        );
      });

    try {
      const pageData = await getReviewPageData(
        developmentFixture.mediaSlug,
        {},
        database
      );

      expect(pageData?.queue.queueCount).toBe(0);
      expect(pageData?.selectedCard).toBeNull();
      expect(fsrsSnapshotSpy).not.toHaveBeenCalled();
    } finally {
      fsrsSnapshotSpy.mockRestore();
    }
  });

  it("returns the dedicated global empty state when no media exist", async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-empty-media-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);

    await expect(getGlobalReviewPageLoadResult({}, database)).resolves.toEqual({
      kind: "empty-media"
    });
  });

  it("returns the dedicated global empty state when media exist but no active cards do", async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-empty-cards-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);

    await database.insert(media).values({
      id: "media_empty_cards",
      slug: "media-empty-cards",
      title: "Media Empty Cards",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture senza card attive",
      status: "active",
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });

    await expect(getGlobalReviewPageLoadResult({}, database)).resolves.toEqual({
      kind: "empty-cards"
    });
  });

  it("keeps the global route in ready mode when active cards exist but none are eligible yet", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const result = await getGlobalReviewPageLoadResult({}, database);

    expect(result.kind).toBe("ready");

    if (result.kind !== "ready") {
      return;
    }

    expect(result.data.queue.queueCount).toBe(0);
    expect(result.data.selectedCard).toBeNull();
  });
});

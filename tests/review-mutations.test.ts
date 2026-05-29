import { revalidatePathMock } from "./helpers/review-next-mocks";

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  card,
  cardEntryLink,
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState,
  lesson,
  lessonProgress,
  reviewSubjectLog,
  reviewSubjectState,
  term
} from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { buildKanjiClashContrastKey } from "@/features/kanji-clash";
import { importContentWorkspace } from "@/lib/content/importer";
import {
  getReviewQueueSnapshotForMedia,
  loadGlobalReviewOverviewSnapshot
} from "@/features/review/server";
import { getSafeReviewForcedContrastClientErrorMessage } from "@/features/review/model/error-messages";
import {
  applyReviewGrade,
  gradeReviewCardInTransaction,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/features/review/server/service";
import type { ReviewForcedContrastResolution } from "@/features/review/types";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import {
  createIsolatedNewMediaFixture,
  seedSingleReviewCardFixture
} from "./helpers/review-fixture";
import {
  cleanupReviewDatabase,
  markAllLessonsCompleted,
  setupReviewDatabase
} from "./helpers/review-db-fixture";
import {
  loadCrossMediaTermSubjectContext,
  primarySubjectKey,
  secondarySubjectKey
} from "./helpers/review-shared";

describe("review mutations", () => {
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

  it("persists grading into review_subject_state and review_subject_log without overwriting history", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T12:00:00.000Z"),
      rating: "good"
    });

    const persistedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });

    expect(persistedState?.state).toBe("review");
    expect(persistedState?.reps).toBe(4);
    expect(persistedState?.lapses).toBe(1);
    expect(persistedState?.dueAt).toBe("2026-03-10T00:00:00.000Z");
    expect(persistedState?.schedulerVersion).toBe("fsrs_v1");
    expect(persistedState?.scheduledDays).toBe(1);
    expect(persistedState?.learningSteps).toBe(0);
    expect(logs).toHaveLength(2);
    expect(logs.at(-1)?.previousState).toBe("learning");
    expect(logs.at(-1)?.newState).toBe("review");
    expect(logs.at(-1)?.rating).toBe("good");
    expect(logs.at(-1)?.schedulerVersion).toBe("fsrs_v1");
  });

  it("rejects a stale second grade for the same review card", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const beforeLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });
    const expectedUpdatedAt = beforeState?.updatedAt ?? null;
    const now = new Date("2026-03-09T12:30:00.000Z");

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      expectedUpdatedAt,
      now,
      rating: "good"
    });

    await expect(
      applyReviewGrade({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedUpdatedAt,
        now,
        rating: "easy"
      })
    ).rejects.toThrow("Review card is out of date.");

    const afterState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const afterLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });

    expect(afterState?.reps).toBe((beforeState?.reps ?? 0) + 1);
    expect(afterLogs).toHaveLength((beforeLogs?.length ?? 0) + 1);
  });

  it("rejects a stale duplicate grade after a brand-new subject is first graded", async () => {
    const fixture = await createIsolatedNewMediaFixture(database, {
      cardCount: 1,
      mediaId: "media_new_grade_guard",
      mediaSlug: "new-grade-guard",
      title: "New Grade Guard"
    });
    const cardId = fixture.cardIds[0]!;
    const subjectKey = `entry:term:${fixture.termIds[0]}`;

    await applyReviewGrade({
      cardId,
      database,
      expectedUpdatedAt: null,
      now: new Date("2026-03-12T09:00:00.000Z"),
      rating: "good"
    });

    await expect(
      applyReviewGrade({
        cardId,
        database,
        expectedUpdatedAt: null,
        now: new Date("2026-03-12T09:01:00.000Z"),
        rating: "easy"
      })
    ).rejects.toThrow("Review card is out of date.");

    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, subjectKey)
    });

    expect(logs).toHaveLength(1);
  });

  it("stores cross-media grading on the canonical shared subject state", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-mirror");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { subjectKey } = await loadCrossMediaTermSubjectContext(database);
    const existingSubjectState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      });
    expect(existingSubjectState?.state).toBe("new");
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

    const now = new Date("2026-03-11T09:00:00.000Z");
    const nowIso = now.toISOString();

    await applyReviewGrade({
      cardId: crossMediaFixture.alpha.termCardId,
      database,
      now,
      rating: "good"
    });

    const subjectState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, subjectKey)
    });

    expect(subjectState?.lastReviewedAt).toBe(nowIso);
    expect(subjectState?.cardId).toBe(crossMediaFixture.alpha.termCardId);
  });

  it("exposes a transaction-aware grading core with a canonical forced contrast endpoint", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    const result = await database.transaction((tx) =>
      gradeReviewCardInTransaction({
        cardId: developmentFixture.primaryCardId,
        forcedContrast: {
          source: "review-grading",
          targetResultKey: `grammar:entry:${developmentFixture.grammarDbId}`
        },
        now: new Date("2026-03-09T12:00:00.000Z"),
        rating: "good",
        transaction: tx
      })
    );

    expect(result.forcedContrast).toEqual({
      contrastKey: buildKanjiClashContrastKey(
        primarySubjectKey,
        secondarySubjectKey
      ),
      current: {
        cardId: developmentFixture.primaryCardId,
        crossMediaGroupId: null,
        entryId: developmentFixture.termDbId,
        entryType: "term",
        subjectKey: primarySubjectKey,
        subjectType: "entry"
      },
      mediaId: developmentFixture.mediaId,
      mediaSlug: undefined,
      scope: "global",
      source: "forced",
      target: {
        cardId: null,
        crossMediaGroupId: null,
        entryId: developmentFixture.grammarDbId,
        entryType: "grammar",
        subjectKey: secondarySubjectKey,
        subjectType: "entry"
      }
    } satisfies ReviewForcedContrastResolution);

    const storedContrast =
      await database.query.kanjiClashManualContrast.findFirst({
        where: eq(
          kanjiClashManualContrast.contrastKey,
          buildKanjiClashContrastKey(primarySubjectKey, secondarySubjectKey)
        )
      });
    const storedRoundStates =
      await database.query.kanjiClashManualContrastRoundState.findMany({
        where: eq(
          kanjiClashManualContrastRoundState.contrastKey,
          buildKanjiClashContrastKey(primarySubjectKey, secondarySubjectKey)
        )
      });

    const persistedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });

    expect(persistedState?.state).toBe("review");
    expect(storedContrast?.status).toBe("active");
    expect(storedContrast?.source).toBe("forced");
    expect(storedRoundStates).toHaveLength(2);
  });

  it("resolves forced contrast to the canonical shared term subject for cross-media cards", async () => {
    const contentRoot = path.join(tempDir, "cross-media-forced-contrast");

    await writeCrossMediaContentFixture(contentRoot);
    await importContentWorkspace({
      contentRoot,
      database
    });
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);

    const result = await database.transaction((tx) =>
      gradeReviewCardInTransaction({
        cardId: crossMediaFixture.alpha.termCardId,
        forcedContrast: {
          source: "review-grading",
          targetResultKey: "grammar:group:〜共有"
        },
        now: new Date("2026-03-11T09:00:00.000Z"),
        rating: "good",
        transaction: tx
      })
    );

    expect(result.forcedContrast?.current).toMatchObject({
      cardId: crossMediaFixture.alpha.termCardId,
      crossMediaGroupId,
      entryId: alphaTermEntry.id,
      entryType: "term",
      subjectKey,
      subjectType: "group"
    });
  });

  it("marks forced contrast validation failures as safe client-facing review errors", async () => {
    const thrownError = await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      forcedContrast: {
        source: "review-grading",
        targetResultKey: `term:entry:${developmentFixture.termDbId}`
      },
      rating: "good"
    }).catch((error: unknown) => error);

    expect(thrownError).toBeInstanceOf(Error);
    expect((thrownError as Error).message).toBe(
      "Seleziona un contrasto diverso dalla card corrente."
    );
    expect(getSafeReviewForcedContrastClientErrorMessage(thrownError)).toBe(
      "Seleziona un contrasto diverso dalla card corrente."
    );
    expect(
      getSafeReviewForcedContrastClientErrorMessage(
        new Error("Review card not available for grading.")
      )
    ).toBeNull();
  });

  it("rejects review mutations when card and requested media do not match", async () => {
    await expect(
      applyReviewGrade({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other",
        rating: "good"
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");

    await expect(
      setLinkedEntryStatusByCard({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other",
        status: "learning"
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");

    await expect(
      setReviewCardSuspended({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other",
        suspended: true
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");

    await expect(
      resetReviewCardProgress({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other"
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");
  });

  it("uses review subject manual override for manual mastery and restores the queue when reopened", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

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
    const persistedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });

    expect(
      manualQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(false);
    expect(manualQueue?.manualCount).toBe(2);
    expect(persistedState?.state).toBe("learning");
    expect(persistedState?.manualOverride).toBe(true);
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
    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: false,
      state: "learning",
      suspended: false
    });
  });

  it.each([true, false])(
    "normalizes a legacy known_manual subject state with manualOverride=%s when reopened",
    async (manualOverride) => {
      await database
        .update(reviewSubjectState)
        .set({
          dueAt: "2000-01-01T00:00:00.000Z",
          manualOverride,
          state: "known_manual",
          suspended: false
        })
        .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

      const legacyQueue = await getReviewQueueSnapshotForMedia(
        developmentFixture.mediaSlug,
        database
      );

      expect(
        legacyQueue?.cards.some(
          (card) => card.id === developmentFixture.primaryCardId
        )
      ).toBe(false);
      expect(legacyQueue?.manualCount).toBeGreaterThan(0);

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
        await database.query.reviewSubjectState.findFirst({
          where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
        })
      ).toMatchObject({
        manualOverride: false,
        state: "learning",
        suspended: false
      });
      expect(
        reopenedQueue?.cards.some(
          (card) => card.id === developmentFixture.primaryCardId
        )
      ).toBe(true);
    }
  );

  it("preserves an existing scheduled review state when reopening a modern manual override", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z",
        manualOverride: true,
        state: "review",
        suspended: false
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

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
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: false,
      state: "review",
      suspended: false
    });
    expect(
      reopenedQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(true);
  });

  it("clears manual override when resetting a manually excluded card", async () => {
    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "known_manual"
    });

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: true,
      state: "learning"
    });

    await resetReviewCardProgress({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:05:00.000Z")
    });

    const resetQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: false,
      state: "new",
      suspended: false
    });
    expect(
      resetQueue?.cards.some(
        (queuedCard) => queuedCard.id === developmentFixture.primaryCardId
      )
    ).toBe(true);
  });

  it("suspends and resets cards without destroying the underlying review history", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    const originalState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
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
    const preservedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
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

    const resetState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
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

  it("preserves the representative shared subject state when suspending a cross-media sibling", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-suspend");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);

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
      lapses: 1,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      })
    ).not.toBeNull();

    await setReviewCardSuspended({
      cardId: crossMediaFixture.beta.termCardId,
      database,
      now: new Date("2026-03-11T09:00:00.000Z"),
      suspended: true
    });

    const persistedSubjectState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      });

    expect(persistedSubjectState).not.toBeNull();

    expect(persistedSubjectState).toMatchObject({
      cardId: crossMediaFixture.alpha.termCardId,
      createdAt: "2026-03-10T08:00:00.000Z",
      difficulty: 3.1,
      dueAt: "2000-01-01T00:00:00.000Z",
      lapses: 1,
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      reps: 3,
      scheduledDays: 2,
      stability: 2.4,
      state: "review",
      suspended: true
    });
  });

  it("does not count manually excluded new cards as available new work in the global overview", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-manual-override-global-overview-")
    );
    const localDatabase = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    try {
      await runMigrations(localDatabase);
      await seedSingleReviewCardFixture(localDatabase);
      await localDatabase.insert(term).values({
        id: "term_manual_override_new",
        sourceId: "term-manual-override-new",
        mediaId: "media_a",
        segmentId: null,
        lemma: "手動",
        reading: "しゅどう",
        romaji: "shudou",
        pos: "sostantivo",
        meaningIt: "manuale",
        meaningLiteralIt: null,
        notesIt: null,
        levelHint: null,
        searchLemmaNorm: "手動",
        searchReadingNorm: "しゅどう",
        searchRomajiNorm: "shudou",
        createdAt: "2026-03-09T12:00:00.000Z",
        updatedAt: "2026-03-09T12:00:00.000Z"
      });
      await localDatabase.insert(cardEntryLink).values({
        id: "card_entry_link_manual_override_new_primary",
        cardId: "card_a",
        entryType: "term",
        entryId: "term_manual_override_new",
        relationshipType: "primary"
      });

      await setLinkedEntryStatusByCard({
        cardId: "card_a",
        database: localDatabase,
        now: new Date("2026-03-09T13:00:00.000Z"),
        status: "known_manual"
      });

      const [globalOverview, queue] = await Promise.all([
        loadGlobalReviewOverviewSnapshot(localDatabase),
        getReviewQueueSnapshotForMedia("media-a", localDatabase)
      ]);

      expect(globalOverview.newAvailableCount).toBe(0);
      expect(globalOverview.manualCount).toBe(1);
      expect(globalOverview.queueCount).toBe(0);
      expect(queue?.newAvailableCount).toBe(0);
      expect(queue?.manualCount).toBe(1);
      expect(queue?.queueCount).toBe(0);
      expect(queue?.cards).toHaveLength(0);
    } finally {
      closeDatabaseClient(localDatabase);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("counts only the completed representative card when a subject mixes suspended and incomplete siblings", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await database
      .update(card)
      .set({
        status: "suspended"
      })
      .where(eq(card.id, developmentFixture.primaryCardId));

    await database.insert(lesson).values({
      createdAt: "2026-03-10T09:00:00.000Z",
      difficulty: "beginner",
      id: "lesson_fixture_mixed_sibling",
      mediaId: developmentFixture.mediaId,
      orderIndex: 99,
      segmentId: developmentFixture.segmentId,
      slug: "mixed-sibling",
      sourceFile: "tests/fixtures/db/fixture-tcg/lessons/mixed-sibling.md",
      status: "active",
      summary: "Sibling lesson used for the mixed-review regression.",
      title: "Mixed Sibling",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(lessonProgress).values({
      completedAt: null,
      lastOpenedAt: "2026-03-10T09:00:00.000Z",
      lessonId: "lesson_fixture_mixed_sibling",
      startedAt: "2026-03-10T09:00:00.000Z",
      status: "in_progress"
    });
    await database.insert(card).values({
      back: "andare (sibling incompleto)",
      cardType: "recognition",
      createdAt: "2026-03-10T09:00:00.000Z",
      exampleIt: null,
      exampleJp: null,
      front: "行く sibling",
      id: "card_fixture_mixed_sibling",
      lessonId: "lesson_fixture_mixed_sibling",
      mediaId: developmentFixture.mediaId,
      notesIt: null,
      orderIndex: 99,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/mixed-sibling.md",
      status: "active",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      cardId: "card_fixture_mixed_sibling",
      entryId: developmentFixture.termDbId,
      entryType: "term",
      id: "card_entry_link_fixture_mixed_sibling_primary",
      relationshipType: "primary"
    });

    const [overview, queue] = await Promise.all([
      loadGlobalReviewOverviewSnapshot(database),
      getReviewQueueSnapshotForMedia(developmentFixture.mediaSlug, database)
    ]);

    expect(overview.activeCards).toBe(0);
    expect(overview.suspendedCount).toBe(1);
    expect(overview.queueCount).toBe(0);
    expect(queue?.cards).toHaveLength(0);
    expect(queue?.suspendedCount).toBe(1);
    expect(queue?.queueCount).toBe(0);
  });
});

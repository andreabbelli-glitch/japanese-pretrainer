import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaDetailPage } from "@/components/media/media-detail-page";
import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  segment,
  term,
  type DatabaseClient
} from "@/db";
import { buildScopedEntryId } from "@/lib/entry-id";
import { getGlossaryPageData } from "@/lib/glossary";
import { importContentWorkspace } from "@/lib/content/importer";
import { getMediaProgressPageData } from "@/lib/progress";
import { getReviewPageData } from "@/lib/review";
import { mediaKanjiClashHref } from "@/lib/site";
import { getStudySettings, updateStudySettings } from "@/lib/settings";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";

describe("progress, settings, and study controls", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-progress-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("builds a live progress page snapshot with real resume, glossary, and review signals", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    const data = await getMediaProgressPageData(
      developmentFixture.mediaSlug,
      database
    );

    expect(data).not.toBeNull();
    expect(data?.textbook.totalLessons).toBe(1);
    expect(data?.textbook.lastOpenedLesson?.slug).toBe("core-vocab");
    expect(data?.glossary.entriesCovered).toBe(2);
    expect(data?.glossary.breakdown.learning).toBe(1);
    expect(data?.glossary.breakdown.known).toBe(1);
    expect(data?.review.dueCount).toBe(1);
    expect(data?.resume.recommendedArea).toBe("review");
    expect(data?.resume.recommendedLabel).toBe("Apri review globale");
    expect(data?.resume.recommendedHref).toBe(
      "/review"
    );
  });

  it("reuses the resolved settings snapshot while building the media page", async () => {
    const settingsQuerySpy = vi.spyOn(database.query.userSetting, "findMany");

    const data = await getMediaProgressPageData(
      developmentFixture.mediaSlug,
      database
    );

    expect(data).not.toBeNull();
    expect(settingsQuerySpy).toHaveBeenCalledTimes(1);
    settingsQuerySpy.mockRestore();
  });

  it("recommends review when the queue has only new cards", async () => {
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

    await database.insert(card).values({
      id: "card_fixture_progress_new_only",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-only.md",
      cardType: "recognition",
      front: "新カード",
      back: "card nuova",
      notesIt: "Serve per verificare il resume verso review senza due card.",
      status: "active",
      orderIndex: 44,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_progress_new_only",
      cardId: "card_fixture_progress_new_only",
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "secondary"
    });

    const data = await getMediaProgressPageData(
      developmentFixture.mediaSlug,
      database
    );

    expect(data).not.toBeNull();
    expect(data?.review.dueCount).toBe(0);
    expect(data?.review.queueCount).toBe(0);
    expect(data?.review.newQueuedCount).toBe(0);
    expect(data?.resume.recommendedArea).toBe("textbook");
    expect(data?.resume.recommendedHref).toBe(
      `/media/${developmentFixture.mediaSlug}/textbook/core-vocab`
    );
  });

  it("keeps global review signals separate from the local media queue", async () => {
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

    await database.insert(media).values({
      id: "media_progress_global_review",
      slug: "global-review-fixture",
      title: "Global Review Fixture",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Media secondario per verificare la review globale.",
      status: "active",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(lesson).values({
      id: "lesson_progress_global_review",
      mediaId: "media_progress_global_review",
      segmentId: null,
      slug: "global-review",
      title: "Global Review Lesson",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson per la review globale.",
      status: "active",
      sourceFile: "tests/fixtures/db/progress/global-review-fixture.md",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(lessonProgress).values({
      lessonId: "lesson_progress_global_review",
      status: "completed",
      completedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card_progress_global_due",
      mediaId: "media_progress_global_review",
      lessonId: "lesson_progress_global_review",
      segmentId: null,
      sourceFile: "tests/fixtures/db/progress/global-review-fixture.md",
      cardType: "recognition",
      front: "共有レビュー",
      back: "review globale",
      notesIt: "Card dovuta in un media diverso.",
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: "card:card_progress_global_due",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "card_progress_global_due",
      state: "review",
      stability: 3,
      difficulty: 2.5,
      dueAt: "2000-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-09T10:00:00.000Z",
      lastInteractionAt: "2026-03-09T10:00:00.000Z",
      scheduledDays: 3,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });

    const data = await getMediaProgressPageData(
      developmentFixture.mediaSlug,
      database
    );

    expect(data).not.toBeNull();
    expect(data?.review.dueCount).toBe(0);
    expect(data?.globalReview.dueCount).toBe(1);
    expect(data?.resume.recommendedArea).toBe("review");
    expect(data?.resume.recommendedHref).toBe("/review");

    const markup = renderToStaticMarkup(
      createElement(MediaDetailPage, { data: data! })
    );

    expect(markup).toContain("Review globale");
    expect(markup).toContain("Review del media");
    expect(markup).toContain(
      `href="${mediaKanjiClashHref(developmentFixture.mediaSlug)}"`
    );
    expect(markup).toContain("Coda locale e carico quotidiano");
  });

  it("keeps the local next review card front aligned with the visible media in cross-media groups", async () => {
    const contentRoot = path.join(tempDir, "cross-media-progress-content");

    await writeCrossMediaContentFixture(contentRoot);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(importResult.status).toBe("completed");

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
      .update(card)
      .set({
        front: "コストB"
      })
      .where(eq(card.id, crossMediaFixture.beta.termCardId));

    const sharedSubjectState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.cardId, crossMediaFixture.alpha.termCardId)
    });

    expect(sharedSubjectState).not.toBeNull();

    await database
      .update(reviewSubjectState)
      .set({
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
        suspended: false
      })
      .where(eq(reviewSubjectState.subjectKey, sharedSubjectState!.subjectKey));

    const data = await getMediaProgressPageData(
      crossMediaFixture.beta.mediaSlug,
      database
    );

    expect(data).not.toBeNull();
    expect(data?.review.dueCount).toBe(1);
    expect(data?.review.nextCardFront).toBe("コストB");
    expect(data?.globalReview.nextCardFront).toBe("コスト");
  });

  it("persists settings and applies them to glossary ordering and review queue limits", async () => {
    await database.insert(segment).values({
      id: "segment_demo_bonus",
      mediaId: developmentFixture.mediaId,
      slug: "bonus",
      title: "Bonus",
      orderIndex: 2,
      segmentType: "episode",
      notes: "Segmento aggiuntivo per verificare l’ordinamento."
    });
    await database.insert(term).values({
      id: buildScopedEntryId(
        "term",
        developmentFixture.mediaId,
        "term-demo-aisatsu"
      ),
      sourceId: "term-demo-aisatsu",
      mediaId: developmentFixture.mediaId,
      segmentId: "segment_demo_bonus",
      lemma: "あいさつ",
      reading: "あいさつ",
      romaji: "aisatsu",
      pos: "sostantivo",
      meaningIt: "saluto",
      meaningLiteralIt: null,
      notesIt: "Voce aggiuntiva per testare il sort persistente.",
      levelHint: null,
      searchLemmaNorm: "あいさつ",
      searchReadingNorm: "あいさつ",
      searchRomajiNorm: "aisatsu",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );
    await database.insert(card).values({
      id: "card_fixture_new_limit",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-limit.md",
      cardType: "recognition",
      front: "行きます",
      back: "andare (forma educata)",
      notesIt: "Nuova card per verificare il daily limit.",
      status: "active",
      orderIndex: 9,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_new_limit",
      cardId: "card_fixture_new_limit",
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "secondary"
    });

    const defaultGlossaryData = await getGlossaryPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "alphabetical",
        reviewFrontFurigana: false,
        reviewDailyLimit: 1
      },
      database
    );

    const [settings, glossaryData, reviewData] = await Promise.all([
      getStudySettings(database),
      getGlossaryPageData(developmentFixture.mediaSlug, {}, database),
      getReviewPageData(developmentFixture.mediaSlug, {}, database)
    ]);

    expect(settings).toMatchObject({
      furiganaMode: "on",
      glossaryDefaultSort: "alphabetical",
      reviewFrontFurigana: false,
      reviewDailyLimit: 1
    });
    expect(glossaryData?.filters.sort).toBe("alphabetical");
    expect(
      defaultGlossaryData?.results.findIndex(
        (entry) => entry.id === "term-demo-aisatsu"
      )
    ).toBeGreaterThan(
      defaultGlossaryData?.results.findIndex(
        (entry) => entry.id === developmentFixture.termId
      ) ?? -1
    );
    expect(
      glossaryData?.results.findIndex(
        (entry) => entry.id === "term-demo-aisatsu"
      )
    ).toBeLessThan(
      glossaryData?.results.findIndex(
        (entry) => entry.id === developmentFixture.termId
      ) ?? 999
    );
    expect(reviewData?.queue.dailyLimit).toBe(1);
    expect(reviewData?.queue.newAvailableCount).toBe(0);
    expect(reviewData?.queue.newQueuedCount).toBe(0);
    expect(reviewData?.settings.reviewFrontFurigana).toBe(false);
  });
});

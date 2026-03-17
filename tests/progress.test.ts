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
  lessonProgress,
  reviewState,
  runMigrations,
  seedDevelopmentDatabase,
  segment,
  term,
  type DatabaseClient
} from "@/db";
import { buildScopedEntryId } from "@/lib/entry-id";
import { getGlossaryPageData } from "@/lib/glossary";
import { getMediaProgressPageData } from "@/lib/progress";
import { getReviewPageData } from "@/lib/review";
import { getStudySettings, updateStudySettings } from "@/lib/settings";

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
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

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
    expect(data?.resume.recommendedHref).toBe(
      `/media/${developmentFixture.mediaSlug}/review`
    );
  });

  it("recommends review when the queue has only new cards", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database.insert(card).values({
      id: "card_fixture_progress_new_only",
      mediaId: developmentFixture.mediaId,
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
    expect(data?.review.queueCount).toBe(1);
    expect(data?.review.newQueuedCount).toBe(1);
    expect(data?.resume.recommendedArea).toBe("review");
    expect(data?.resume.recommendedHref).toBe(
      `/media/${developmentFixture.mediaSlug}/review`
    );
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
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));
    await database.insert(card).values({
      id: "card_fixture_new_limit",
      mediaId: developmentFixture.mediaId,
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
        reviewDailyLimit: 1
      },
      database
    );

    const [settings, glossaryData, reviewData] = await Promise.all([
      getStudySettings(database),
      getGlossaryPageData(developmentFixture.mediaSlug, {}, database),
      getReviewPageData(developmentFixture.mediaSlug, {}, database)
    ]);

    expect(settings).toEqual({
      furiganaMode: "on",
      glossaryDefaultSort: "alphabetical",
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
    expect(reviewData?.queue.newAvailableCount).toBe(1);
    expect(reviewData?.queue.newQueuedCount).toBe(1);
  });
});

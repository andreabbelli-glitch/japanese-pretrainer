import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  getLessonBySlug,
  getMediaBySlug,
  listCardsByMediaId,
  listDueCardsByMediaId,
  listGrammarEntriesByMediaId,
  listGrammarEntryReviewSummaries,
  listLessonsByMediaId,
  listMedia,
  listTermEntriesByMediaId,
  listTermEntryReviewSummaries,
  reviewState,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";

describe("database layer", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-db-"));
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

  it("creates readable media with aggregated progress", async () => {
    const rows = await listMedia(database);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe(developmentFixture.mediaSlug);
    expect(rows[0]?.progress?.cardsDue).toBe(1);

    const media = await getMediaBySlug(database, developmentFixture.mediaSlug);

    expect(media?.id).toBe(developmentFixture.mediaId);
    expect(media?.progress?.entriesKnown).toBe(1);
  });

  it("returns lesson metadata and full lesson content", async () => {
    const lessons = await listLessonsByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.content?.excerpt).toContain("voce lessicale");
    expect(lessons[0]?.progress?.status).toBe("in_progress");

    const lesson = await getLessonBySlug(
      database,
      developmentFixture.mediaId,
      "core-vocab"
    );

    expect(lesson?.content?.markdownRaw).toContain("行く");
    expect(lesson?.segment?.slug).toBe("starter-core");
  });

  it("keeps entry_status separate from canonical glossary entries", async () => {
    const terms = await listTermEntriesByMediaId(
      database,
      developmentFixture.mediaId
    );
    const grammar = await listGrammarEntriesByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(terms).toHaveLength(1);
    expect(terms[0]?.aliases).toHaveLength(2);
    expect(terms[0]?.status?.status).toBe("learning");

    expect(grammar).toHaveLength(1);
    expect(grammar[0]?.aliases[0]?.aliasNorm).toBe("てる");
    expect(grammar[0]?.status?.status).toBe("known_manual");
  });

  it("returns lighter review summaries without glossary-only search metadata", async () => {
    const [terms, grammar] = await Promise.all([
      listTermEntryReviewSummaries(database, {
        mediaId: developmentFixture.mediaId
      }),
      listGrammarEntryReviewSummaries(database, {
        mediaId: developmentFixture.mediaId
      })
    ]);

    expect(terms).toHaveLength(1);
    expect(terms[0]).toHaveProperty("audioSrc");
    expect(terms[0]).toHaveProperty("pitchAccent");
    expect(terms[0]).toHaveProperty("mediaSlug", developmentFixture.mediaSlug);
    expect(terms[0]).toHaveProperty("entryStatus", "learning");
    expect(terms[0]).not.toHaveProperty("levelHint");
    expect(terms[0]).not.toHaveProperty("searchLemmaNorm");
    expect(terms[0]).not.toHaveProperty("searchReadingNorm");
    expect(terms[0]).not.toHaveProperty("searchRomajiNorm");

    expect(grammar).toHaveLength(1);
    expect(grammar[0]).toHaveProperty("audioSrc");
    expect(grammar[0]).toHaveProperty("pitchAccent");
    expect(grammar[0]).toHaveProperty("mediaSlug", developmentFixture.mediaSlug);
    expect(grammar[0]).toHaveProperty("entryStatus", "known_manual");
    expect(grammar[0]).not.toHaveProperty("levelHint");
    expect(grammar[0]).not.toHaveProperty("searchPatternNorm");
  });

  it("returns cards with review state and due filtering", async () => {
    const cards = await listCardsByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]?.reviewState?.state).toBe("learning");
    expect(cards[1]?.reviewState?.state).toBe("review");

    const dueCards = await listDueCardsByMediaId(
      database,
      developmentFixture.mediaId,
      "2026-03-10T00:00:00.000Z"
    );

    expect(dueCards).toHaveLength(1);
    expect(dueCards[0]?.id).toBe(developmentFixture.primaryCardId);
    expect(dueCards[0]?.reviewState.state).toBe("learning");
  });

  it("excludes known_manual cards from the due queue", async () => {
    await database
      .update(reviewState)
      .set({
        state: "known_manual",
        dueAt: "2026-03-01T00:00:00.000Z",
        manualOverride: true
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    const dueCards = await listDueCardsByMediaId(
      database,
      developmentFixture.mediaId,
      "2026-03-10T00:00:00.000Z"
    );

    expect(dueCards).toHaveLength(0);
  });

  it("applies the development seed idempotently", async () => {
    await seedDevelopmentDatabase(database);

    const cards = await listCardsByMediaId(
      database,
      developmentFixture.mediaId
    );
    const terms = await listTermEntriesByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(cards).toHaveLength(2);
    expect(terms).toHaveLength(1);
  });
});

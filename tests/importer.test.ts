import path from "node:path";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  entryStatus,
  lessonProgress,
  listCardsByMediaId,
  reviewLog,
  reviewState,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  card,
  cardEntryLink,
  contentImport,
  grammarPattern,
  lesson,
  media,
  segment,
  term
} from "@/db/schema/index.ts";
import { importContentWorkspace } from "@/lib/content/importer.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repositoryRoot = path.resolve(__dirname, "..");
const fixturesRoot = path.resolve(
  __dirname,
  "fixtures",
  "content"
);
const validContentRoot = path.join(fixturesRoot, "valid", "content");
const invalidContentRoot = path.join(fixturesRoot, "invalid", "content");
const demoMediaFixtureRoot = path.join(repositoryRoot, "content", "media", "duel-masters-dm25");
const mediaId = "media-frieren";
const lessonId = "lesson-frieren-ep01-intro";
const termId = "term-taberu";
const termCardId = "card-taberu-recognition";
const grammarCardId = "card-teiru-concept";
const scopedMediaId = "media-dungeon-meshi";
const scopedLessonId = "lesson-dungeon-meshi-ep01-intro";
const scopedCardId = "card-laios-recognition";
const scopedTermId = "term-laios";

describe("content importer", () => {
  let tempDir = "";
  let contentRoot = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-importer-"));
    contentRoot = path.join(tempDir, "content");
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("imports validated markdown into normalized database tables", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(result.filesScanned).toBe(3);
    expect(result.filesChanged).toBe(3);

    expect(await countRows(database.query.media.findMany())).toBe(1);
    expect(await countRows(database.query.segment.findMany())).toBe(1);
    expect(await countRows(database.query.lesson.findMany())).toBe(1);
    expect(await countRows(database.query.lessonContent.findMany())).toBe(1);
    expect(await countRows(database.query.term.findMany())).toBe(1);
    expect(await countRows(database.query.termAlias.findMany())).toBe(2);
    expect(await countRows(database.query.grammarPattern.findMany())).toBe(1);
    expect(await countRows(database.query.grammarAlias.findMany())).toBe(1);
    expect(await countRows(database.query.entryLink.findMany())).toBe(6);
    expect(await countRows(database.query.card.findMany())).toBe(2);
    expect(await countRows(database.query.cardEntryLink.findMany())).toBe(2);
    expect(await countRows(database.query.contentImport.findMany())).toBe(1);

    const importedLesson = await database.query.lesson.findFirst({
      where: eq(lesson.id, lessonId),
      with: {
        content: true
      }
    });
    const importedSegment = await database.query.segment.findFirst({
      where: eq(segment.mediaId, mediaId)
    });
    const importRow = await database.query.contentImport.findFirst({
      where: eq(contentImport.id, result.importId)
    });

    expect(importedSegment?.slug).toBe("episode-01");
    expect(importedLesson?.sourceFile).toBe("media/frieren/textbook/001-intro.md");
    expect(importedLesson?.content?.htmlRendered).toContain("<ruby>");
    expect(importedLesson?.content?.htmlRendered).toContain("grammar-definition");
    expect(importRow?.status).toBe("completed");
  });

  it("imports the real Duel Masters demo bundle", async () => {
    await copySingleMediaBundleFixture(demoMediaFixtureRoot, contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-10T09:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(result.filesScanned).toBe(4);
    expect(result.filesChanged).toBe(4);

    expect(await countRows(database.query.media.findMany())).toBe(1);
    expect(await countRows(database.query.segment.findMany())).toBe(1);
    expect(await countRows(database.query.lesson.findMany())).toBe(2);
    expect(await countRows(database.query.lessonContent.findMany())).toBe(2);
    expect(await countRows(database.query.term.findMany())).toBe(40);
    expect(await countRows(database.query.termAlias.findMany())).toBe(107);
    expect(await countRows(database.query.grammarPattern.findMany())).toBe(11);
    expect(await countRows(database.query.grammarAlias.findMany())).toBe(15);
    expect(await countRows(database.query.entryLink.findMany())).toBe(146);
    expect(await countRows(database.query.card.findMany())).toBe(51);
    expect(await countRows(database.query.cardEntryLink.findMany())).toBe(69);
    expect(await countRows(database.query.contentImport.findMany())).toBe(1);

    const importedMedia = await database.query.media.findFirst({
      where: eq(media.id, "media-duel-masters-dm25")
    });
    const importedLesson = await database.query.lesson.findFirst({
      where: eq(lesson.id, "lesson-duel-masters-dm25-tcg-core-overview"),
      with: {
        content: true
      }
    });
    const importedTerm = await database.query.term.findFirst({
      where: eq(term.id, "term-invasion")
    });
    const importedGrammar = await database.query.grammarPattern.findFirst({
      where: eq(grammarPattern.id, "grammar-kawarini")
    });
    const importedCard = await database.query.card.findFirst({
      where: eq(card.id, "card-invasion-recognition")
    });
    const importedCardLink = await database.query.cardEntryLink.findFirst({
      where: eq(cardEntryLink.cardId, "card-invasion-recognition")
    });

    expect(importedMedia?.slug).toBe("duel-masters-dm25");
    expect(importedLesson?.sourceFile).toBe(
      "media/duel-masters-dm25/textbook/001-tcg-core-overview.md"
    );
    expect(importedLesson?.content?.htmlRendered).toContain("<ruby>");
    expect(importedTerm?.lemma).toBe("侵略");
    expect(importedGrammar?.pattern).toBe("かわりに");
    expect(importedCard?.front).toBe("侵略");
    expect(importedCardLink?.entryId).toBe("term-invasion");
  });

  it("reimports the same content idempotently without duplicating rows or wiping user state", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });
    await seedUserState(database);

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T11:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(result.filesChanged).toBe(0);

    expect(await countRows(database.query.media.findMany())).toBe(1);
    expect(await countRows(database.query.lesson.findMany())).toBe(1);
    expect(await countRows(database.query.term.findMany())).toBe(1);
    expect(await countRows(database.query.grammarPattern.findMany())).toBe(1);
    expect(await countRows(database.query.card.findMany())).toBe(2);
    expect(await countRows(database.query.entryLink.findMany())).toBe(6);
    expect(await countRows(database.query.cardEntryLink.findMany())).toBe(2);
    expect(await countRows(database.query.contentImport.findMany())).toBe(2);

    const persistedReviewState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, termCardId)
    });
    const persistedReviewLog = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, termCardId)
    });
    const persistedEntryStatus = await database.query.entryStatus.findFirst({
      where: eq(entryStatus.entryId, termId)
    });
    const persistedLessonProgress = await database.query.lessonProgress.findFirst({
      where: eq(lessonProgress.lessonId, lessonId)
    });

    expect(persistedReviewState?.state).toBe("learning");
    expect(persistedReviewLog).toHaveLength(1);
    expect(persistedEntryStatus?.status).toBe("known_manual");
    expect(persistedLessonProgress?.status).toBe("in_progress");
  });

  it("updates imported content on reimport while preserving existing user state", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });
    await seedUserState(database);

    const cardsPath = path.join(contentRoot, "media", "frieren", "cards", "001-core.md");
    const cardsSource = await readFile(cardsPath, "utf8");

    await writeFile(
      cardsPath,
      cardsSource
        .replace("meaning_it: mangiare", "meaning_it: assumere cibo")
        .replace("back: mangiare", "back: assumere cibo")
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T12:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(result.filesChanged).toBe(1);

    const importedTerm = await database.query.term.findFirst({
      where: eq(term.id, termId)
    });
    const importedCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const persistedReviewState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, termCardId)
    });

    expect(importedTerm?.meaningIt).toBe("assumere cibo");
    expect(importedCard?.back).toBe("assumere cibo");
    expect(persistedReviewState?.state).toBe("learning");
  });

  it("archives removed lessons or cards and prunes removed entries without deleting user-owned state", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });
    await seedUserState(database);

    const lessonPath = path.join(
      contentRoot,
      "media",
      "frieren",
      "textbook",
      "001-intro.md"
    );
    const lessonSource = await readFile(lessonPath, "utf8");
    const cardsPath = path.join(contentRoot, "media", "frieren", "cards", "001-core.md");

    await writeFile(
      lessonPath,
      lessonSource.replace(
        "In questa lezione vediamo [食べる](term:term-taberu) e la forma\n[～ている](grammar:grammar-teiru).",
        "In questa lezione vediamo solo la forma [～ている](grammar:grammar-teiru)."
      )
    );
    await writeFile(
      cardsPath,
      `---
id: cards-frieren-ep01
media_id: media-frieren
slug: ep01-core
title: Episodio 1 - Core cards
order: 10
segment_ref: episode-01
---

:::card
id: card-teiru-concept
entry_type: grammar
entry_id: grammar-teiru
card_type: concept
front: ～ている
back: azione in corso / stato risultante
notes_it: "Si collega a [～ている](grammar:grammar-teiru)."
tags: [grammar, core]
:::
`
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T13:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("Expected import to complete.");
    }
    expect(result.summary.archivedCardIds).toContain(termCardId);
    expect(result.summary.prunedTermIds).toContain(termId);

    const archivedCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const missingTerm = await database.query.term.findFirst({
      where: eq(term.id, termId)
    });
    const persistedReviewState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, termCardId)
    });
    const persistedReviewLog = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, termCardId)
    });
    const persistedEntryStatus = await database.query.entryStatus.findFirst({
      where: eq(entryStatus.entryId, termId)
    });
    const activeCards = await listCardsByMediaId(database, mediaId);

    expect(archivedCard?.status).toBe("archived");
    expect(missingTerm).toBeUndefined();
    expect(persistedReviewState?.state).toBe("learning");
    expect(persistedReviewLog).toHaveLength(1);
    expect(persistedEntryStatus?.status).toBe("known_manual");
    expect(activeCards.map((entry) => entry.id)).toEqual([grammarCardId]);
  });

  it("prunes stale segments when no imported content references them anymore", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    const lessonPath = path.join(
      contentRoot,
      "media",
      "frieren",
      "textbook",
      "001-intro.md"
    );
    const cardsPath = path.join(contentRoot, "media", "frieren", "cards", "001-core.md");

    await writeFile(
      lessonPath,
      (await readFile(lessonPath, "utf8")).replace("segment_ref: episode-01\n", "")
    );
    await writeFile(
      cardsPath,
      (await readFile(cardsPath, "utf8")).replace("segment_ref: episode-01\n", "")
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T14:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(await countRows(database.query.segment.findMany())).toBe(0);

    const importedLesson = await database.query.lesson.findFirst({
      where: eq(lesson.id, lessonId)
    });
    const importedTerm = await database.query.term.findFirst({
      where: eq(term.id, termId)
    });
    const importedGrammar = await database.query.grammarPattern.findFirst({
      where: eq(grammarPattern.id, "grammar-teiru")
    });
    const importedTermCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const importedGrammarCard = await database.query.card.findFirst({
      where: eq(card.id, grammarCardId)
    });

    expect(importedLesson?.segmentId).toBeNull();
    expect(importedTerm?.segmentId).toBeNull();
    expect(importedGrammar?.segmentId).toBeNull();
    expect(importedTermCard?.segmentId).toBeNull();
    expect(importedGrammarCard?.segmentId).toBeNull();
  });

  it("supports incremental media-scoped imports without archiving out-of-scope media", async () => {
    await copyContentFixture(validContentRoot, contentRoot);
    await writeScopedMediaFixture(contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    const frierenCardsPath = path.join(
      contentRoot,
      "media",
      "frieren",
      "cards",
      "001-core.md"
    );

    await writeFile(
      frierenCardsPath,
      (await readFile(frierenCardsPath, "utf8"))
        .replace("meaning_it: mangiare", "meaning_it: nutrirsi")
        .replace("back: mangiare", "back: nutrirsi")
    );
    await rm(path.join(contentRoot, "media", "dungeon-meshi"), {
      recursive: true,
      force: true
    });

    const result = await importContentWorkspace({
      contentRoot,
      database,
      mediaSlugs: ["frieren"],
      now: new Date("2026-03-09T15:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected a completed import result");
    }
    expect(result.filesChanged).toBe(1);
    expect(result.summary.archivedMediaIds).toEqual([]);
    expect(result.summary.archivedLessonIds).toEqual([]);
    expect(result.summary.archivedCardIds).toEqual([]);
    expect(result.summary.prunedTermIds).toEqual([]);
    expect(result.summary.prunedGrammarIds).toEqual([]);

    const updatedFrierenTerm = await database.query.term.findFirst({
      where: eq(term.id, termId)
    });
    const updatedFrierenCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const preservedScopedMedia = await database.query.media.findFirst({
      where: eq(media.id, scopedMediaId)
    });
    const preservedScopedLesson = await database.query.lesson.findFirst({
      where: eq(lesson.id, scopedLessonId)
    });
    const preservedScopedCard = await database.query.card.findFirst({
      where: eq(card.id, scopedCardId)
    });
    const preservedScopedTerm = await database.query.term.findFirst({
      where: eq(term.id, scopedTermId)
    });

    expect(updatedFrierenTerm?.meaningIt).toBe("nutrirsi");
    expect(updatedFrierenCard?.back).toBe("nutrirsi");
    expect(preservedScopedMedia?.status).toBe("active");
    expect(preservedScopedLesson?.status).toBe("active");
    expect(preservedScopedCard?.status).toBe("active");
    expect(preservedScopedTerm?.lemma).toBe("ライオス");
  });

  it("fails cleanly on invalid content without partially mutating imported tables", async () => {
    const result = await importContentWorkspace({
      contentRoot: invalidContentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    expect(result.status).toBe("failed");
    expect(result.issues.length).toBeGreaterThan(0);

    expect(await countRows(database.query.media.findMany())).toBe(0);
    expect(await countRows(database.query.lesson.findMany())).toBe(0);
    expect(await countRows(database.query.term.findMany())).toBe(0);
    expect(await countRows(database.query.card.findMany())).toBe(0);

    const failedImport = await database.query.contentImport.findFirst({
      where: eq(contentImport.id, result.importId)
    });

    expect(failedImport?.status).toBe("failed");
  });
});

async function copyContentFixture(sourceRoot: string, destinationRoot: string) {
  await cp(sourceRoot, destinationRoot, { recursive: true });
}

async function copySingleMediaBundleFixture(
  sourceMediaDirectory: string,
  destinationContentRoot: string
) {
  const destinationMediaRoot = path.join(destinationContentRoot, "media");

  await mkdir(destinationMediaRoot, { recursive: true });
  await cp(
    sourceMediaDirectory,
    path.join(destinationMediaRoot, path.basename(sourceMediaDirectory)),
    { recursive: true }
  );
}

async function writeScopedMediaFixture(destinationRoot: string) {
  const mediaRoot = path.join(destinationRoot, "media", "dungeon-meshi");
  const textbookRoot = path.join(mediaRoot, "textbook");
  const cardsRoot = path.join(mediaRoot, "cards");

  await mkdir(textbookRoot, { recursive: true });
  await mkdir(cardsRoot, { recursive: true });

  await writeFile(
    path.join(mediaRoot, "media.md"),
    `---
id: ${scopedMediaId}
slug: dungeon-meshi
title: Dungeon Meshi
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
status: active
---

# Dungeon Meshi

Pacchetto secondario per testare lo scope incrementale.
`
  );
  await writeFile(
    path.join(textbookRoot, "001-intro.md"),
    `---
id: ${scopedLessonId}
media_id: ${scopedMediaId}
slug: ep01-intro
title: Episodio 1 - Introduzione
order: 10
segment_ref: episode-01
difficulty: n5
status: active
---

# Obiettivo

Qui introduciamo [ライオス](term:${scopedTermId}).
`
  );
  await writeFile(
    path.join(cardsRoot, "001-core.md"),
    `---
id: cards-dungeon-meshi-ep01
media_id: ${scopedMediaId}
slug: ep01-core
title: Episodio 1 - Core cards
order: 10
segment_ref: episode-01
---

:::term
id: ${scopedTermId}
lemma: ライオス
reading: らいおす
romaji: raiosu
meaning_it: Laios
aliases: [raiosu]
:::

:::card
id: ${scopedCardId}
entry_type: term
entry_id: ${scopedTermId}
card_type: recognition
front: ライオス
back: Laios
tags: [character]
:::
`
  );
}

async function seedUserState(database: DatabaseClient) {
  await database.insert(entryStatus).values({
    id: "entry_status_term_taberu",
    entryType: "term",
    entryId: termId,
    status: "known_manual",
    reason: "Existing manual override",
    setAt: "2026-03-09T09:45:00.000Z"
  });
  await database.insert(reviewState).values({
    cardId: termCardId,
    state: "learning",
    stability: 1.7,
    difficulty: 4.1,
    dueAt: "2026-03-10T09:00:00.000Z",
    lastReviewedAt: "2026-03-09T09:30:00.000Z",
    lapses: 1,
    reps: 3,
    manualOverride: false,
    createdAt: "2026-03-09T09:00:00.000Z",
    updatedAt: "2026-03-09T09:30:00.000Z"
  });
  await database.insert(reviewLog).values({
    id: "review_log_term_taberu",
    cardId: termCardId,
    answeredAt: "2026-03-09T09:30:00.000Z",
    rating: "good",
    previousState: "new",
    newState: "learning",
    scheduledDueAt: "2026-03-10T09:00:00.000Z",
    elapsedDays: 0.25,
    responseMs: 2100
  });
  await database.insert(lessonProgress).values({
    lessonId,
    status: "in_progress",
    startedAt: "2026-03-09T09:05:00.000Z",
    completedAt: null,
    lastOpenedAt: "2026-03-09T09:35:00.000Z"
  });
}

async function countRows<T>(promise: Promise<T[]>) {
  return (await promise).length;
}

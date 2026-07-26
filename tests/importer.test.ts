import path from "node:path";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { listCardsByMediaId } from "@/db/queries";
import { runMigrations } from "@/db/migrate";
import {
  card,
  cardEntryLink,
  contentImport,
  grammarPattern,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  segment,
  term
} from "@/db/schema/index.ts";
import { importContentWorkspace } from "@/features/content/importer.ts";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
import { buildScopedEntryId } from "@/features/study/model/entry-id";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import {
  richContentFixture,
  writeRichContentFixture
} from "./helpers/content-fixtures";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");
const invalidContentRoot = path.join(fixturesRoot, "invalid", "content");
const mediaId = "media-sample-anime";
const lessonId = "lesson-sample-anime-ep01-intro";
const termId = "term-taberu";
const termDbId = buildScopedEntryId("term", mediaId, termId);
const grammarId = "grammar-teiru";
const grammarDbId = buildScopedEntryId("grammar", mediaId, grammarId);
const termCardId = "card-taberu-recognition";
const grammarCardId = "card-teiru-concept";
const scopedMediaId = "media-dungeon-meshi";
const scopedLessonId = "lesson-dungeon-meshi-ep01-intro";
const scopedCardId = "card-laios-recognition";
const scopedTermId = "term-laios";
const scopedTermDbId = buildScopedEntryId("term", scopedMediaId, scopedTermId);
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
  }, 60_000);

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  }, 60_000);

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
    expect(await countRows(database.query.reviewSubjectState.findMany())).toBe(
      2
    );
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
    const importedCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const importedTerm = await database.query.term.findFirst({
      where: eq(term.id, termDbId)
    });
    const importedGrammar = await database.query.grammarPattern.findFirst({
      where: eq(grammarPattern.id, grammarDbId)
    });

    expect(importedSegment?.slug).toBe("episode-01");
    expect(importedLesson?.sourceFile).toBe(
      "media/sample-anime/textbook/001-intro.md"
    );
    expect(importedLesson?.content?.htmlRendered).toContain("<ruby>");
    expect(importedLesson?.content?.htmlRendered).toContain(
      "/media/sample-anime/assets/episode-01/sample-anime-meal.svg"
    );
    expect(importedLesson?.content?.htmlRendered).toContain(
      "grammar-definition"
    );
    expect(importedLesson?.content?.astJson).toContain('"type":"image"');
    expect(importRow?.status).toBe("completed");
    expect(importedCard?.exampleJp).toBe("パンを{{食|た}}べる。");
    expect(importedCard?.exampleIt).toBe("Mangio il pane.");
    expect(importedTerm?.audioSrc).toBe(
      "assets/audio/term/term-taberu/term-taberu.ogg"
    );
    expect(importedTerm?.audioSource).toBe("forvo");
    expect(importedGrammar?.audioSrc).toBe(
      "assets/audio/grammar/grammar-teiru/grammar-teiru.mp3"
    );
    expect(importedGrammar?.audioLicense).toBe("Forvo terms");
    expect(importedGrammar?.searchRomajiNorm).toBe("teiru");
  }, 60_000);

  it("imports a rich synthetic bundle into normalized database tables", async () => {
    await writeRichContentFixture(contentRoot);
    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-10T09:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(result.filesScanned).toBe(5);
    expect(result.filesChanged).toBe(5);

    expect(await countRows(database.query.media.findMany())).toBe(1);
    expect(await countRows(database.query.segment.findMany())).toBe(1);
    expect(await countRows(database.query.lesson.findMany())).toBe(2);
    expect(await countRows(database.query.lessonContent.findMany())).toBe(2);
    expect(await countRows(database.query.term.findMany())).toBe(2);
    expect(await countRows(database.query.grammarPattern.findMany())).toBe(2);
    expect(await countRows(database.query.card.findMany())).toBe(4);
    expect(await countRows(database.query.cardEntryLink.findMany())).toBe(6);
    expect(await countRows(database.query.contentImport.findMany())).toBe(1);

    const importedMedia = await database.query.media.findFirst({
      where: eq(media.id, richContentFixture.mediaId)
    });
    const importedSegment = await database.query.segment.findFirst({
      where: eq(segment.slug, richContentFixture.segmentSlug)
    });
    const importedLesson = await database.query.lesson.findFirst({
      where: eq(lesson.id, richContentFixture.lessonIntroId),
      with: {
        content: true
      }
    });
    const importedTerm = await database.query.term.findFirst({
      where: eq(term.sourceId, richContentFixture.termPrimaryId)
    });
    const importedGrammar = await database.query.grammarPattern.findFirst({
      where: eq(grammarPattern.sourceId, richContentFixture.grammarPrimaryId)
    });
    const importedCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termPrimaryCardId)
    });
    const importedCardLink = await database.query.cardEntryLink.findFirst({
      where: eq(cardEntryLink.cardId, richContentFixture.termPrimaryCardId)
    });

    expect(importedMedia?.slug).toBe(richContentFixture.mediaSlug);
    expect(importedMedia?.title).toBe(richContentFixture.mediaTitle);
    expect(importedSegment?.slug).toBe(richContentFixture.segmentSlug);
    expect(importedSegment?.mediaId).toBe(richContentFixture.mediaId);
    expect(importedLesson?.sourceFile).toBe(
      `media/${richContentFixture.mediaSlug}/textbook/001-intro.md`
    );
    expect(importedLesson?.content?.htmlRendered).toContain("<ruby>");
    expect(importedLesson?.content?.astJson).toContain('"type":"image"');
    expect(importedTerm?.lemma).toBe("明かり");
    expect(importedTerm?.audioSrc).toBe(richContentFixture.termAudioSrc);
    expect(importedGrammar?.pattern).toBe("～ている");
    expect(importedGrammar?.reading).toBe("ている");
    expect(importedGrammar?.audioSrc).toBe(richContentFixture.grammarAudioSrc);
    expect(importedCard?.front).toBe("{{明|あ}}かり");
    expect(importedCard?.exampleJp).toBe("{{明|あ}}かりがついている。");
    expect(importedCard?.exampleIt).toBe("La luce e accesa.");
    expect(importedCardLink?.entryId).toBe(
      buildScopedEntryId(
        "term",
        richContentFixture.mediaId,
        richContentFixture.termPrimaryId
      )
    );
  }, 60_000);

  it("deduplicates grammar aliases after search normalization", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    const lessonPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "textbook",
      "001-intro.md"
    );
    const lessonSource = await readFile(lessonPath, "utf8");

    await writeFile(
      lessonPath,
      lessonSource.replace("aliases: [てる]", "aliases: [～てる, てる, 〜てる]")
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");

    const grammarAliases = await database.query.grammarAlias.findMany();

    expect(grammarAliases).toHaveLength(1);
    expect(grammarAliases[0]).toMatchObject({
      aliasNorm: "てる",
      grammarId: grammarDbId
    });
  }, 60_000);

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

    const persistedTerm = await database.query.term.findFirst({
      where: eq(term.id, termDbId)
    });
    expect(persistedTerm?.crossMediaGroupId).toBeTruthy();
    const canonicalSubjectKey = `group:term:${persistedTerm?.crossMediaGroupId}`;
    const memoryKey = buildReviewMemoryKey({
      canonicalSubjectKey,
      cardId: termCardId,
      recallTask: "recognition"
    });
    const persistedReviewState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, memoryKey)
      });
    const legacyReviewState = await database.query.reviewSubjectState.findFirst(
      {
        where: eq(reviewSubjectState.subjectKey, `entry:term:${termDbId}`)
      }
    );
    const persistedReviewLog = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.id, "review_subject_log_term_taberu")
    });
    const persistedLessonProgress =
      await database.query.lessonProgress.findFirst({
        where: eq(lessonProgress.lessonId, lessonId)
      });

    expect(persistedReviewState?.state).toBe("learning");
    expect(persistedReviewState?.manualOverride).toBe(true);
    expect(legacyReviewState).toBeUndefined();
    expect(persistedReviewLog).toHaveLength(1);
    expect(persistedReviewLog[0]?.subjectKey).toBe(`entry:term:${termDbId}`);
    expect(persistedLessonProgress?.status).toBe("in_progress");
  }, 60_000);

  it("counts a segment_ref-only cards file change once", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    const cardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );

    await writeFile(
      cardsPath,
      (await readFile(cardsPath, "utf8")).replace(
        "segment_ref: episode-01",
        "segment_ref: episode-02"
      )
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T11:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    expect(result.filesChanged).toBe(1);

    const importedSegments = await database.query.segment.findMany({
      where: eq(segment.mediaId, mediaId)
    });

    expect(importedSegments.map((row) => row.slug).sort()).toEqual([
      "episode-01",
      "episode-02"
    ]);
  }, 60_000);

  it("imports semantic references nested inside inline code into card entry links", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    const cardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );
    const cardsSource = await readFile(cardsPath, "utf8");

    await writeFile(
      cardsPath,
      cardsSource.replace(
        'notes_it: "Si collega a [～ている](grammar:grammar-teiru)."',
        'notes_it: "Si collega a `[食べる](term:term-taberu)` e a [～ている](grammar:grammar-teiru)."'
      )
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");

    const entryLinks = await database.query.entryLink.findMany();
    const mentionedTermLink = entryLinks.find(
      (row) =>
        row.sourceType === "card" &&
        row.sourceId === grammarCardId &&
        row.linkRole === "mentioned" &&
        row.entryType === "term" &&
        row.entryId === termDbId
    );

    expect(mentionedTermLink).toBeDefined();
  }, 60_000);

  it("imports lesson entry links referenced from grammar notes", async () => {
    const noteReferencedTermId = "term-yoku";

    await copyContentFixture(validContentRoot, contentRoot);

    const lessonPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "textbook",
      "001-intro.md"
    );
    const lessonSource = await readFile(lessonPath, "utf8");
    const targetBlock = [
      ":::grammar",
      "id: grammar-teiru",
      "pattern: ～ている",
      "title: Forma in -te iru",
      "meaning_it: azione in corso o stato risultante",
      "aliases: [てる]",
      ":::"
    ].join("\n");
    const replacementBlock = [
      ":::term",
      `id: ${noteReferencedTermId}`,
      "lemma: よく",
      "reading: よく",
      "romaji: yoku",
      "meaning_it: spesso",
      ":::",
      "",
      ":::grammar",
      "id: grammar-teiru",
      "pattern: ～ている",
      "title: Forma in -te iru",
      "meaning_it: azione in corso o stato risultante",
      `notes_it: \"Nota con \`- [よく](term:${noteReferencedTermId})\`\"`,
      "aliases: [てる]",
      ":::"
    ].join("\n");

    await writeFile(
      lessonPath,
      lessonSource.replace(targetBlock, replacementBlock)
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");

    const entryLinks = await database.query.entryLink.findMany();
    const mentionedTermLink = entryLinks.find(
      (row) =>
        row.sourceType === "lesson" &&
        row.sourceId === lessonId &&
        row.linkRole === "mentioned" &&
        row.entryType === "term" &&
        row.entryId ===
          buildScopedEntryId("term", mediaId, noteReferencedTermId)
    );

    expect(mentionedTermLink).toBeDefined();
  }, 60_000);

  it("updates imported content on reimport while preserving existing user review state", async () => {
    await copyContentFixture(validContentRoot, contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });
    await seedUserState(database);

    const cardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );
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
      where: eq(term.id, termDbId)
    });
    const importedCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const canonicalSubjectKey = `group:term:${importedTerm?.crossMediaGroupId}`;
    const memoryKey = buildReviewMemoryKey({
      canonicalSubjectKey,
      cardId: termCardId,
      recallTask: "recognition"
    });
    const persistedReviewState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, memoryKey)
      });
    const legacyReviewState = await database.query.reviewSubjectState.findFirst(
      {
        where: eq(reviewSubjectState.subjectKey, `entry:term:${termDbId}`)
      }
    );

    expect(importedTerm?.meaningIt).toBe("assumere cibo");
    expect(importedCard?.back).toBe("assumere cibo");
    expect(persistedReviewState?.state).toBe("learning");
    expect(legacyReviewState).toBeUndefined();
  }, 60_000);

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
      "sample-anime",
      "textbook",
      "001-intro.md"
    );
    const cardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );
    const pronunciationsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "pronunciations.json"
    );

    await writeFile(
      lessonPath,
      `---
id: lesson-sample-anime-ep01-intro
media_id: media-sample-anime
slug: ep01-intro
title: Episodio 1 - Introduzione
order: 10
segment_ref: episode-01
difficulty: n5
status: active
tags: [intro, core]
prerequisites: []
---

# Obiettivo

In questa lezione vediamo solo la forma
[～ている](grammar:grammar-teiru).

La parola {{日本語|にほんご}} compare spesso nelle spiegazioni.

:::grammar
id: grammar-teiru
pattern: ～ている
title: Forma in -te iru
meaning_it: azione in corso o stato risultante
aliases: [てる]
:::
`
    );
    await writeFile(
      cardsPath,
      `---
id: cards-sample-anime-ep01
media_id: media-sample-anime
slug: ep01-core
title: Episodio 1 - Core cards
order: 10
segment_ref: episode-01
---

:::card
id: card-teiru-concept
lesson_id: lesson-sample-anime-ep01-intro
entry_type: grammar
entry_id: grammar-teiru
card_type: concept
front: ～ている
back: azione in corso / stato risultante
example_jp: "フリーレンは{{旅|たび}}を{{続|つづ}}けている。"
example_it: "Sample Anime continua il viaggio."
notes_it: "Si collega a [～ている](grammar:grammar-teiru)."
tags: [grammar, core]
:::
`
    );
    await writeFile(
      pronunciationsPath,
      JSON.stringify(
        {
          version: 1,
          entries: [
            {
              entry_type: "grammar",
              entry_id: "grammar-teiru",
              audio_src: "assets/audio/grammar/grammar-teiru/grammar-teiru.mp3",
              audio_source: "forvo",
              audio_speaker: "Grammar Sample Speaker",
              audio_license: "Forvo terms",
              audio_attribution: "Grammar Sample Speaker via Forvo",
              audio_page_url:
                "https://forvo.com/word/%E3%81%A6%E3%81%84%E3%82%8B/#ja",
              pitch_accent: 0,
              pitch_accent_source: "Wiktionary",
              pitch_accent_page_url:
                "https://en.wiktionary.org/wiki/%E3%81%A6%E3%81%84%E3%82%8B"
            }
          ]
        },
        null,
        2
      )
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
    expect(result.summary.prunedTermIds).toContain(termDbId);

    const archivedCard = await database.query.card.findFirst({
      where: eq(card.id, termCardId)
    });
    const missingTerm = await database.query.term.findFirst({
      where: eq(term.id, termDbId)
    });
    const persistedReviewState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, `entry:term:${termDbId}`)
      });
    const persistedReviewLog = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, `entry:term:${termDbId}`)
    });
    const activeCards = await listCardsByMediaId(database, mediaId);

    expect(archivedCard?.status).toBe("archived");
    expect(missingTerm).toBeUndefined();
    expect(persistedReviewState?.state).toBe("learning");
    expect(persistedReviewState?.manualOverride).toBe(true);
    expect(persistedReviewLog).toHaveLength(1);
    expect(activeCards.map((entry) => entry.id)).toEqual([grammarCardId]);
  }, 60_000);

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
      "sample-anime",
      "textbook",
      "001-intro.md"
    );
    const cardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );

    await writeFile(
      lessonPath,
      (await readFile(lessonPath, "utf8")).replace(
        "segment_ref: episode-01\n",
        ""
      )
    );
    await writeFile(
      cardsPath,
      (await readFile(cardsPath, "utf8")).replace(
        "segment_ref: episode-01\n",
        ""
      )
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
      where: eq(term.id, termDbId)
    });
    const importedGrammar = await database.query.grammarPattern.findFirst({
      where: eq(grammarPattern.id, grammarDbId)
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
  }, 60_000);

  it("supports incremental media-scoped imports without archiving out-of-scope media", async () => {
    await copyContentFixture(validContentRoot, contentRoot);
    await writeScopedMediaFixture(contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    const sampleAnimeCardsPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "cards",
      "001-core.md"
    );

    await writeFile(
      sampleAnimeCardsPath,
      (await readFile(sampleAnimeCardsPath, "utf8"))
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
      mediaSlugs: ["sample-anime"],
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

    const updatedSampleAnimeTerm = await database.query.term.findFirst({
      where: eq(term.id, termDbId)
    });
    const updatedSampleAnimeCard = await database.query.card.findFirst({
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
      where: eq(term.id, scopedTermDbId)
    });

    expect(updatedSampleAnimeTerm?.meaningIt).toBe("nutrirsi");
    expect(updatedSampleAnimeCard?.back).toBe("nutrirsi");
    expect(preservedScopedMedia?.status).toBe("active");
    expect(preservedScopedLesson?.status).toBe("active");
    expect(preservedScopedCard?.status).toBe("active");
    expect(preservedScopedTerm?.lemma).toBe("ライオス");
  }, 60_000);

  it("supports scoped imports when the target media reuses term and grammar source ids from another media", async () => {
    await writeCrossMediaContentFixture(contentRoot);

    const initialResult = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-09T10:00:00.000Z")
    });

    expect(initialResult.status).toBe("completed");

    const betaCardsPath = path.join(
      contentRoot,
      "media",
      crossMediaFixture.beta.mediaSlug,
      "cards",
      "001-core.md"
    );

    await writeFile(
      betaCardsPath,
      (await readFile(betaCardsPath, "utf8")).replace(
        crossMediaFixture.beta.termMeaning,
        "costo nel media beta aggiornato"
      )
    );

    const scopedResult = await importContentWorkspace({
      contentRoot,
      database,
      mediaSlugs: [crossMediaFixture.beta.mediaSlug],
      now: new Date("2026-03-09T11:00:00.000Z")
    });

    expect(scopedResult.status).toBe("completed");

    const [updatedBetaTerm, preservedAlphaTerm] = await Promise.all([
      database.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.beta.termSourceId)
      }),
      database.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.alpha.termSourceId)
      })
    ]);

    expect(updatedBetaTerm?.meaningIt).toBe("costo nel media beta aggiornato");
    expect(preservedAlphaTerm?.meaningIt).toBe(
      crossMediaFixture.alpha.termMeaning
    );
    expect(updatedBetaTerm?.crossMediaGroupId).toBeTruthy();
    expect(updatedBetaTerm?.crossMediaGroupId).toBe(
      preservedAlphaTerm?.crossMediaGroupId
    );
    expect(
      await countRows(database.query.crossMediaGroup.findMany())
    ).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("supports lesson-scoped imports without applying unrelated media changes", async () => {
    await writeRichContentFixture(contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-10T09:00:00.000Z")
    });

    const introCardsPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "cards",
      "001-core.md"
    );
    const followupLessonPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "textbook",
      "002-followup.md"
    );
    const followupCardsPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "cards",
      "002-bonus.md"
    );

    await writeFile(
      introCardsPath,
      (await readFile(introCardsPath, "utf8"))
        .replace("meaning_it: luce; lanterna", "meaning_it: luce fuori scope")
        .replace("back: luce; lanterna", "back: luce fuori scope")
    );
    await writeFile(
      followupLessonPath,
      (await readFile(followupLessonPath, "utf8")).replace(
        "meaning_it: poiche; dato che",
        "meaning_it: dato che; siccome"
      )
    );
    await writeFile(
      followupCardsPath,
      (await readFile(followupCardsPath, "utf8"))
        .replace("meaning_it: cena", "meaning_it: cena della scena")
        .replace("back: cena", "back: cena della scena")
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      lessonSlugs: [richContentFixture.lessonFollowupSlug],
      mediaSlugs: [richContentFixture.mediaSlug],
      now: new Date("2026-03-10T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected a completed import result");
    }
    expect(result.filesChanged).toBe(2);
    expect(result.summary.archivedLessonIds).toEqual([]);
    expect(result.summary.archivedCardIds).toEqual([]);
    expect(result.summary.prunedTermIds).toEqual([]);
    expect(result.summary.prunedGrammarIds).toEqual([]);

    const introTerm = await database.query.term.findFirst({
      where: eq(
        term.id,
        buildScopedEntryId(
          "term",
          richContentFixture.mediaId,
          richContentFixture.termPrimaryId
        )
      )
    });
    const introCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termPrimaryCardId)
    });
    const followupTerm = await database.query.term.findFirst({
      where: eq(
        term.id,
        buildScopedEntryId(
          "term",
          richContentFixture.mediaId,
          richContentFixture.termSecondaryId
        )
      )
    });
    const followupGrammar = await database.query.grammarPattern.findFirst({
      where: eq(
        grammarPattern.id,
        buildScopedEntryId(
          "grammar",
          richContentFixture.mediaId,
          richContentFixture.grammarSecondaryId
        )
      )
    });
    const followupCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termSecondaryCardId)
    });

    expect(introTerm?.meaningIt).toBe("luce; lanterna");
    expect(introCard?.back).toBe("luce; lanterna");
    expect(followupTerm?.meaningIt).toBe("cena della scena");
    expect(followupGrammar?.meaningIt).toBe("dato che; siccome");
    expect(followupCard?.back).toBe("cena della scena");
  }, 60_000);

  it("updates multiple lesson slugs in a single lesson-scoped import", async () => {
    await writeRichContentFixture(contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-10T09:00:00.000Z")
    });

    const introCardsPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "cards",
      "001-core.md"
    );
    const followupCardsPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "cards",
      "002-bonus.md"
    );

    await writeFile(
      introCardsPath,
      (await readFile(introCardsPath, "utf8")).replace(
        "meaning_it: luce; lanterna",
        "meaning_it: luce calda"
      )
    );
    await writeFile(
      followupCardsPath,
      (await readFile(followupCardsPath, "utf8")).replace(
        "meaning_it: cena",
        "meaning_it: cena serale"
      )
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      lessonSlugs: [
        richContentFixture.lessonIntroSlug,
        richContentFixture.lessonFollowupSlug
      ],
      mediaSlugs: [richContentFixture.mediaSlug],
      now: new Date("2026-03-10T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected a completed import result");
    }
    expect(result.filesChanged).toBe(2);

    const introTerm = await database.query.term.findFirst({
      where: eq(
        term.id,
        buildScopedEntryId(
          "term",
          richContentFixture.mediaId,
          richContentFixture.termPrimaryId
        )
      )
    });
    const followupTerm = await database.query.term.findFirst({
      where: eq(
        term.id,
        buildScopedEntryId(
          "term",
          richContentFixture.mediaId,
          richContentFixture.termSecondaryId
        )
      )
    });

    expect(introTerm?.meaningIt).toBe("luce calda");
    expect(followupTerm?.meaningIt).toBe("cena serale");
  }, 60_000);

  it("does not archive a selected lesson card moved to an out-of-scope lesson in current content", async () => {
    await writeRichContentFixture(contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-10T09:00:00.000Z")
    });

    const introCardsPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "cards",
      "001-core.md"
    );

    await writeFile(
      introCardsPath,
      (await readFile(introCardsPath, "utf8")).replace(
        `id: ${richContentFixture.termPrimaryCardId}\nlesson_id: ${richContentFixture.lessonIntroId}`,
        `id: ${richContentFixture.termPrimaryCardId}\nlesson_id: ${richContentFixture.lessonFollowupId}`
      )
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      lessonSlugs: [richContentFixture.lessonIntroSlug],
      mediaSlugs: [richContentFixture.mediaSlug],
      now: new Date("2026-03-10T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected a completed import result");
    }
    expect(result.summary.archivedCardIds).toEqual([]);

    const movedOutOfScopeCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termPrimaryCardId)
    });

    expect(movedOutOfScopeCard?.status).toBe("active");
    expect(movedOutOfScopeCard?.lessonId).toBe(
      richContentFixture.lessonIntroId
    );
  }, 60_000);

  it("limits lesson-scoped archival and pruning to cards and entries tied to the selected lessons", async () => {
    await writeRichContentFixture(contentRoot);

    await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-10T09:00:00.000Z")
    });

    const followupCardsPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "cards",
      "002-bonus.md"
    );
    const followupLessonPath = path.join(
      contentRoot,
      "media",
      richContentFixture.mediaSlug,
      "textbook",
      "002-followup.md"
    );

    await writeFile(
      followupLessonPath,
      (await readFile(followupLessonPath, "utf8")).replace(
        `Colleghiamo [夕食](term:${richContentFixture.termSecondaryId}) a\n[～ので](grammar:${richContentFixture.grammarSecondaryId}).`,
        `Colleghiamo la scena a [～ので](grammar:${richContentFixture.grammarSecondaryId}).`
      )
    );
    await writeFile(
      followupCardsPath,
      `---
id: ${richContentFixture.cardsBonusId}
media_id: ${richContentFixture.mediaId}
slug: bonus-cards
title: Bonus cards
order: 20
segment_ref: ${richContentFixture.segmentSlug}
---

:::card
id: ${richContentFixture.grammarSecondaryCardId}
lesson_id: ${richContentFixture.lessonFollowupId}
entry_type: grammar
entry_id: ${richContentFixture.grammarSecondaryId}
card_type: concept
front: ～ので
back: poiche; dato che
example_jp: "{{夕食|ゆうしょく}}なので、あとで{{行|い}}く。"
example_it: "Dato che e ora di cena, vado dopo."
notes_it: "Si collega a [～ので](grammar:${richContentFixture.grammarSecondaryId})."
tags: [grammar, bonus]
:::
`
    );

    const result = await importContentWorkspace({
      contentRoot,
      database,
      lessonSlugs: [richContentFixture.lessonFollowupSlug],
      mediaSlugs: [richContentFixture.mediaSlug],
      now: new Date("2026-03-10T10:00:00.000Z")
    });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected a completed import result");
    }
    expect(result.summary.archivedCardIds).toEqual([
      richContentFixture.termSecondaryCardId
    ]);
    expect(result.summary.archivedLessonIds).toEqual([]);
    expect(result.summary.prunedTermIds).toEqual([
      buildScopedEntryId(
        "term",
        richContentFixture.mediaId,
        richContentFixture.termSecondaryId
      )
    ]);

    const archivedFollowupCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termSecondaryCardId)
    });
    const removedFollowupTerm = await database.query.term.findFirst({
      where: eq(
        term.id,
        buildScopedEntryId(
          "term",
          richContentFixture.mediaId,
          richContentFixture.termSecondaryId
        )
      )
    });
    const preservedIntroCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termPrimaryCardId)
    });
    const preservedIntroTerm = await database.query.term.findFirst({
      where: eq(
        term.id,
        buildScopedEntryId(
          "term",
          richContentFixture.mediaId,
          richContentFixture.termPrimaryId
        )
      )
    });

    expect(archivedFollowupCard?.status).toBe("archived");
    expect(removedFollowupTerm).toBeUndefined();
    expect(preservedIntroCard?.status).toBe("active");
    expect(preservedIntroTerm?.meaningIt).toBe("luce; lanterna");

    const repeatResult = await importContentWorkspace({
      contentRoot,
      database,
      lessonSlugs: [richContentFixture.lessonFollowupSlug],
      mediaSlugs: [richContentFixture.mediaSlug],
      now: new Date("2026-03-10T11:00:00.000Z")
    });

    expect(repeatResult.status).toBe("completed");
    if (repeatResult.status !== "completed") {
      throw new Error("expected a completed import result");
    }
    expect(repeatResult.summary.archivedCardIds).toEqual([]);

    const repeatArchivedFollowupCard = await database.query.card.findFirst({
      where: eq(card.id, richContentFixture.termSecondaryCardId)
    });

    expect(repeatArchivedFollowupCard?.updatedAt).toBe(
      archivedFollowupCard?.updatedAt
    );
  }, 60_000);

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
  }, 60_000);
});

async function copyContentFixture(sourceRoot: string, destinationRoot: string) {
  await cp(sourceRoot, destinationRoot, { recursive: true });
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
lesson_id: ${scopedLessonId}
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
  await database
    .insert(reviewSubjectState)
    .values({
      subjectKey: `entry:term:${termDbId}`,
      subjectType: "entry",
      entryType: "term",
      crossMediaGroupId: null,
      entryId: termDbId,
      cardId: termCardId,
      state: "learning",
      stability: 1.7,
      difficulty: 4.1,
      dueAt: "2026-03-10T09:00:00.000Z",
      lastReviewedAt: "2026-03-09T09:30:00.000Z",
      lastInteractionAt: "2026-03-09T09:30:00.000Z",
      scheduledDays: 0,
      learningSteps: 0,
      lapses: 1,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: true,
      suspended: false,
      createdAt: "2026-03-09T09:00:00.000Z",
      updatedAt: "2026-03-09T09:30:00.000Z"
    })
    .onConflictDoUpdate({
      target: reviewSubjectState.subjectKey,
      set: {
        cardId: sql`excluded.card_id`,
        state: sql`excluded.state`,
        stability: sql`excluded.stability`,
        difficulty: sql`excluded.difficulty`,
        dueAt: sql`excluded.due_at`,
        lastReviewedAt: sql`excluded.last_reviewed_at`,
        lastInteractionAt: sql`excluded.last_interaction_at`,
        lapses: sql`excluded.lapses`,
        reps: sql`excluded.reps`,
        schedulerVersion: sql`excluded.scheduler_version`,
        manualOverride: sql`excluded.manual_override`,
        updatedAt: sql`excluded.updated_at`
      }
    });
  await database.insert(reviewSubjectLog).values({
    id: "review_subject_log_term_taberu",
    subjectKey: `entry:term:${termDbId}`,
    cardId: termCardId,
    answeredAt: "2026-03-09T09:30:00.000Z",
    rating: "good",
    previousState: "new",
    newState: "learning",
    scheduledDueAt: "2026-03-10T09:00:00.000Z",
    elapsedDays: 0.25,
    responseMs: 2100,
    schedulerVersion: "fsrs_v1"
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

import path from "node:path";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { parseContentRoot, parseMediaDirectory } from "@/features/content";
import {
  bonusDistinctCardsFixture,
  contentLibraryRoot,
  listFilesRecursively,
  richContentFixture,
  repositoryRoot,
  validContentRoot,
  validMediaDirectory,
  writeBonusDistinctCardsFixture,
  writeRichContentFixture,
  writeMediaBundle
} from "./helpers/content-fixtures";

describe("content parser and validator integration", () => {
  it("accepts optional pronunciation metadata on term blocks and merges grammar audio from pronunciations.json", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);
    expect(result.data.terms[0]?.audio).toEqual({
      audioAttribution: "Test Native Speaker via Forvo",
      audioLicense: "Forvo terms",
      audioPageUrl: "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja",
      audioSource: "forvo",
      audioSpeaker: "Test Native Speaker",
      audioSrc: "assets/audio/term/term-taberu/term-taberu.ogg"
    });
    expect(result.data.terms[0]?.pitchAccent).toBe(2);
    expect(result.data.terms[0]?.pitchAccentSource).toBe("Wiktionary");
    expect(result.data.terms[0]?.pitchAccentPageUrl).toBe(
      "https://en.wiktionary.org/wiki/%E9%A3%9F%E3%81%B9%E3%82%8B"
    );
    expect(result.data.grammarPatterns[0]?.audio).toEqual({
      audioAttribution: "Grammar Sample Speaker via Forvo",
      audioLicense: "Forvo terms",
      audioPageUrl: "https://forvo.com/word/%E3%81%A6%E3%81%84%E3%82%8B/#ja",
      audioSource: "forvo",
      audioSpeaker: "Grammar Sample Speaker",
      audioSrc: "assets/audio/grammar/grammar-teiru/grammar-teiru.mp3"
    });
    expect(result.data.grammarPatterns[0]?.pitchAccent).toBe(0);
    expect(result.data.grammarPatterns[0]?.pitchAccentSource).toBe(
      "Wiktionary"
    );
  });

  it("tracks semantic references declared inside grammar notes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-notes-"));
    const contentRoot = path.join(tempRoot, "content");
    const lessonPath = path.join(
      contentRoot,
      "media",
      "sample-anime",
      "textbook",
      "001-intro.md"
    );

    try {
      await cp(validContentRoot, contentRoot, { recursive: true });

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
        "id: term-yoku",
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
        'notes_it: "Nota con `- [よく](term:term-yoku)`"',
        "aliases: [てる]",
        ":::"
      ].join("\n");

      await writeFile(
        lessonPath,
        lessonSource.replace(targetBlock, replacementBlock)
      );

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", "sample-anime")
      );

      expect(result.ok).toBe(true);
      expect(result.data.references).toContainEqual(
        expect.objectContaining({
          referenceType: "term",
          targetId: "term-yoku",
          display: "よく"
        })
      );
      expect(result.data.lessons[0]?.referenceIds).toContain("term:term-yoku");

      const grammarBlock = result.data.lessons[0]?.body.blocks.find(
        (block) => block.type === "grammarDefinition"
      );

      expect(grammarBlock).toMatchObject({
        type: "grammarDefinition",
        entry: {
          notesIt: {
            raw: "Nota con `- [よく](term:term-yoku)`",
            nodes: [
              { type: "text", value: "Nota con " },
              {
                type: "inlineCode",
                children: [
                  { type: "text", value: "- " },
                  {
                    type: "reference",
                    targetType: "term",
                    targetId: "term-yoku",
                    display: "よく"
                  }
                ]
              }
            ]
          }
        }
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps the parser core under src/features/content independent from src/db", async () => {
    const contentSourceFiles = (
      await listFilesRecursively(contentLibraryRoot)
    ).filter(
      (filePath) =>
        filePath.endsWith(".ts") &&
        !filePath.includes(`${path.sep}importer${path.sep}`) &&
        path.basename(filePath) !== "importer.ts"
    );
    const filesImportingDb = await Promise.all(
      contentSourceFiles.map(async (filePath) => {
        const source = await readFile(filePath, "utf8");

        return source.includes("@/db/") || source.includes("src/db/")
          ? path.relative(repositoryRoot, filePath)
          : null;
      })
    );

    expect(filesImportingDb.filter((value) => value !== null)).toEqual([]);
  });

  it("parses a valid media directory into a normalized bundle", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);

    expect(result.data.media?.frontmatter.id).toBe("media-sample-anime");
    expect(result.data.lessons).toHaveLength(1);
    expect(result.data.cardFiles).toHaveLength(1);
    expect(result.data.terms).toHaveLength(1);
    expect(result.data.grammarPatterns).toHaveLength(1);
    expect(result.data.cards).toHaveLength(2);
    expect(result.data.references).toHaveLength(4);

    const lesson = result.data.lessons[0];
    const cardsFile = result.data.cardFiles[0];

    expect(lesson?.declaredGrammarIds).toEqual(["grammar-teiru"]);
    expect(lesson?.referenceIds).toEqual([
      "term:term-taberu",
      "grammar:grammar-teiru"
    ]);
    expect(
      lesson?.body.blocks.some(
        (block) =>
          block.type === "paragraph" &&
          block.children.some(
            (node) =>
              node.type === "furigana" &&
              node.base === "日本語" &&
              node.reading === "にほんご"
          )
      )
    ).toBe(true);
    expect(
      lesson?.body.blocks.some((block) => block.type === "grammarDefinition")
    ).toBe(true);
    expect(lesson?.body.blocks).toContainEqual(
      expect.objectContaining({
        type: "image",
        src: "assets/episode-01/sample-anime-meal.svg",
        alt: "Sample Anime osserva una tavola apparecchiata."
      })
    );

    expect(cardsFile?.declaredTermIds).toEqual(["term-taberu"]);
    expect(cardsFile?.declaredCardIds).toEqual([
      "card-taberu-recognition",
      "card-teiru-concept"
    ]);
    expect(cardsFile?.body.blocks.map((block) => block.type)).toEqual([
      "termDefinition",
      "cardDefinition",
      "cardDefinition"
    ]);

    expect(result.data.cards[1]?.notesIt?.nodes).toContainEqual(
      expect.objectContaining({
        type: "reference",
        targetType: "grammar",
        targetId: "grammar-teiru"
      })
    );
  });

  it("parses a rich synthetic media directory into a normalized bundle", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-rich-content-"));
    const contentRoot = path.join(tempRoot, "content");

    try {
      await writeRichContentFixture(contentRoot);

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", richContentFixture.mediaSlug)
      );
      const lessonSlugs = result.data.lessons.map(
        (lesson) => lesson.frontmatter.slug
      );
      const cardFileIds = result.data.cardFiles.map(
        (file) => file.frontmatter.id
      );
      const termIds = result.data.terms.map((term) => term.id);
      const grammarIds = result.data.grammarPatterns.map(
        (grammar) => grammar.id
      );
      const cardIds = result.data.cards.map((card) => card.id);

      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.data.media?.frontmatter.id).toBe(
        richContentFixture.mediaId
      );
      expect(result.data.media?.frontmatter.title).toBe(
        richContentFixture.mediaTitle
      );
      expect(lessonSlugs).toEqual([
        richContentFixture.lessonIntroSlug,
        richContentFixture.lessonFollowupSlug
      ]);
      expect(cardFileIds).toEqual([
        richContentFixture.cardsCoreId,
        richContentFixture.cardsBonusId
      ]);
      expect(termIds).toEqual([
        richContentFixture.termPrimaryId,
        richContentFixture.termSecondaryId
      ]);
      expect(grammarIds).toEqual([
        richContentFixture.grammarPrimaryId,
        richContentFixture.grammarSecondaryId
      ]);
      expect(cardIds).toEqual([
        richContentFixture.termPrimaryCardId,
        richContentFixture.grammarPrimaryCardId,
        richContentFixture.termSecondaryCardId,
        richContentFixture.grammarSecondaryCardId
      ]);
      expect(
        result.data.cards.every((card) => card.exampleJp && card.exampleIt)
      ).toBe(true);
      expect(result.data.terms[0]?.audio?.audioSrc).toBe(
        richContentFixture.termAudioSrc
      );
      expect(result.data.grammarPatterns[0]?.audio?.audioSrc).toBe(
        richContentFixture.grammarAudioSrc
      );

      const followupLesson = result.data.lessons.find(
        (lesson) =>
          lesson.frontmatter.slug === richContentFixture.lessonFollowupSlug
      );

      expect(followupLesson?.referenceIds).toEqual(
        expect.arrayContaining([
          `term:${richContentFixture.termSecondaryId}`,
          `grammar:${richContentFixture.grammarSecondaryId}`,
          `grammar:${richContentFixture.grammarPrimaryId}`
        ])
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("keeps distinct bonus acquisition card fronts on distinct synthetic review entries", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-bonus-content-"));
    const contentRoot = path.join(tempRoot, "content");

    try {
      await writeBonusDistinctCardsFixture(contentRoot);

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", bonusDistinctCardsFixture.mediaSlug)
      );
      const lessonCards = result.data.cards.filter(
        (card) => card.lessonId === bonusDistinctCardsFixture.lessonId
      );
      const entryIds = lessonCards.map((card) => card.entryId);
      const cardFronts = lessonCards.map((card) => card.front);

      expect(result.ok).toBe(true);
      expect(lessonCards).toHaveLength(
        bonusDistinctCardsFixture.expectedCardCount
      );
      expect(new Set(entryIds).size).toBe(lessonCards.length);
      expect(new Set(cardFronts).size).toBe(lessonCards.length);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("aggregates media bundles from the content root", async () => {
    const result = await parseContentRoot(validContentRoot);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.data.contentRoot).toBe(validContentRoot);
    expect(result.data.bundles).toHaveLength(1);
    expect(result.data.bundles[0]?.mediaSlug).toBe("sample-anime");
  });

  it("allows duplicate term and grammar IDs across different media bundles", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      await writeMediaBundle(contentRoot, {
        mediaSlug: "alpha",
        mediaId: "media-alpha",
        cardsFileId: "cards-alpha",
        cardId: "card-alpha",
        sharedGrammarId: "grammar-shared",
        sharedTermId: "term-shared"
      });
      await writeMediaBundle(contentRoot, {
        mediaSlug: "beta",
        mediaId: "media-beta",
        cardsFileId: "cards-beta",
        cardId: "card-beta",
        sharedGrammarId: "grammar-shared",
        sharedTermId: "term-shared"
      });

      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.data.bundles).toHaveLength(2);
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });

  it("accepts explicit cross_media_group links across media even when local source ids differ", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      await writeMediaBundle(contentRoot, {
        mediaSlug: "alpha",
        mediaId: "media-alpha",
        cardsFileId: "cards-alpha",
        cardId: "card-alpha",
        sharedGrammarId: "grammar-alpha-local",
        sharedTermId: "term-alpha-local",
        crossMediaGrammarGroup: "shared-grammar-demo",
        crossMediaTermGroup: "shared-term-demo"
      });
      await writeMediaBundle(contentRoot, {
        mediaSlug: "beta",
        mediaId: "media-beta",
        cardsFileId: "cards-beta",
        cardId: "card-beta",
        sharedGrammarId: "grammar-beta-local",
        sharedTermId: "term-beta-local",
        crossMediaGrammarGroup: "shared-grammar-demo",
        crossMediaTermGroup: "shared-term-demo"
      });

      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.data.bundles).toHaveLength(2);
      expect(result.data.bundles[0]?.terms[0]?.crossMediaGroup).toBe(
        "shared-term-demo"
      );
      expect(result.data.bundles[1]?.grammarPatterns[0]?.crossMediaGroup).toBe(
        "shared-grammar-demo"
      );
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });

  it("rejects malformed cross_media_group identifiers", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      await writeMediaBundle(contentRoot, {
        mediaSlug: "alpha",
        mediaId: "media-alpha",
        cardsFileId: "cards-alpha",
        cardId: "card-alpha",
        sharedGrammarId: "grammar-alpha-local",
        sharedTermId: "term-alpha-local",
        crossMediaTermGroup: "bad group!"
      });

      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "structured-block.invalid-cross-media-group",
          category: "schema"
        })
      );
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });

  it("rejects cross_media_group collisions between term and grammar entries", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      await writeMediaBundle(contentRoot, {
        mediaSlug: "alpha",
        mediaId: "media-alpha",
        cardsFileId: "cards-alpha",
        cardId: "card-alpha",
        sharedGrammarId: "grammar-alpha-local",
        sharedTermId: "term-alpha-local",
        crossMediaGrammarGroup: "shared-entry-demo",
        crossMediaTermGroup: "shared-entry-demo"
      });

      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "cross-media-group.entry-type-mismatch",
          category: "integrity"
        })
      );
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });
});

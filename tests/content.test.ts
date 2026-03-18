import path from "node:path";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseContentRoot, parseMediaDirectory } from "@/lib/content";
import { parseFrontmatter } from "@/lib/content/parser/frontmatter";
import { parseInlineFragment } from "@/lib/content/parser/markdown";
import { extractStructuredBlocks } from "@/lib/content/parser/structured-blocks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repositoryRoot = path.join(__dirname, "..");
const contentLibraryRoot = path.join(repositoryRoot, "src", "lib", "content");
const duelMastersMediaDirectory = path.join(
  repositoryRoot,
  "content",
  "media",
  "duel-masters-dm25"
);
const fixturesRoot = path.join(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");
const validMediaDirectory = path.join(
  validContentRoot,
  "media",
  "sample-anime"
);
const invalidMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "bad-media"
);
const unsafeYamlMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "llm-unsafe-yaml"
);
const duplicateIdsMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "duplicate-ids"
);
const missingReferencesMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "missing-references"
);
const incompleteBundleMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "incomplete-bundle"
);
const missingImageAssetMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "missing-image-asset"
);
const cardTextPlainScalarMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "card-text-plain-scalar"
);

describe("content parser and validator", () => {
  it("parses frontmatter when the file starts with BOM and uses CRLF", () => {
    const source =
      "\uFEFF---\r\nid: media-demo\r\nslug: demo\r\n---\r\n# Body\r\n";
    const result = parseFrontmatter(source, "fixture.md");

    expect(result.issues).toEqual([]);
    expect(result.data).toEqual({
      id: "media-demo",
      slug: "demo"
    });
    expect(result.bodyLineOffset).toBe(4);
    expect(result.body).toBe("# Body\n");
  });

  it("does not parse structured blocks inside longer code fences", () => {
    const source = [
      "````md",
      "```yaml",
      ":::term",
      "id: term-ignored",
      "lemma: 例",
      "reading: れい",
      "romaji: rei",
      "meaning_it: esempio",
      ":::",
      "```",
      "````"
    ].join("\n");
    const result = extractStructuredBlocks(source, "fixture.md", 0);

    expect(result.issues).toEqual([]);
    expect(result.blocks).toEqual([]);
    expect(result.transformedSource).toBe(source);
  });

  it("tracks semantic references nested inside inline code fragments", () => {
    const result = parseInlineFragment({
      source: "`[食べる](term:term-taberu)`",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.references).toContainEqual(
      expect.objectContaining({
        referenceType: "term",
        targetId: "term-taberu",
        display: "食べる"
      })
    );
    expect(result.fragment.nodes).toEqual([
      {
        type: "inlineCode",
        children: [
          {
            type: "reference",
            raw: "[食べる](term:term-taberu)",
            display: "食べる",
            targetType: "term",
            targetId: "term-taberu",
            children: [{ type: "text", value: "食べる" }]
          }
        ]
      }
    ]);
  });

  it("tracks semantic references inside block-looking inline code fragments", () => {
    const cases = [
      {
        source: "`- [食べる](term:term-taberu)`",
        prefix: "- "
      },
      {
        source: "`> [食べる](term:term-taberu)`",
        prefix: "> "
      }
    ];

    for (const testCase of cases) {
      const result = parseInlineFragment({
        source: testCase.source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.references).toContainEqual(
        expect.objectContaining({
          referenceType: "term",
          targetId: "term-taberu",
          display: "食べる"
        })
      );
      expect(result.fragment.nodes).toEqual([
        {
          type: "inlineCode",
          children: [
            { type: "text", value: testCase.prefix },
            {
              type: "reference",
              raw: "[食べる](term:term-taberu)",
              display: "食べる",
              targetType: "term",
              targetId: "term-taberu",
              children: [{ type: "text", value: "食べる" }]
            }
          ]
        }
      ]);
    }
  });

  it("preserves literal block-looking markdown inside inline code fragments", () => {
    const cases = [
      { source: "`- foo`", expected: "- foo" },
      { source: "`1. foo`", expected: "1. foo" }
    ];

    for (const testCase of cases) {
      const result = parseInlineFragment({
        source: testCase.source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.fragment.nodes).toEqual([
        {
          type: "inlineCode",
          children: [{ type: "text", value: testCase.expected }]
        }
      ]);
    }
  });

  it("parses compound furigana for numeric counters and numeric qualifiers", () => {
    const result = parseInlineFragment({
      source: "`{{1枚|いちまい}}` e `{{2000以下|にせんいか}}`",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.issues).toEqual([]);
    expect(result.fragment.nodes).toEqual([
      {
        type: "inlineCode",
        children: [
          {
            type: "furigana",
            raw: "{{1枚|いちまい}}",
            base: "1枚",
            reading: "いちまい"
          }
        ]
      },
      { type: "text", value: " e " },
      {
        type: "inlineCode",
        children: [
          {
            type: "furigana",
            raw: "{{2000以下|にせんいか}}",
            base: "2000以下",
            reading: "にせんいか"
          }
        ]
      }
    ]);
  });

  it("flags furigana bases that keep visible kana inside the ruby", () => {
    const cases = [
      "{{受け取る|うけとる}}",
      "{{メイン枠|めいんわく}}",
      "{{2つ|ふたつ}}",
      "{{赤いガンダム(0085)|あかいがんだむ ぜろぜろはちご}}"
    ];

    for (const source of cases) {
      const result = parseInlineFragment({
        source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.mixed-kana-base",
          category: "syntax"
        })
      );
    }
  });

  it("accepts furigana split so kana stays visible", () => {
    const result = parseInlineFragment({
      source:
        "{{受|う}}け{{取|と}}る / メイン{{枠|わく}} / {{2|ふた}}つ / {{赤|あか}}いガンダム({{0085|ぜろぜろはちご}})",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.issues).toEqual([]);
  });

  it("flags furigana split between a number and its counter", () => {
    const result = parseInlineFragment({
      source: "`1{{枚|まい}}`",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "furigana.numeric-compound-split",
        category: "syntax",
        details: expect.objectContaining({
          numeric: "1",
          counter: "枚"
        })
      })
    );
  });

  it("flags furigana split between a numeric compound and its qualifier", () => {
    const cases = [
      "`4{{以下|いか}}`",
      "`{{2000|にせん}}{{以下|いか}}`",
      "`{{4つ|よっつ}}{{以上|いじょう}}`"
    ];

    for (const source of cases) {
      const result = parseInlineFragment({
        source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.numeric-compound-split",
          category: "syntax"
        })
      );
    }
  });

  it("accepts optional pronunciation metadata on term blocks and merges grammar audio from pronunciations.json", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);
    expect(result.data.terms[0]?.audio).toEqual({
      audioAttribution:
        "Test Native Speaker via Lingua Libre / Wikimedia Commons",
      audioLicense: "CC BY-SA 4.0",
      audioPageUrl:
        "https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Test_Native_Speaker-%E9%A3%9F%E3%81%B9%E3%82%8B.ogg",
      audioSource: "lingua_libre",
      audioSpeaker: "Test Native Speaker",
      audioSrc: "assets/audio/term/term-taberu/term-taberu.ogg"
    });
    expect(result.data.terms[0]?.pitchAccent).toBe(2);
    expect(result.data.terms[0]?.pitchAccentSource).toBe("Wiktionary");
    expect(result.data.terms[0]?.pitchAccentPageUrl).toBe(
      "https://en.wiktionary.org/wiki/%E9%A3%9F%E3%81%B9%E3%82%8B"
    );
    expect(result.data.grammarPatterns[0]?.audio).toEqual({
      audioAttribution: "Grammar Sample Speaker via Wikimedia Commons",
      audioLicense: "CC BY 4.0",
      audioPageUrl:
        "https://commons.wikimedia.org/wiki/File:Ja-%E3%81%A6%E3%81%84%E3%82%8B.mp3",
      audioSource: "wikimedia_commons",
      audioSpeaker: "Grammar Sample Speaker",
      audioSrc: "assets/audio/grammar/grammar-teiru/grammar-teiru.mp3"
    });
    expect(result.data.grammarPatterns[0]?.pitchAccent).toBe(0);
    expect(result.data.grammarPatterns[0]?.pitchAccentSource).toBe(
      "Wiktionary"
    );
  });

  it("rejects audio metadata without a local audio_src", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-audio-"));
    const contentRoot = path.join(tempRoot, "content");

    try {
      await cp(validContentRoot, contentRoot, { recursive: true });

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
          "audio_src: assets/audio/term/term-taberu/term-taberu.ogg\n",
          ""
        )
      );

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", "sample-anime")
      );

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "audio.missing-src",
          category: "schema"
        })
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("accepts pitch accent metadata without requiring a local audio_src", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-pitch-"));
    const contentRoot = path.join(tempRoot, "content");

    try {
      await cp(validContentRoot, contentRoot, { recursive: true });

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
          .replace(
            "audio_src: assets/audio/term/term-taberu/term-taberu.ogg\n",
            ""
          )
          .replace("audio_source: lingua_libre\n", "")
          .replace("audio_speaker: Test Native Speaker\n", "")
          .replace("audio_license: CC BY-SA 4.0\n", "")
          .replace(
            "audio_attribution: Test Native Speaker via Lingua Libre / Wikimedia Commons\n",
            ""
          )
          .replace(
            "audio_page_url: https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Test_Native_Speaker-%E9%A3%9F%E3%81%B9%E3%82%8B.ogg\n",
            ""
          )
      );

      const result = await parseMediaDirectory(
        path.join(contentRoot, "media", "sample-anime")
      );

      expect(result.ok).toBe(true);
      expect(result.data.terms[0]?.audio).toBeUndefined();
      expect(result.data.terms[0]?.pitchAccent).toBe(2);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
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

  it("keeps the parser core under src/lib/content independent from src/db", async () => {
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

  it("parses the real Duel Masters bundle", async () => {
    const result = await parseMediaDirectory(duelMastersMediaDirectory);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.data.media?.frontmatter.id).toBe("media-duel-masters-dm25");
    expect(result.data.media?.frontmatter.title).toBe("Duel Masters");
    expect(result.data.lessons).toHaveLength(20);
    expect(result.data.cardFiles).toHaveLength(14);
    expect(result.data.terms).toHaveLength(176);
    expect(result.data.grammarPatterns).toHaveLength(36);
    expect(result.data.cards).toHaveLength(221);
    expect(result.data.references).toHaveLength(1136);
    expect(
      result.data.lessons.map((lesson) => lesson.frontmatter.slug)
    ).toEqual([
      "tcg-core-overview",
      "tcg-core-patterns",
      "tcg-card-types",
      "duel-plays-app-overview",
      "duel-plays-app-decks-and-shop",
      "duel-plays-app-modes-and-progression",
      "duel-plays-app-rewards-and-claim-flow",
      "duel-plays-app-shop-packs-and-results",
      "dm25-sd1-overview",
      "duel-plays-app-exchange-decks-and-setup",
      "dm25-sd2-overview",
      "live-duel-encounters-crash-hadou",
      "live-duel-encounters-maou-de-szark",
      "live-duel-encounters-dama-vaishingu",
      "live-duel-encounters-bad-brand-first",
      "live-duel-encounters-kenzan-no-sabaki",
      "live-duel-encounters-kuromame-danshaku",
      "live-duel-encounters-tamatango-panzer",
      "live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari",
      "keyword-effects-reference"
    ]);
    expect(result.data.cardFiles.map((file) => file.frontmatter.id)).toEqual([
      "cards-duel-masters-dm25-tcg-core-basics",
      "cards-duel-masters-dm25-tcg-card-types",
      "cards-duel-masters-dm25-duel-plays-app-core",
      "cards-duel-masters-dm25-duel-plays-app-ui-deep-dive",
      "cards-duel-masters-dm25-dm25-sd1-core",
      "cards-duel-masters-dm25-dm25-sd2-core",
      "cards-duel-masters-dm25-live-duel-encounters-crash-hadou",
      "cards-duel-masters-dm25-live-duel-encounters-maou-de-szark",
      "cards-duel-masters-dm25-live-duel-encounters-dama-vaishingu",
      "cards-duel-masters-dm25-live-duel-encounters-bad-brand-first",
      "cards-duel-masters-dm25-live-duel-encounters-kenzan-no-sabaki",
      "cards-duel-masters-dm25-live-duel-encounters-kuromame-danshaku",
      "cards-duel-masters-dm25-live-duel-encounters-tamatango-panzer",
      "cards-duel-masters-dm25-live-duel-encounters-kingdom-ohkabuto-gouhaten-tsukumogatari"
    ]);
    expect(result.data.terms.some((term) => term.id === "term-invasion")).toBe(
      true
    );
    expect(
      result.data.terms.some((term) => term.id === "term-abyss-royal")
    ).toBe(true);
    expect(
      result.data.grammarPatterns.some(
        (grammar) => grammar.id === "grammar-kawarini"
      )
    ).toBe(true);
    expect(
      result.data.cards.some((card) => card.id === "card-invasion-recognition")
    ).toBe(true);
    expect(
      result.data.cards.some(
        (card) => card.id === "card-apollonus-dragelion-recognition"
      )
    ).toBe(true);
    expect(
      result.data.cards
        .filter((card) => !card.exampleJp || !card.exampleIt)
        .map((card) => card.id)
    ).toEqual([]);
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

  it("returns a structured issue when the media root is missing", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(false);
      expect(result.data.bundles).toEqual([]);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "content-root.missing-media-directory",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(contentRoot, "media")
          })
        })
      );
    } finally {
      await rm(contentRoot, { recursive: true, force: true });
    }
  });

  it("returns structured issues for invalid content", async () => {
    const result = await parseMediaDirectory(invalidMediaDirectory);
    const issueCodes = result.issues.map((issue) => issue.code);
    const categories = new Set(result.issues.map((issue) => issue.category));

    expect(result.ok).toBe(false);
    expect(categories).toEqual(
      new Set(["syntax", "schema", "reference", "integrity"])
    );
    expect(issueCodes).toContain("furigana.unclosed");
    expect(issueCodes).toContain("schema.unknown-field");
    expect(issueCodes).toContain("structured-block.invalid-yaml");
    expect(issueCodes).toContain("cards.free-text-not-allowed");
    expect(issueCodes).toContain("reference.missing-target");
    expect(issueCodes).toContain("card.missing-entry");
    expect(issueCodes).toContain("id.duplicate");

    expect(result.data.media?.frontmatter.id).toBe("media-bad");
    expect(result.data.lessons).toHaveLength(1);
    expect(result.data.cardFiles).toHaveLength(1);
  });

  it("flags fragile plain YAML scalars that an LLM can emit inside structured blocks", async () => {
    const result = await parseMediaDirectory(unsafeYamlMediaDirectory);
    const unsafeScalarIssues = result.issues.filter(
      (issue) => issue.code === "yaml.unsafe-plain-scalar"
    );

    expect(result.ok).toBe(false);
    expect(unsafeScalarIssues).toHaveLength(2);
    expect(unsafeScalarIssues).toContainEqual(
      expect.objectContaining({
        category: "syntax",
        path: "body.blocks[0].notes_it"
      })
    );
    expect(unsafeScalarIssues).toContainEqual(
      expect.objectContaining({
        category: "syntax",
        path: "body.blocks[1].notes_it"
      })
    );
  });

  it("flags full card-text examples left as plain YAML scalars", async () => {
    const result = await parseMediaDirectory(cardTextPlainScalarMediaDirectory);
    const unsafeScalarIssues = result.issues.filter(
      (issue) => issue.code === "yaml.unsafe-plain-scalar"
    );

    expect(result.ok).toBe(false);
    expect(unsafeScalarIssues).toContainEqual(
      expect.objectContaining({
        category: "syntax",
        path: "body.blocks[1].front",
        details: expect.objectContaining({
          field: "front",
          reason: "card-text-example"
        })
      })
    );
  });

  it("rejects markdown syntax inside lesson summaries because the UI renders them as plain text", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-summary-plain-"));
    const mediaDirectory = path.join(mediaRoot, "sample-anime");
    const lessonPath = path.join(mediaDirectory, "textbook", "001-intro.md");

    try {
      await cp(validMediaDirectory, mediaDirectory, { recursive: true });

      const lessonSource = await readFile(lessonPath, "utf8");
      const updatedLessonSource = lessonSource.replace(
        "prerequisites: []\n---",
        [
          "prerequisites: []",
          "summary: >-",
          "  Riconoscere [食べる](term:term-taberu), {{日本語|にほんご}} e `大丈夫` nella scena iniziale.",
          "---"
        ].join("\n")
      );
      await writeFile(lessonPath, updatedLessonSource);

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "frontmatter.summary-plain-text-only",
          category: "schema",
          path: "frontmatter.summary"
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("flags bare kanji inside plain-text summaries and media descriptions", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-plain-summary-"));

    try {
      const mediaDirectory = path.join(mediaRoot, "sample-anime");
      await cp(validMediaDirectory, mediaDirectory, { recursive: true });

      const mediaPath = path.join(mediaDirectory, "media.md");
      const lessonPath = path.join(mediaDirectory, "textbook", "001-intro.md");

      const mediaSource = await readFile(mediaPath, "utf8");
      const updatedMediaSource = mediaSource.replace(
        "---\n",
        [
          "---",
          "description: >-",
          "  Media con 報酬確認 nel testo descrittivo.",
          ""
        ].join("\n")
      );
      await writeFile(mediaPath, updatedMediaSource);

      const lessonSource = await readFile(lessonPath, "utf8");
      const updatedLessonSource = lessonSource.replace(
        "prerequisites: []\n---",
        [
          "prerequisites: []",
          "summary: >-",
          "  Riconoscere 報酬確認 nella scena iniziale.",
          "---"
        ].join("\n")
      );
      await writeFile(lessonPath, updatedLessonSource);

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "frontmatter.description-bare-kanji",
          category: "schema",
          path: "frontmatter.description"
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "frontmatter.summary-bare-kanji",
          category: "schema",
          path: "frontmatter.summary"
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("fails on duplicate IDs in a small targeted fixture", async () => {
    const result = await parseMediaDirectory(duplicateIdsMediaDirectory);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "id.duplicate",
        category: "integrity",
        details: expect.objectContaining({
          namespace: "term",
          id: "term-duel-masters-duplicate-invasion"
        })
      })
    );
  });

  it("fails on missing references in a small targeted fixture", async () => {
    const result = await parseMediaDirectory(missingReferencesMediaDirectory);
    const issueCodes = result.issues.map((issue) => issue.code);

    expect(result.ok).toBe(false);
    expect(issueCodes).toContain("reference.missing-target");
    expect(issueCodes).toContain("card.missing-entry");
  });

  it("fails on textbook image blocks that reference missing assets", async () => {
    const result = await parseMediaDirectory(missingImageAssetMediaDirectory);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "image.missing-asset",
        category: "integrity"
      })
    );
  });

  it("flags bare kanji in image alt text and captions", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-image-kanji-"));
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");
    const assetsDirectory = path.join(mediaDirectory, "assets", "ui");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await mkdir(cardsDirectory, { recursive: true });
      await mkdir(assetsDirectory, { recursive: true });

      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: game
segment_kind: lesson
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(
        path.join(textbookDirectory, "001-image.md"),
        `---
id: lesson-demo
media_id: media-demo
slug: image-demo
title: Image demo
order: 1
---

:::term
id: term-houshuu-kakunin
lemma: 報酬確認
reading: ほうしゅうかくにん
romaji: houshuu kakunin
meaning_it: verifica ricompensa
:::

:::image
src: assets/ui/demo.svg
alt: "Schermata 報酬確認."
caption: >-
  Apri [報酬確認](term:term-houshuu-kakunin) per vedere il dettaglio.
:::
`
      );
      await writeFile(
        path.join(cardsDirectory, "001-core.md"),
        `---
id: cards-demo
media_id: media-demo
slug: cards-demo
title: Demo cards
order: 1
---
`
      );
      await writeFile(
        path.join(assetsDirectory, "demo.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'
      );

      const result = await parseMediaDirectory(mediaDirectory);
      const issueCodes = result.issues.map((issue) => issue.code);

      expect(result.ok).toBe(false);
      expect(issueCodes).toContain("image.alt-bare-kanji");
      expect(issueCodes).toContain("image.caption-bare-kanji");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "image.alt-bare-kanji",
          path: "body.blocks[1].alt",
          category: "schema"
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "image.caption-bare-kanji",
          path: "body.blocks[1].caption",
          category: "schema"
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("flags bare learner-facing kanji and numerals outside furigana markup", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-visible-furigana-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await mkdir(cardsDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: game
segment_kind: lesson
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(
        path.join(textbookDirectory, "001-visible.md"),
        `---
id: lesson-demo
media_id: media-demo
slug: visible-demo
title: Visible demo
order: 1
---

Leggi 破壊された時 quando compare nel testo.

:::example_sentence
jp: >-
  このクリーチャーのパワーを+5000する。
translation_it: >-
  In italiano puoi citare 破壊された時 come trigger.
:::
`
      );
      await writeFile(
        path.join(cardsDirectory, "001-core.md"),
        `---
id: cards-demo
media_id: media-demo
slug: cards-demo
title: Demo cards
order: 1
---

:::term
id: term-demo
lemma: 破壊
reading: はかい
romaji: hakai
meaning_it: distruzione
notes_it: >-
  Qui 破壊された時 resta visibile senza furigana.
:::

:::card
id: card-demo
entry_type: term
entry_id: term-demo
card_type: recognition
front: 破壊された時
back: ok
example_jp: >-
  このクリーチャーのパワーを5000する。
example_it: >-
  Anche qui 破壊された時 compare in chiaro.
notes_it: >-
  Nota su 破壊された時.
:::
`
      );

      const result = await parseMediaDirectory(mediaDirectory);
      const issueCodes = result.issues.map((issue) => issue.code);

      expect(result.ok).toBe(false);
      expect(issueCodes).toContain("furigana.visible-text-bare-kanji");
      expect(issueCodes).toContain("furigana.visible-text-bare-numerals");
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.visible-text-bare-numerals",
          path: "body.blocks[1].jp",
          category: "schema",
          location: expect.objectContaining({
            filePath: path.join(textbookDirectory, "001-visible.md")
          })
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.visible-text-bare-kanji",
          path: "body.blocks[1].front",
          category: "schema",
          location: expect.objectContaining({
            filePath: path.join(cardsDirectory, "001-core.md")
          })
        })
      );
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.visible-text-bare-numerals",
          path: "body.blocks[1].example_jp",
          category: "schema",
          location: expect.objectContaining({
            filePath: path.join(cardsDirectory, "001-core.md")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("fails on an incomplete bundle fixture without cards/", async () => {
    const result = await parseMediaDirectory(incompleteBundleMediaDirectory);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "media.missing-directory",
        category: "integrity",
        location: expect.objectContaining({
          filePath: path.join(incompleteBundleMediaDirectory, "cards")
        })
      })
    );
  });

  it("maps card field issues and references back to the source file", async () => {
    const mediaRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-inline-"));
    const mediaDirectory = path.join(mediaRoot, "demo");
    const cardsDirectory = path.join(mediaDirectory, "cards");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsPath = path.join(cardsDirectory, "001-inline.md");
    const cardsSource = `---
id: cards-demo
media_id: media-demo
slug: demo-cards
title: Demo cards
order: 1
---

:::term
id: term-demo
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
:::

:::card
id: card-demo
entry_type: term
entry_id: term-demo
card_type: recognition
front: "{{未完}"
back: ok
notes_it: "[Ghost](term:term-missing)"
:::
`;

    try {
      await mkdir(cardsDirectory, { recursive: true });
      await mkdir(textbookDirectory, { recursive: true });
      await writeFile(
        path.join(mediaDirectory, "media.md"),
        `---
id: media-demo
slug: demo
title: Demo
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
      );
      await writeFile(cardsPath, cardsSource);

      const result = await parseMediaDirectory(mediaDirectory);
      const furiganaIssue = result.issues.find(
        (issue) => issue.code === "furigana.unclosed"
      );
      const missingReferenceIssue = result.issues.find(
        (issue) => issue.code === "reference.missing-target"
      );
      const missingReference = result.data.references.find(
        (reference) => reference.targetId === "term-missing"
      );

      expect(result.ok).toBe(false);
      expect(furiganaIssue?.location.filePath).toBe(cardsPath);
      expect(furiganaIssue?.location.range?.start.line).toBe(
        lineNumberOf(cardsSource, 'front: "{{未完}"')
      );
      expect(missingReferenceIssue?.location.filePath).toBe(cardsPath);
      expect(missingReferenceIssue?.location.range?.start.line).toBe(
        lineNumberOf(cardsSource, 'notes_it: "[Ghost](term:term-missing)"')
      );
      expect(missingReference?.sourceFile).toBe(cardsPath);
      expect(missingReference?.location?.start.line).toBe(
        lineNumberOf(cardsSource, 'notes_it: "[Ghost](term:term-missing)"')
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when media.md is missing", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-missing-media-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await writeLessonDocument(textbookDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });
      await writeCardsDocument(cardsDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.data.media).toBeNull();
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "media.missing-file",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(mediaDirectory, "media.md")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when textbook/ is missing", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-missing-textbook-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await mkdir(cardsDirectory, { recursive: true });
      await writeMediaDocument(mediaDirectory, {
        mediaId: "media-demo",
        mediaSlug: "demo"
      });
      await writeCardsDocument(cardsDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "media.missing-directory",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(mediaDirectory, "textbook")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns a structured issue when cards/ is missing", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-missing-cards-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await writeMediaDocument(mediaDirectory, {
        mediaId: "media-demo",
        mediaSlug: "demo"
      });
      await writeLessonDocument(textbookDirectory, {
        mediaId: "media-demo",
        slugPrefix: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "media.missing-directory",
          category: "integrity",
          location: expect.objectContaining({
            filePath: path.join(mediaDirectory, "cards")
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });

  it("returns structured issues when textbook/ and cards/ are present but empty", async () => {
    const mediaRoot = await mkdtemp(
      path.join(tmpdir(), "jcs-content-empty-directories-")
    );
    const mediaDirectory = path.join(mediaRoot, "demo");
    const textbookDirectory = path.join(mediaDirectory, "textbook");
    const cardsDirectory = path.join(mediaDirectory, "cards");

    try {
      await mkdir(textbookDirectory, { recursive: true });
      await mkdir(cardsDirectory, { recursive: true });
      await writeMediaDocument(mediaDirectory, {
        mediaId: "media-demo",
        mediaSlug: "demo"
      });

      const result = await parseMediaDirectory(mediaDirectory);
      const emptyDirectoryIssues = result.issues.filter(
        (issue) => issue.code === "media.empty-directory"
      );

      expect(result.ok).toBe(false);
      expect(emptyDirectoryIssues).toHaveLength(2);
      expect(emptyDirectoryIssues).toContainEqual(
        expect.objectContaining({
          category: "integrity",
          location: expect.objectContaining({
            filePath: textbookDirectory
          })
        })
      );
      expect(emptyDirectoryIssues).toContainEqual(
        expect.objectContaining({
          category: "integrity",
          location: expect.objectContaining({
            filePath: cardsDirectory
          })
        })
      );
    } finally {
      await rm(mediaRoot, { recursive: true, force: true });
    }
  });
});

async function writeMediaBundle(
  contentRoot: string,
  input: {
    mediaSlug: string;
    mediaId: string;
    cardsFileId: string;
    cardId: string;
    crossMediaGrammarGroup?: string;
    crossMediaTermGroup?: string;
    sharedGrammarId: string;
    sharedTermId: string;
  }
) {
  const mediaDirectory = path.join(contentRoot, "media", input.mediaSlug);
  const cardsDirectory = path.join(mediaDirectory, "cards");
  const textbookDirectory = path.join(mediaDirectory, "textbook");

  await mkdir(cardsDirectory, { recursive: true });
  await mkdir(textbookDirectory, { recursive: true });
  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: ${input.mediaId}
slug: ${input.mediaSlug}
title: ${input.mediaSlug}
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
  );
  await writeFile(
    path.join(textbookDirectory, "001-intro.md"),
    `---
id: lesson-${input.mediaSlug}
media_id: ${input.mediaId}
slug: ${input.mediaSlug}-intro
title: ${input.mediaSlug} intro
order: 1
---

# Intro

Qui introduciamo [食べる](term:${input.sharedTermId}) e [～ている](grammar:${input.sharedGrammarId}).

:::grammar
id: ${input.sharedGrammarId}
${input.crossMediaGrammarGroup ? `cross_media_group: ${input.crossMediaGrammarGroup}` : ""}
pattern: ～ている
title: Forma in -te iru
meaning_it: azione in corso
:::
`
  );
  await writeFile(
    path.join(cardsDirectory, "001-core.md"),
    `---
id: ${input.cardsFileId}
media_id: ${input.mediaId}
slug: ${input.mediaSlug}-cards
title: ${input.mediaSlug} cards
order: 1
---

:::term
id: ${input.sharedTermId}
${input.crossMediaTermGroup ? `cross_media_group: ${input.crossMediaTermGroup}` : ""}
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
:::

:::card
id: ${input.cardId}
entry_type: term
entry_id: ${input.sharedTermId}
card_type: recognition
front: '{{食|た}}べる'
back: mangiare
:::
`
  );
}

async function writeMediaDocument(
  mediaDirectory: string,
  input: {
    mediaId: string;
    mediaSlug: string;
  }
) {
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(
    path.join(mediaDirectory, "media.md"),
    `---
id: ${input.mediaId}
slug: ${input.mediaSlug}
title: ${input.mediaSlug}
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
---
`
  );
}

async function writeLessonDocument(
  textbookDirectory: string,
  input: {
    mediaId: string;
    slugPrefix: string;
  }
) {
  await mkdir(textbookDirectory, { recursive: true });
  await writeFile(
    path.join(textbookDirectory, "001-intro.md"),
    `---
id: lesson-${input.slugPrefix}-intro
media_id: ${input.mediaId}
slug: ${input.slugPrefix}-intro
title: Intro
order: 1
---

# Intro
`
  );
}

async function writeCardsDocument(
  cardsDirectory: string,
  input: {
    mediaId: string;
    slugPrefix: string;
  }
) {
  await mkdir(cardsDirectory, { recursive: true });
  await writeFile(
    path.join(cardsDirectory, "001-core.md"),
    `---
id: cards-${input.slugPrefix}
media_id: ${input.mediaId}
slug: ${input.slugPrefix}-cards
title: Core cards
order: 1
---

:::term
id: term-${input.slugPrefix}
lemma: 食べる
reading: たべる
romaji: taberu
meaning_it: mangiare
:::

:::card
id: card-${input.slugPrefix}
entry_type: term
entry_id: term-${input.slugPrefix}
card_type: recognition
front: '{{食|た}}べる'
back: mangiare
:::
`
  );
}

async function listFilesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listFilesRecursively(entryPath);
      }

      return [entryPath];
    })
  );

  return nestedFiles.flat().sort();
}

function lineNumberOf(source: string, needle: string) {
  const index = source.indexOf(needle);

  if (index === -1) {
    throw new Error(`Could not find line marker: ${needle}`);
  }

  return source.slice(0, index).split("\n").length;
}

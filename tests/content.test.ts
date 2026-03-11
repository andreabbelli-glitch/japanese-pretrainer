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
import { parseInlineFragment } from "@/lib/content/parser/markdown";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repositoryRoot = path.join(__dirname, "..");
const contentLibraryRoot = path.join(repositoryRoot, "src", "lib", "content");
const demoMediaDirectory = path.join(
  repositoryRoot,
  "content",
  "media",
  "duel-masters-dm25"
);
const fixturesRoot = path.join(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");
const validMediaDirectory = path.join(validContentRoot, "media", "frieren");
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
const cardTextPlainScalarMediaDirectory = path.join(
  fixturesRoot,
  "invalid",
  "content",
  "media",
  "card-text-plain-scalar"
);

describe("content parser and validator", () => {
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

  it("tracks semantic references declared inside grammar notes", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-notes-"));
    const contentRoot = path.join(tempRoot, "content");
    const lessonPath = path.join(
      contentRoot,
      "media",
      "frieren",
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
        path.join(contentRoot, "media", "frieren")
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

    expect(result.data.media?.frontmatter.id).toBe("media-frieren");
    expect(result.data.lessons).toHaveLength(1);
    expect(result.data.cardFiles).toHaveLength(1);
    expect(result.data.terms).toHaveLength(1);
    expect(result.data.grammarPatterns).toHaveLength(1);
    expect(result.data.cards).toHaveLength(2);
    expect(result.data.references).toHaveLength(3);

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

  it("parses the real Duel Masters demo bundle", async () => {
    const result = await parseMediaDirectory(demoMediaDirectory);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.data.media?.frontmatter.id).toBe("media-duel-masters-dm25");
    expect(result.data.media?.frontmatter.title).toBe("Duel Masters");
    expect(result.data.lessons).toHaveLength(4);
    expect(result.data.cardFiles).toHaveLength(3);
    expect(result.data.terms).toHaveLength(49);
    expect(result.data.grammarPatterns).toHaveLength(12);
    expect(result.data.cards).toHaveLength(61);
    expect(result.data.references).toHaveLength(292);
    expect(
      result.data.lessons.map((lesson) => lesson.frontmatter.slug)
    ).toEqual([
      "tcg-core-overview",
      "tcg-core-patterns",
      "dm25-sd1-overview",
      "dm25-sd2-overview"
    ]);
    expect(result.data.cardFiles.map((file) => file.frontmatter.id)).toEqual([
      "cards-duel-masters-dm25-tcg-core-basics",
      "cards-duel-masters-dm25-dm25-sd1-core",
      "cards-duel-masters-dm25-dm25-sd2-core"
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
  });

  it("aggregates media bundles from the content root", async () => {
    const result = await parseContentRoot(validContentRoot);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.data.contentRoot).toBe(validContentRoot);
    expect(result.data.bundles).toHaveLength(1);
    expect(result.data.bundles[0]?.mediaSlug).toBe("frieren");
  });

  it("rejects duplicate IDs across different media bundles", async () => {
    const contentRoot = await mkdtemp(path.join(tmpdir(), "jcs-content-root-"));

    try {
      await writeMediaBundle(contentRoot, {
        mediaSlug: "alpha",
        mediaId: "media-alpha",
        cardsFileId: "cards-alpha",
        cardId: "card-alpha",
        sharedTermId: "term-shared"
      });
      await writeMediaBundle(contentRoot, {
        mediaSlug: "beta",
        mediaId: "media-beta",
        cardsFileId: "cards-beta",
        cardId: "card-beta",
        sharedTermId: "term-shared"
      });

      const result = await parseContentRoot(contentRoot);

      expect(result.ok).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "id.duplicate",
          category: "integrity",
          details: expect.objectContaining({
            namespace: "term",
            id: "term-shared",
            mediaBundleCount: 2
          })
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
front: 食べる
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
front: 食べる
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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonContent,
  lessonProgress,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import { importContentWorkspace } from "@/lib/content/importer";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import {
  getFuriganaMode,
  getTextbookIndexData,
  getTextbookLessonData,
  recordLessonOpened,
  setFuriganaMode,
  setLessonCompletionState
} from "@/lib/textbook";
import { parseTextbookDocument } from "@/lib/textbook-document";
import { renderFurigana } from "@/lib/render-furigana";
import {
  LessonArticle,
  formatCrossMediaHintLabel
} from "@/components/textbook/lesson-reader-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh() {}
  })
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validContentRoot = path.join(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

describe("textbook data", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-textbook-"));
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

  it("assembles textbook index and lesson reader data from imported records", async () => {
    const indexData = await getTextbookIndexData(
      developmentFixture.mediaSlug,
      database
    );
    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(indexData).not.toBeNull();
    expect(indexData?.furiganaMode).toBe("hover");
    expect(indexData?.resumeLesson?.slug).toBe("core-vocab");

    expect(lessonData).not.toBeNull();
    expect(lessonData?.entries.map((entry) => entry.label)).toEqual([
      "行く",
      "〜ている"
    ]);
    expect(
      lessonData?.entries.every(
        (entry) =>
          entry.kind === "card" ||
          !("crossMediaHint" in entry) ||
          entry.crossMediaHint === undefined
      )
    ).toBe(true);
    expect(lessonData?.lesson.ast?.blocks).toHaveLength(3);
    expect(lessonData?.lesson.ast?.blocks[1]).toMatchObject({
      type: "paragraph"
    });
  });

  it("normalizes legacy lesson AST payloads without crashing the reader", async () => {
    await database
      .update(lessonContent)
      .set({
        astJson: JSON.stringify({
          type: "root",
          children: [
            {
              type: "heading",
              depth: 1,
              value: "Core Vocabulary"
            },
            {
              type: "list",
              items: ["行く", "〜ている"]
            }
          ]
        }),
        htmlRendered:
          "<h1>Core Vocabulary</h1><ul><li>行く</li><li>〜ている</li></ul>"
      })
      .where(eq(lessonContent.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData).not.toBeNull();
    expect(lessonData?.lesson.ast?.blocks).toEqual([
      {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "Core Vocabulary" }]
      },
      {
        type: "list",
        ordered: false,
        start: null,
        items: [
          {
            type: "listItem",
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", value: "行く" }]
              }
            ]
          },
          {
            type: "listItem",
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", value: "〜ている" }]
              }
            ]
          }
        ]
      }
    ]);
  });

  it("preserves inline code nodes when lesson AST is reloaded from JSON", async () => {
    await database
      .update(lessonContent)
      .set({
        astJson: JSON.stringify({
          raw: "stub",
          blocks: [
            {
              type: "paragraph",
              children: [
                {
                  type: "inlineCode",
                  children: [{ type: "text", value: "AのB" }]
                },
                {
                  type: "text",
                  value: ' = "B di A".'
                }
              ]
            }
          ]
        }),
        htmlRendered: "<p><code>AのB</code> = &quot;B di A&quot;.</p>"
      })
      .where(eq(lessonContent.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData?.lesson.ast?.blocks).toEqual([
      {
        type: "paragraph",
        children: [
          {
            type: "inlineCode",
            children: [{ type: "text", value: "AのB" }]
          },
          {
            type: "text",
            value: ' = "B di A".'
          }
        ]
      }
    ]);
  });

  it("preserves grammar reading when lesson AST JSON is reloaded", () => {
    const document = parseTextbookDocument(
      JSON.stringify({
        raw: "stub",
        blocks: [
          {
            type: "grammarDefinition",
            entry: {
              id: "grammar-toki",
              kind: "grammar",
              pattern: "～時",
              title: "〜とき",
              reading: "とき / たとき",
              meaningIt: "quando",
              aliases: [],
              source: {
                filePath: "content/media/demo/textbook/001.md",
                documentKind: "lesson",
                documentId: "lesson-demo",
                sequence: 0
              }
            }
          }
        ]
      })
    );

    expect(document?.blocks).toEqual([
      {
        type: "grammarDefinition",
        entry: expect.objectContaining({
          id: "grammar-toki",
          reading: "とき / たとき"
        })
      }
    ]);
  });

  it("preserves structured definition notes when lesson AST JSON is reloaded", () => {
    const document = parseTextbookDocument(
      JSON.stringify({
        raw: "stub",
        blocks: [
          {
            type: "grammarDefinition",
            entry: {
              id: "grammar-teiru",
              kind: "grammar",
              pattern: "～ている",
              title: "Forma in -te iru",
              reading: "ている",
              meaningIt: "azione in corso",
              notesIt: {
                raw: "Nota con `[食べる](term:term-taberu)`.",
                nodes: [
                  { type: "text", value: "Nota con " },
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
                  },
                  { type: "text", value: "." }
                ]
              },
              aliases: [],
              source: {
                filePath: "content/media/demo/textbook/001.md",
                documentKind: "lesson",
                documentId: "lesson-demo",
                sequence: 0
              }
            }
          }
        ]
      })
    );

    expect(document?.blocks).toEqual([
      {
        type: "grammarDefinition",
        entry: expect.objectContaining({
          id: "grammar-teiru",
          notesIt: {
            raw: "Nota con `[食べる](term:term-taberu)`.",
            nodes: [
              { type: "text", value: "Nota con " },
              {
                type: "inlineCode",
                children: [
                  expect.objectContaining({
                    type: "reference",
                    targetType: "term",
                    targetId: "term-taberu",
                    display: "食べる"
                  })
                ]
              },
              { type: "text", value: "." }
            ]
          }
        })
      }
    ]);
  });

  it("renders note markdown through the inline AST renderer used by the textbook UI", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        ...renderFurigana(
          "Nota con **enfasi**, {{日本語|にほんご}} e `[食べる](term:term-taberu)`."
        )
      )
    );

    expect(markup).toContain("<strong>enfasi</strong>");
    expect(markup).toContain("<ruby>");
    expect(markup).toContain("<code");
    expect(markup).toContain("inline-ref");
    expect(markup).not.toContain("**enfasi**");
    expect(markup).not.toContain("{{日本語|にほんご}}");
    expect(markup).not.toContain("[食べる](term:term-taberu)");
  });

  it("renders example sentences with a collapsed italian translation toggle", () => {
    const markup = renderToStaticMarkup(
      createElement(LessonArticle, {
        activeEntryKey: null,
        document: {
          raw: "stub",
          blocks: [
            {
              type: "exampleSentence",
              sentence: {
                raw: "{{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}す。",
                nodes: [
                  {
                    type: "furigana",
                    raw: "{{自分|じぶん}}",
                    base: "自分",
                    reading: "じぶん"
                  },
                  {
                    type: "text",
                    value: "の"
                  },
                  {
                    type: "furigana",
                    raw: "{{墓地|ぼち}}",
                    base: "墓地",
                    reading: "ぼち"
                  },
                  {
                    type: "text",
                    value: "から"
                  },
                  {
                    type: "furigana",
                    raw: "{{出|だ}}す",
                    base: "出",
                    reading: "だ"
                  },
                  {
                    type: "text",
                    value: "す。"
                  }
                ]
              },
              translationIt: {
                raw: "Mettila in gioco dal tuo cimitero.",
                nodes: [
                  {
                    type: "text",
                    value: "Mettila in gioco dal tuo cimitero."
                  }
                ]
              }
            }
          ]
        },
        entriesByKey: new Map(),
        fallbackHtml: "",
        furiganaMode: "hover",
        isTouchLayout: false,
        mediaSlug: "demo-media",
        onImageExpand() {},
        onReferenceBlur() {},
        onReferenceClick() {},
        onReferenceFocus() {},
        onReferenceHover() {},
        onReferenceLeave() {}
      })
    );

    expect(markup).toContain("reader-example-sentence");
    expect(markup).toContain("Mostra traduzione italiana");
    expect(markup).toContain("Mettila in gioco dal tuo cimitero.");
    expect(markup).toContain("<details");
  });

  it("persists furigana preference and lesson progress changes", async () => {
    await setFuriganaMode("on", database);
    await database
      .update(lessonProgress)
      .set({
        status: "not_started",
        startedAt: null,
        completedAt: null,
        lastOpenedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
    await recordLessonOpened(developmentFixture.lessonId, database);
    await setLessonCompletionState(developmentFixture.lessonId, true, database);

    const furiganaMode = await getFuriganaMode(database);
    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(furiganaMode).toBe("on");
    expect(lessonData?.lesson.status).toBe("completed");
    expect(lessonData?.lesson.statusLabel).toBe("Completata");
  });

  it("loads textbook reader data from content imported through the real pipeline", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      mediaSlugs: ["frieren"],
      database
    });

    expect(result.status).toBe("completed");

    const indexData = await getTextbookIndexData("frieren", database);
    const lessonData = await getTextbookLessonData(
      "frieren",
      "ep01-intro",
      database
    );

    expect(indexData?.totalLessons).toBe(1);
    expect(indexData?.resumeLesson?.slug).toBe("ep01-intro");
    expect(lessonData?.entries.map((entry) => entry.label)).toEqual([
      "食べる",
      "～ている"
    ]);
    expect(
      lessonData?.lesson.ast?.blocks.some(
        (block) => block.type === "grammarDefinition"
      )
    ).toBe(true);
    expect(
      lessonData?.lesson.ast?.blocks.some(
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
  });

  it("resolves textbook tooltip entries inside the current media when source ids are reused across media", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const [alphaLesson, betaLesson] = await Promise.all([
      getTextbookLessonData(
        crossMediaFixture.alpha.mediaSlug,
        crossMediaFixture.alpha.lessonSlug,
        database
      ),
      getTextbookLessonData(
        crossMediaFixture.beta.mediaSlug,
        crossMediaFixture.beta.lessonSlug,
        database
      )
    ]);

    expect(
      alphaLesson?.entries.find((entry) => entry.kind === "term")?.id
    ).toBe(crossMediaFixture.alpha.termSourceId);
    expect(
      alphaLesson?.entries.find((entry) => entry.kind === "term")?.meaning
    ).toBe(crossMediaFixture.alpha.termMeaning);
    expect(
      alphaLesson?.entries.find((entry) => entry.kind === "term")
    ).toMatchObject({
      crossMediaHint: {
        otherMediaCount: 1
      }
    });
    expect(
      betaLesson?.entries.find((entry) => entry.kind === "term")?.meaning
    ).toBe(crossMediaFixture.beta.termMeaning);
    expect(
      betaLesson?.entries.find((entry) => entry.kind === "grammar")?.meaning
    ).toBe(crossMediaFixture.beta.grammarMeaning);
  });

  it("formats textbook cross-media hint labels with the correct singular and plural copy", () => {
    expect(formatCrossMediaHintLabel(1)).toBe(
      "Compare anche in 1 altro media."
    );
    expect(formatCrossMediaHintLabel(2)).toBe(
      "Compare anche in altri 2 media."
    );
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  getFuriganaMode,
  getTextbookIndexData,
  getTextbookLessonData,
  recordLessonOpened,
  setFuriganaMode,
  setLessonCompletionState
} from "@/lib/textbook";
import { parseTextbookDocument } from "@/lib/textbook-document";
import { renderFurigana } from "@/lib/render-furigana";

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
      "intro-vocab",
      database
    );

    expect(indexData).not.toBeNull();
    expect(indexData?.furiganaMode).toBe("hover");
    expect(indexData?.resumeLesson?.slug).toBe("intro-vocab");

    expect(lessonData).not.toBeNull();
    expect(lessonData?.entries.map((entry) => entry.label)).toEqual([
      "行く",
      "〜ている"
    ]);
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
              value: "Intro Vocab"
            },
            {
              type: "list",
              items: ["行く", "〜ている"]
            }
          ]
        }),
        htmlRendered: "<h1>Intro Vocab</h1><ul><li>行く</li><li>〜ている</li></ul>"
      })
      .where(eq(lessonContent.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "intro-vocab",
      database
    );

    expect(lessonData).not.toBeNull();
    expect(lessonData?.lesson.ast?.blocks).toEqual([
      {
        type: "heading",
        depth: 1,
        children: [{ type: "text", value: "Intro Vocab" }]
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
      "intro-vocab",
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
      "intro-vocab",
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
    const lessonData = await getTextbookLessonData("frieren", "ep01-intro", database);

    expect(indexData?.totalLessons).toBe(1);
    expect(indexData?.resumeLesson?.slug).toBe("ep01-intro");
    expect(lessonData?.entries.map((entry) => entry.label)).toEqual([
      "食べる",
      "～ている"
    ]);
    expect(lessonData?.lesson.ast?.blocks.some((block) => block.type === "grammarDefinition")).toBe(
      true
    );
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
});

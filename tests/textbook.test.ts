import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  card,
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
  applyLessonOpenedState,
  getFuriganaMode,
  getTextbookIndexData,
  getTextbookLessonData,
  getTextbookLessonTooltipEntries,
  recordLessonOpened,
  settleLessonOpenedStateForRender,
  setFuriganaMode,
  setLessonCompletionState
} from "@/lib/textbook";
import * as dataCache from "@/lib/data-cache";
import * as settings from "@/lib/settings";
import { applyLessonCompletionState } from "@/lib/textbook-reader-state";
import { parseTextbookDocument } from "@/lib/textbook-document";
import { renderFurigana } from "@/lib/render-furigana";
import {
  LessonArticle,
  areLessonRailPropsEqual,
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

async function writeGrammarReadingFallbackFixture(contentRoot: string) {
  const mediaSlug = "grammar-reading-fallback";
  const mediaId = "media-grammar-reading-fallback";
  const lessonId = "lesson-grammar-reading-fallback-intro";
  const mediaRoot = path.join(contentRoot, "media", mediaSlug);
  const textbookRoot = path.join(mediaRoot, "textbook");
  const cardsRoot = path.join(mediaRoot, "cards");

  await mkdir(textbookRoot, { recursive: true });
  await mkdir(cardsRoot, { recursive: true });

  await writeFile(
    path.join(mediaRoot, "media.md"),
    `---
id: ${mediaId}
slug: ${mediaSlug}
title: Grammar reading fallback
media_type: game
segment_kind: chapter
language: ja
base_explanation_language: it
status: active
---

# Grammar reading fallback

Bundle per testare il recupero della lettura dalle concept card.
`
  );

  await writeFile(
    path.join(textbookRoot, "001-intro.md"),
    `---
id: ${lessonId}
media_id: ${mediaId}
slug: intro
title: Intro
order: 1
segment_ref: chapter-01
status: active
---

# Intro

- [可能形](grammar:grammar-kanoukei)
- [た形](grammar:grammar-takei)
`
  );

  await writeFile(
    path.join(cardsRoot, "001-core.md"),
    `---
id: cards-${mediaSlug}-core
media_id: ${mediaId}
slug: ${mediaSlug}-core
title: Grammar reading fallback core
order: 1
segment_ref: chapter-01
---

:::grammar
id: grammar-kanoukei
pattern: 可能形
title: Forma potenziale
meaning_it: potere fare
:::

:::card
id: card-grammar-kanoukei-concept
lesson_id: ${lessonId}
entry_type: grammar
entry_id: grammar-kanoukei
card_type: concept
front: '{{可能形|か.のう.けい}}'
back: potere fare
:::

:::grammar
id: grammar-takei
pattern: た形
title: Passato / completamento
meaning_it: passato
:::

:::card
id: card-grammar-takei-concept
lesson_id: ${lessonId}
entry_type: grammar
entry_id: grammar-takei
card_type: concept
front: 'た{{形|けい}}'
back: passato
:::
`
  );
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve
  };
}

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
    expect(lessonData?.entries).toEqual([]);
    const tooltipEntries = await getTextbookLessonTooltipEntries(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );
    expect(tooltipEntries?.map((entry) => entry.label)).toEqual([
      "行く",
      "〜ている"
    ]);
    expect(
      tooltipEntries?.every((entry) => entry.crossMediaHint === undefined)
    ).toBe(true);
    expect(lessonData?.lesson.ast?.blocks).toHaveLength(3);
    expect(lessonData?.lesson.ast?.blocks[1]).toMatchObject({
      type: "paragraph"
    });
    expect(lessonData?.lesson).not.toHaveProperty("htmlRendered");
  });

  it("starts media and furigana lookups in parallel while loading a lesson", async () => {
    const mediaGate = createDeferred();
    const settingsGate = createDeferred();
    let mediaStarted = false;
    let settingsStarted = false;

    const originalMediaLookup = dataCache.getMediaBySlugCached;
    const originalFuriganaLookup = settings.getFuriganaModeSetting;
    const mediaLookupSpy = vi
      .spyOn(dataCache, "getMediaBySlugCached")
      .mockImplementation(async (...args) => {
        mediaStarted = true;
        const resultPromise = originalMediaLookup(...args);
        await mediaGate.promise;
        return resultPromise;
      });
    const settingsLookupSpy = vi
      .spyOn(settings, "getFuriganaModeSetting")
      .mockImplementation(async (...args) => {
        settingsStarted = true;
        const resultPromise = originalFuriganaLookup(...args);
        await settingsGate.promise;
        return resultPromise;
      });

    const lessonPromise = getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    await Promise.resolve();
    await Promise.resolve();

    try {
      expect(mediaStarted).toBe(true);
      expect(settingsStarted).toBe(true);
    } finally {
      mediaGate.resolve();
      settingsGate.resolve();
      await lessonPromise;
      mediaLookupSpy.mockRestore();
      settingsLookupSpy.mockRestore();
    }
  });

  it("reuses the resolved media row and furigana settings while loading a lesson", async () => {
    const mediaQuerySpy = vi.spyOn(database.query.media, "findFirst");
    const settingsQuerySpy = vi.spyOn(database.query.userSetting, "findMany");
    const lessonQuerySpy = vi.spyOn(database.query.lesson, "findFirst");

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData).not.toBeNull();
    expect(mediaQuerySpy).toHaveBeenCalledTimes(1);
    expect(settingsQuerySpy).toHaveBeenCalledTimes(1);
    expect(lessonQuerySpy).toHaveBeenCalledTimes(1);
    expect(lessonQuerySpy.mock.calls[0]?.[0]).toMatchObject({
      columns: {
        id: true
      },
      with: {
        content: {
          columns: {
            astJson: true
          }
        }
      }
    });
    expect(lessonQuerySpy.mock.calls[0]?.[0]?.with).not.toHaveProperty(
      "progress"
    );
    expect(lessonQuerySpy.mock.calls[0]?.[0]?.with).not.toHaveProperty(
      "segment"
    );

    mediaQuerySpy.mockRestore();
    settingsQuerySpy.mockRestore();
    lessonQuerySpy.mockRestore();
  });

  it("loads textbook tooltip entries without fetching the lesson AST", async () => {
    const lessonQuerySpy = vi.spyOn(database.query.lesson, "findFirst");

    const tooltipEntries = await getTextbookLessonTooltipEntries(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(tooltipEntries).not.toBeNull();
    expect(lessonQuerySpy).toHaveBeenCalledTimes(1);
    expect(lessonQuerySpy.mock.calls[0]?.[0]).toMatchObject({
      columns: {
        id: true
      }
    });
    expect(lessonQuerySpy.mock.calls[0]?.[0]).not.toHaveProperty("with");

    lessonQuerySpy.mockRestore();
  });

  it("returns null for a missing media slug before reading furigana settings", async () => {
    const settingsQuerySpy = vi
      .spyOn(settings, "getFuriganaModeSetting")
      .mockImplementation(async () => {
        throw new Error("furigana settings should not be read for missing media");
      });

    try {
      await expect(
        getTextbookIndexData("missing-media-slug", database)
      ).resolves.toBeNull();

      expect(settingsQuerySpy).not.toHaveBeenCalled();
    } finally {
      settingsQuerySpy.mockRestore();
    }
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

  it("returns a lesson without AST when structured content is unavailable", async () => {
    await database
      .update(lessonContent)
      .set({
        astJson: null,
        htmlRendered: "<p>Fallback <strong>HTML</strong>.</p>"
      })
      .where(eq(lessonContent.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData?.lesson.ast).toBeNull();
    expect(lessonData?.lesson).not.toHaveProperty("htmlRendered");
  });

  it("applies the opened lesson state without reloading the full lesson payload", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "not_started",
        startedAt: null,
        completedAt: null,
        lastOpenedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData?.lesson.status).toBe("not_started");

    const openedState = await recordLessonOpened(
      developmentFixture.lessonId,
      database
    );
    const patched = applyLessonOpenedState(lessonData!, openedState);

    expect(patched.lesson.status).toBe("in_progress");
    expect(
      patched.lessons.find(
        (lesson) => lesson.id === developmentFixture.lessonId
      )?.status
    ).toBe("in_progress");
  });

  it("keeps completed lesson progress completed when reopening the lesson", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        startedAt: "2026-03-09T10:00:00.000Z",
        completedAt: "2026-03-11T10:00:00.000Z",
        lastOpenedAt: "2026-03-10T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const openedState = await recordLessonOpened(
      developmentFixture.lessonId,
      database
    );
    const progress = await database.query.lessonProgress.findFirst({
      where: eq(lessonProgress.lessonId, developmentFixture.lessonId)
    });

    expect(openedState.status).toBe("completed");
    expect(openedState.startedAt).toBe("2026-03-09T10:00:00.000Z");
    expect(progress?.status).toBe("completed");
    expect(progress?.startedAt).toBe("2026-03-09T10:00:00.000Z");
    expect(progress?.completedAt).toBe("2026-03-11T10:00:00.000Z");
    expect(progress?.lastOpenedAt).toBe(openedState.lastOpenedAt);
    expect(progress?.lastOpenedAt).not.toBe("2026-03-10T10:00:00.000Z");
  });

  it("applies lesson completion locally without reloading the full lesson payload", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        startedAt: "2026-03-09T10:00:00.000Z",
        completedAt: null,
        lastOpenedAt: "2026-03-10T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData?.lesson.status).toBe("in_progress");
    expect(lessonData?.completedLessons).toBe(0);

    const patched = applyLessonCompletionState(lessonData!, true);

    expect(patched.lesson.status).toBe("completed");
    expect(patched.lesson.statusLabel).toBe("Completata");
    expect(patched.completedLessons).toBe(1);
    expect(
      patched.lessons.find(
        (lesson) => lesson.id === developmentFixture.lessonId
      )?.status
    ).toBe("completed");
    expect(patched.groups[0]?.completedLessons).toBe(1);
  });

  it("keeps a not started lesson untouched when clearing completion locally", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "not_started",
        startedAt: null,
        completedAt: null,
        lastOpenedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData?.lesson.status).toBe("not_started");

    const patched = applyLessonCompletionState(lessonData!, false);

    expect(patched).toBe(lessonData);
    expect(patched.lesson.status).toBe("not_started");
    expect(patched.completedLessons).toBe(0);
    expect(patched.groups[0]?.completedLessons).toBe(0);
  });

  it("updates opened timestamps even when the lesson status stays the same", async () => {
    await recordLessonOpened(developmentFixture.lessonId, database);

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData).not.toBeNull();

    const patched = applyLessonOpenedState(lessonData!, {
      lastOpenedAt: "2026-03-10T10:00:00.000Z",
      startedAt: "2026-03-09T10:00:00.000Z",
      status: "in_progress"
    });

    expect(
      patched.lessons.find(
        (lesson) => lesson.id === developmentFixture.lessonId
      )?.lastOpenedAt
    ).toBe("2026-03-10T10:00:00.000Z");
    expect(patched.activeLesson?.lastOpenedAt).toBe("2026-03-10T10:00:00.000Z");
    expect(patched.resumeLesson?.lastOpenedAt).toBe("2026-03-10T10:00:00.000Z");
  });

  it("skips lesson rail rerenders when reader-local state changes without touching lesson props", () => {
    const groups = [
      {
        completedLessons: 0,
        id: "group-a",
        lessons: [
          {
            completedAt: null,
            difficulty: null,
            excerpt: "Intro excerpt",
            id: "lesson-a",
            lastOpenedAt: null,
            orderIndex: 1,
            segmentId: "segment-a",
            segmentTitle: "Segment A",
            slug: "intro",
            status: "not_started" as const,
            statusLabel: "Da iniziare",
            summary: "Intro",
            title: "Intro"
          }
        ],
        note: null,
        title: "Capitolo 1",
        totalLessons: 1
      }
    ];
    const onNavigate = () => {};
    const previous = {
      activeLessonId: "lesson-a",
      compact: false,
      groups,
      mediaSlug: "sample-media",
      onNavigate
    };

    expect(areLessonRailPropsEqual(previous, { ...previous })).toBe(true);
    expect(
      areLessonRailPropsEqual(previous, {
        ...previous,
        activeLessonId: "lesson-b"
      })
    ).toBe(false);
    expect(
      areLessonRailPropsEqual(previous, {
        ...previous,
        groups: [
          {
            ...groups[0],
            completedLessons: 1,
            lessons: [
              {
                ...groups[0].lessons[0],
                completedAt: "2026-03-10T10:00:00.000Z",
                status: "completed",
                statusLabel: "Completata"
              }
            ]
          }
        ]
      })
    ).toBe(false);
  });

  it("keeps rendering textbook data when recording the opened lesson fails", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "not_started",
        startedAt: null,
        completedAt: null,
        lastOpenedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );
    const onError = vi.fn();
    const failure = new Error("write blocked");

    const settled = await settleLessonOpenedStateForRender(
      lessonData!,
      Promise.reject(failure),
      onError
    );

    expect(settled).toBe(lessonData);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("waits for the opened lesson state before rendering when the write resolves asynchronously", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "not_started",
        startedAt: null,
        completedAt: null,
        lastOpenedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const lessonData = await getTextbookLessonData(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(lessonData?.lesson.status).toBe("not_started");

    vi.useFakeTimers();

    try {
      const settledPromise = settleLessonOpenedStateForRender(
        lessonData!,
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              lastOpenedAt: "2026-03-10T10:00:00.000Z",
              startedAt: "2026-03-10T10:00:00.000Z",
              status: "in_progress" as const
            });
          }, 5);
        })
      );

      await vi.advanceTimersByTimeAsync(5);

      const settled = await settledPromise;

      expect(settled.lesson.status).toBe("in_progress");
      expect(
        settled.lessons.find(
          (lesson) => lesson.id === developmentFixture.lessonId
        )?.status
      ).toBe("in_progress");
    } finally {
      vi.useRealTimers();
    }
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
    expect(markup).toContain('<ruby class="app-ruby">');
    expect(markup).toContain("<code");
    expect(markup).toContain("inline-ref");
    expect(markup).not.toContain("**enfasi**");
    expect(markup).not.toContain("{{日本語|にほんご}}");
    expect(markup).not.toContain("[食べる](term:term-taberu)");
  });

  it("keeps lesson references interactive even before tooltip details are loaded", () => {
    const markup = renderToStaticMarkup(
      createElement(LessonArticle, {
        activeEntryKey: null,
        document: {
          raw: "stub",
          blocks: [
            {
              type: "paragraph",
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
          ]
        },
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

    expect(markup).toContain("<button");
    expect(markup).toContain("reader-ref");
    expect(markup).toContain("reader-ref--term");
    expect(markup).toContain("食べる");
  });

  it("renders an empty state when the lesson AST is unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(LessonArticle, {
        activeEntryKey: null,
        document: null,
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

    expect(markup).toContain("Contenuto non disponibile");
    expect(markup).toContain(
      "Questa lesson non ha un contenuto strutturato valido da mostrare."
    );
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

  it("can use the japanese sentence itself as the click-to-reveal summary", () => {
    const markup = renderToStaticMarkup(
      createElement(LessonArticle, {
        activeEntryKey: null,
        document: {
          raw: "stub",
          blocks: [
            {
              type: "exampleSentence",
              revealMode: "sentence",
              sentence: {
                raw: "このターンの後に自分のターンを追加する。",
                nodes: [
                  {
                    type: "text",
                    value: "このターンの後に自分のターンを追加する。"
                  }
                ]
              },
              translationIt: {
                raw: "Dopo questo turno, aggiungi un tuo turno.",
                nodes: [
                  {
                    type: "text",
                    value: "Dopo questo turno, aggiungi un tuo turno."
                  }
                ]
              }
            }
          ]
        },
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

    expect(markup).toContain("reader-example-sentence--sentence-toggle");
    expect(markup).toContain("reader-example-sentence__translation--sentence");
    expect(markup).toContain("<summary");
    expect(markup).toContain("このターンの後に自分のターンを追加する。");
    expect(markup).toContain("Dopo questo turno, aggiungi un tuo turno.");
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

  it("does not start a not started lesson when clearing completion in storage", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "not_started",
        startedAt: null,
        completedAt: null,
        lastOpenedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    await setLessonCompletionState(
      developmentFixture.lessonId,
      false,
      database
    );

    const progress = await database.query.lessonProgress.findFirst({
      where: eq(lessonProgress.lessonId, developmentFixture.lessonId)
    });

    expect(progress).not.toBeNull();
    expect(progress?.status).toBe("not_started");
    expect(progress?.startedAt).toBeNull();
    expect(progress?.completedAt).toBeNull();
    expect(progress?.lastOpenedAt).toBeNull();
  });

  it("loads textbook reader data from content imported through the real pipeline", async () => {
    const result = await importContentWorkspace({
      contentRoot: validContentRoot,
      mediaSlugs: ["sample-anime"],
      database
    });

    expect(result.status).toBe("completed");

    const indexData = await getTextbookIndexData("sample-anime", database);
    const lessonData = await getTextbookLessonData(
      "sample-anime",
      "ep01-intro",
      database
    );
    const tooltipEntries = await getTextbookLessonTooltipEntries(
      "sample-anime",
      "ep01-intro",
      database
    );

    expect(indexData?.totalLessons).toBe(1);
    expect(indexData?.resumeLesson?.slug).toBe("ep01-intro");
    expect(lessonData?.entries).toEqual([]);
    expect(tooltipEntries?.map((entry) => entry.label)).toEqual([
      "食べる",
      "～ている"
    ]);
    expect(tooltipEntries?.[0]).toMatchObject({
      kind: "term",
      pronunciation: {
        pitchAccent: {
          downstep: 2,
          shape: "nakadaka"
        },
        src: "/media/sample-anime/assets/audio/term/term-taberu/term-taberu.ogg"
      }
    });
    expect(tooltipEntries?.[1]).toMatchObject({
      kind: "grammar",
      pronunciation: {
        pitchAccent: {
          downstep: 0,
          shape: "heiban"
        },
        src: "/media/sample-anime/assets/audio/grammar/grammar-teiru/grammar-teiru.mp3"
      }
    });
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

  it("falls back to annotated grammar concept card fronts for tooltip furigana and reading", async () => {
    const contentRoot = path.join(tempDir, "grammar-reading-fallback-content");

    await writeGrammarReadingFallbackFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      mediaSlugs: ["grammar-reading-fallback"],
      database
    });

    expect(result.status).toBe("completed");

    const tooltipEntries = await getTextbookLessonTooltipEntries(
      "grammar-reading-fallback",
      "intro",
      database
    );

    expect(
      tooltipEntries?.filter((entry) => entry.kind === "grammar")
    ).toMatchObject([
      {
        label: "{{可能形|か.のう.けい}}",
        reading: "かのうけい"
      },
      {
        label: "た{{形|けい}}",
        reading: "たけい"
      }
    ]);
  });

  it("ignores suspended cards when deriving tooltip study state labels", async () => {
    await database
      .update(card)
      .set({
        status: "suspended"
      })
      .where(eq(card.id, developmentFixture.primaryCardId));

    const tooltipEntries = await getTextbookLessonTooltipEntries(
      developmentFixture.mediaSlug,
      "core-vocab",
      database
    );

    expect(
      tooltipEntries?.find((entry) => entry.kind === "term")?.statusLabel
    ).toBe("Disponibile");
    expect(
      tooltipEntries?.find((entry) => entry.kind === "grammar")?.statusLabel
    ).toBe("Già nota");
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
      getTextbookLessonTooltipEntries(
        crossMediaFixture.alpha.mediaSlug,
        crossMediaFixture.alpha.lessonSlug,
        database
      ),
      getTextbookLessonTooltipEntries(
        crossMediaFixture.beta.mediaSlug,
        crossMediaFixture.beta.lessonSlug,
        database
      )
    ]);

    expect(alphaLesson?.find((entry) => entry.kind === "term")?.id).toBe(
      crossMediaFixture.alpha.termSourceId
    );
    expect(alphaLesson?.find((entry) => entry.kind === "term")?.meaning).toBe(
      crossMediaFixture.alpha.termMeaning
    );
    expect(alphaLesson?.find((entry) => entry.kind === "term")).toMatchObject({
      crossMediaHint: {
        otherMediaCount: 1
      }
    });
    expect(betaLesson?.find((entry) => entry.kind === "term")?.meaning).toBe(
      crossMediaFixture.beta.termMeaning
    );
    expect(betaLesson?.find((entry) => entry.kind === "grammar")?.meaning).toBe(
      crossMediaFixture.beta.grammarMeaning
    );
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

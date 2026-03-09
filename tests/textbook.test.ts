import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
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

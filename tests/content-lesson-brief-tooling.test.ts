import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseMediaDirectory } from "@/features/content";
import { buildContentLessonBrief } from "@/features/content/tooling/lesson-brief";

import { validMediaDirectory } from "./helpers/content-fixtures";

describe("content lesson brief tooling", () => {
  it("collects lesson cards through card.lessonId", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const brief = buildContentLessonBrief({
      contentRoot: path.dirname(path.dirname(validMediaDirectory)),
      lessonSlug: "ep01-intro",
      mediaBundle: result.data,
      repositoryRoot: process.cwd()
    });

    expect(brief.files.cards).toEqual([
      "tests/fixtures/content/valid/content/media/sample-anime/cards/001-core.md"
    ]);
    expect(brief.cards.map((card) => card.id)).toEqual([
      "card-taberu-recognition",
      "card-teiru-concept"
    ]);
    expect(brief.entries.map((entry) => entry.id)).toEqual([
      "grammar-teiru",
      "term-taberu"
    ]);
    expect(brief.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audio: "ok",
          id: "grammar-teiru",
          pitch_accent: 0,
          reason: "carded+declared+referenced"
        }),
        expect.objectContaining({
          audio: "ok",
          id: "term-taberu",
          pitch_accent: 2,
          reason: "carded+referenced"
        })
      ])
    );
  });

  it("fails closed when the lesson slug is missing", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);
    expect(() =>
      buildContentLessonBrief({
        contentRoot: path.dirname(path.dirname(validMediaDirectory)),
        lessonSlug: "missing-lesson",
        mediaBundle: result.data,
        repositoryRoot: process.cwd()
      })
    ).toThrow("Lesson 'missing-lesson' was not found");
  });
});

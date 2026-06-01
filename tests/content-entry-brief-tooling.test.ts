import { describe, expect, it } from "vitest";

import { parseMediaDirectory } from "@/features/content";
import { buildContentEntryBrief } from "@/features/content/tooling/entry-brief";

import { validMediaDirectory } from "./helpers/content-fixtures";

describe("content entry brief tooling", () => {
  it("builds a parser-backed term brief", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const brief = buildContentEntryBrief({
      bundles: [result.data],
      entryId: "term-taberu",
      repositoryRoot: process.cwd()
    });

    expect("error" in brief).toBe(false);

    if ("error" in brief) {
      return;
    }

    expect(brief.entry).toMatchObject({
      audio: "ok",
      display: "食べる",
      id: "term-taberu",
      kind: "term",
      pitch_accent: 2,
      reading: "たべる"
    });
    expect(brief.cards.map((card) => card.id)).toEqual([
      "card-taberu-recognition"
    ]);
    expect(brief.lessons.map((lesson) => lesson.slug)).toEqual(["ep01-intro"]);
  });

  it("reports ambiguity when an exact alias matches more than one entry", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    result.data.grammarPatterns.push({
      ...result.data.grammarPatterns[0]!,
      aliases: ["taberu"],
      id: "grammar-tab-ambiguity",
      pattern: "taberu"
    });

    const brief = buildContentEntryBrief({
      bundles: [result.data],
      query: "taberu",
      repositoryRoot: process.cwd()
    });

    expect(brief).toMatchObject({
      error: "ambiguous",
      schema_version: 1
    });
  });

  it("caps ambiguous candidates in the JSON model", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    for (let index = 0; index < 25; index += 1) {
      result.data.grammarPatterns.push({
        ...result.data.grammarPatterns[0]!,
        aliases: ["taberu"],
        id: `grammar-tab-ambiguity-${index}`,
        pattern: `taberu-${index}`
      });
    }

    const brief = buildContentEntryBrief({
      bundles: [result.data],
      query: "taberu",
      repositoryRoot: process.cwd()
    });

    expect(brief).toMatchObject({
      error: "ambiguous",
      total_matches: 26,
      truncated: {
        candidates: true
      }
    });

    if (!("error" in brief)) {
      return;
    }

    expect(brief.candidates).toHaveLength(10);
  });

  it("caps lessons and cards in the JSON model", async () => {
    const result = await parseMediaDirectory(validMediaDirectory);

    expect(result.ok).toBe(true);

    const baseLesson = result.data.lessons[0]!;
    const baseCard = result.data.cards[0]!;

    for (let index = 0; index < 25; index += 1) {
      const lessonId = `lesson-extra-${index}`;

      result.data.lessons.push({
        ...baseLesson,
        frontmatter: {
          ...baseLesson.frontmatter,
          id: lessonId,
          order: 100 + index,
          slug: `extra-${index}`,
          title: `Extra ${index}`
        }
      });
      result.data.cards.push({
        ...baseCard,
        id: `card-extra-${index}`,
        lessonId,
        source: {
          ...baseCard.source,
          sequence: 100 + index
        }
      });
    }

    const brief = buildContentEntryBrief({
      bundles: [result.data],
      entryId: "term-taberu",
      repositoryRoot: process.cwd()
    });

    expect("error" in brief).toBe(false);

    if ("error" in brief) {
      return;
    }

    expect(brief.cards).toHaveLength(5);
    expect(brief.lessons).toHaveLength(10);
    expect(brief.truncated).toMatchObject({
      cards: true,
      lessons: true
    });
  });
});

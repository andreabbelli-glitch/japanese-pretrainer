import { describe, expect, it } from "vitest";

import {
  aggregateGlossaryLessonConnections,
  groupAliasesForGlossaryDetail
} from "@/features/glossary/model/detail-helpers";

describe("glossary detail helpers", () => {
  it("keeps sortOrder null when duplicate lesson links have no explicit order", () => {
    const result = aggregateGlossaryLessonConnections([
      {
        entryId: "term-1",
        entryType: "term",
        lessonId: "lesson-1",
        lessonOrderIndex: 1,
        lessonSlug: "intro",
        lessonSummary: null,
        lessonTitle: "Intro",
        linkRole: "mentioned",
        segmentId: null,
        segmentTitle: null,
        sortOrder: null
      },
      {
        entryId: "term-1",
        entryType: "term",
        lessonId: "lesson-1",
        lessonOrderIndex: 1,
        lessonSlug: "intro",
        lessonSummary: null,
        lessonTitle: "Intro",
        linkRole: "reviewed",
        segmentId: null,
        segmentTitle: null,
        sortOrder: null
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.sortOrder).toBeNull();
    expect(result[0]?.linkRoles).toEqual(["mentioned", "reviewed"]);
  });

  it("trims aliases, skips blanks, and deduplicates equivalent glossary chips", () => {
    expect(
      groupAliasesForGlossaryDetail([
        { text: " たべる ", type: "reading" },
        { text: "たべる", type: "reading" },
        { text: " taberu ", type: "romaji" },
        { text: "taberu", type: "romaji" },
        { text: "   " },
        { text: "mangiare" },
        { text: " mangiare " }
      ])
    ).toEqual([
      {
        label: "Letture",
        values: ["たべる"]
      },
      {
        label: "Romaji",
        values: ["taberu"]
      },
      {
        label: "Alias",
        values: ["mangiare"]
      }
    ]);
  });
});

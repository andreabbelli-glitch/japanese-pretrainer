import { describe, expect, it } from "vitest";

import { lookupContent } from "../src/features/content/tooling/lookup";
import type {
  NormalizedCard,
  NormalizedMediaBundle,
  NormalizedTerm,
  RichTextFragment
} from "../src/features/content/types";

describe("content lookup tooling", () => {
  it("continues checking cards when an exact entry match has no attached cards", () => {
    const bundle = buildLookupBundle({
      cards: [
        buildCard({
          entryId: "term-other",
          front: "重なる",
          id: "card-other-kasanaru"
        })
      ],
      terms: [
        buildTerm({
          id: "term-kasanaru",
          lemma: "重なる",
          reading: "かさなる"
        })
      ]
    });

    const result = lookupContent({
      bundles: [bundle],
      query: "重なる",
      repositoryRoot: "/repo"
    });

    expect(result.verdict).toBe("covered-card");
    expect(result.matches.map((match) => match.id)).toEqual([
      "term-kasanaru",
      "card-other-kasanaru"
    ]);
  });
});

function buildLookupBundle(input: {
  cards: NormalizedCard[];
  terms: NormalizedTerm[];
}): NormalizedMediaBundle {
  return {
    cardFiles: [],
    cards: input.cards,
    grammarPatterns: [],
    lessons: [],
    media: null,
    mediaDirectory: "/repo/content/media/lookup-fixture",
    mediaSlug: "lookup-fixture",
    references: [],
    terms: input.terms
  };
}

function buildTerm(input: {
  id: string;
  lemma: string;
  reading: string;
}): NormalizedTerm {
  return {
    aliases: [],
    id: input.id,
    kind: "term",
    lemma: input.lemma,
    meaningIt: "fixture",
    reading: input.reading,
    romaji: "fixture",
    source: {
      documentKind: "lesson",
      filePath: "/repo/content/media/lookup-fixture/textbook/001.md",
      sequence: 1
    }
  };
}

function buildCard(input: {
  entryId: string;
  front: string;
  id: string;
}): NormalizedCard {
  return {
    back: richText("fixture"),
    cardType: "recognition",
    entryId: input.entryId,
    entryType: "term",
    front: richText(input.front),
    id: input.id,
    kind: "card",
    lessonId: "lesson-lookup-fixture",
    source: {
      documentKind: "cards",
      filePath: "/repo/content/media/lookup-fixture/cards/001.md",
      sequence: 1
    },
    tags: []
  };
}

function richText(raw: string): RichTextFragment {
  return {
    nodes: [{ type: "text", value: raw }],
    raw
  };
}

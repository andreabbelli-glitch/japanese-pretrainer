import { describe, expect, it } from "vitest";

import {
  lookupContent,
  lookupContentBatch
} from "../src/features/content/tooling/lookup";
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

  it("runs batch lookups in input order with compact verdict counts", () => {
    const bundle = buildLookupBundle({
      cards: [
        buildCard({
          entryId: "term-taberu",
          front: "食べる",
          id: "card-taberu-recognition"
        })
      ],
      terms: [
        buildTerm({
          id: "term-taberu",
          lemma: "食べる",
          reading: "たべる"
        }),
        buildTerm({
          id: "term-kasanaru",
          lemma: "重なる",
          reading: "かさなる"
        })
      ]
    });

    const result = lookupContentBatch({
      bundles: [bundle],
      queries: [
        { kind: "all", query: "食べる" },
        { kind: "term", query: "重なる" },
        { kind: "all", query: "mangiare" }
      ],
      repositoryRoot: "/repo"
    });

    expect(result.summary).toEqual({
      coveredCard: 1,
      entryOnly: 1,
      new: 1,
      total: 3,
      truncated: 0
    });
    expect(result.results.map((lookup) => lookup.verdict)).toEqual([
      "covered-card",
      "entry-only",
      "new"
    ]);
    expect(result.results[0]?.query).toBe("食べる");
    expect(result.results[1]?.kind).toBe("term");
    expect(result.results[1]?.matches[0]?.id).toBe("term-kasanaru");
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

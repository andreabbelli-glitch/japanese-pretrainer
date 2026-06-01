import path from "node:path";

import { normalizeSearchText } from "../../study/model/search.ts";
import { stripInlineMarkdown } from "../../study/model/inline-markdown.ts";
import type { NormalizedCard, NormalizedMediaBundle } from "../types.ts";

export type ContentLookupKind = "all" | "card" | "grammar" | "term";
export type ContentLookupListKind = "cards" | "entries" | "lessons" | "media";
export type ContentLookupVerdict = "covered-card" | "entry-only" | "new";

export type ContentLookupMatch = {
  cards: ContentLookupCardSummary[];
  display: string;
  id: string;
  kind: "card" | "grammar" | "term";
  matchedFields: string[];
  mediaSlug: string;
  reading?: string;
  sourceFile: string;
};

export type ContentLookupCardSummary = {
  cardType: string;
  entryId: string;
  entryType: "grammar" | "term";
  front: string;
  id: string;
  sourceFile: string;
};

export type ContentLookupResult = {
  action: string;
  matches: ContentLookupMatch[];
  normalizedQuery: string;
  query: string;
  truncated: boolean;
  verdict: ContentLookupVerdict;
};

export type ContentListResult = {
  lines: string[];
  truncated: boolean;
};

type LookupEntry = {
  aliases: string[];
  cards: ContentLookupCardSummary[];
  display: string;
  id: string;
  kind: "grammar" | "term";
  mediaSlug: string;
  reading?: string;
  sourceFile: string;
};

type LookupCard = ContentLookupCardSummary & {
  kind: "card";
  mediaSlug: string;
};

export function lookupContent(input: {
  bundles: NormalizedMediaBundle[];
  kind?: ContentLookupKind;
  limit?: number;
  query: string;
  repositoryRoot?: string;
}) {
  const kind = input.kind ?? "all";
  const limit = Math.max(1, input.limit ?? 5);
  const index = buildLookupIndex(input.bundles, input.repositoryRoot);
  const normalizedQuery = normalizeLookupText(input.query);
  const matches = collectMatches({
    index,
    kind,
    normalizedQuery
  });
  const limitedMatches = matches.slice(0, limit);
  const verdict = resolveVerdict(matches);

  return {
    action: resolveAction(verdict),
    matches: limitedMatches,
    normalizedQuery,
    query: input.query,
    truncated: matches.length > limitedMatches.length,
    verdict
  } satisfies ContentLookupResult;
}

export function listContent(input: {
  bundles: NormalizedMediaBundle[];
  kind: ContentLookupListKind;
  limit?: number;
  repositoryRoot?: string;
}) {
  const limit = Math.max(1, input.limit ?? 100);
  const index = buildLookupIndex(input.bundles, input.repositoryRoot);
  let lines: string[];

  switch (input.kind) {
    case "media":
      lines = input.bundles.map((bundle) =>
        [
          "media",
          bundle.mediaSlug,
          bundle.media?.frontmatter.title ?? "(missing title)",
          `lessons=${bundle.lessons.length}`,
          `cards=${bundle.cards.length}`
        ].join(" ")
      );
      break;
    case "lessons":
      lines = input.bundles.flatMap((bundle) =>
        bundle.lessons
          .slice()
          .sort(
            (left, right) => left.frontmatter.order - right.frontmatter.order
          )
          .map((lesson) =>
            [
              "lesson",
              lesson.frontmatter.slug,
              `order=${lesson.frontmatter.order}`,
              quoteForLine(lesson.frontmatter.title),
              `@ ${relativeSource(lesson.sourceFile, input.repositoryRoot)}`
            ].join(" ")
          )
      );
      break;
    case "entries":
      lines = index.entries.map((entry) =>
        [
          entry.kind,
          entry.id,
          entry.display,
          entry.reading ? `reading=${entry.reading}` : null,
          `cards=${entry.cards.length}`,
          `@ ${entry.sourceFile}`
        ]
          .filter((value): value is string => value !== null)
          .join(" ")
      );
      break;
    case "cards":
      lines = index.cards.map((card) =>
        [
          "card",
          card.id,
          card.front,
          `entry=${card.entryType}:${card.entryId}`,
          `@ ${card.sourceFile}`
        ].join(" ")
      );
      break;
  }

  return {
    lines: lines.slice(0, limit),
    truncated: lines.length > limit
  } satisfies ContentListResult;
}

export function formatLookupResult(result: ContentLookupResult) {
  const lines = [`VERDICT ${result.verdict}`, `ACTION ${result.action}`];

  for (const match of result.matches) {
    lines.push(
      [
        "HIT",
        match.kind,
        match.id,
        quoteForLine(match.display),
        match.reading ? `reading=${match.reading}` : null,
        `matched=${match.matchedFields.join(",")}`,
        `cards=${match.cards.length}`,
        `@ ${match.sourceFile}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );

    for (const card of match.cards.slice(0, 2)) {
      lines.push(
        [
          "CARD",
          card.id,
          quoteForLine(card.front),
          `entry=${card.entryType}:${card.entryId}`,
          `@ ${card.sourceFile}`
        ].join(" ")
      );
    }
  }

  if (result.truncated) {
    lines.push("NOTE results truncated; rerun with --limit for more.");
  }

  return `${lines.join("\n")}\n`;
}

export function formatListResult(result: ContentListResult) {
  const lines = [...result.lines];

  if (result.truncated) {
    lines.push("NOTE results truncated; rerun with --limit for more.");
  }

  return `${lines.join("\n")}\n`;
}

function buildLookupIndex(
  bundles: NormalizedMediaBundle[],
  repositoryRoot = process.cwd()
) {
  const entries: LookupEntry[] = [];
  const cards: LookupCard[] = [];

  for (const bundle of bundles) {
    const cardsByEntry = new Map<string, ContentLookupCardSummary[]>();

    for (const card of bundle.cards) {
      const summary = buildCardSummary(card, repositoryRoot);
      const key = `${card.entryType}:${card.entryId}`;
      const existing = cardsByEntry.get(key) ?? [];

      existing.push(summary);
      cardsByEntry.set(key, existing);
      cards.push({
        ...summary,
        kind: "card",
        mediaSlug: bundle.mediaSlug
      });
    }

    for (const term of bundle.terms) {
      entries.push({
        aliases: term.aliases,
        cards: cardsByEntry.get(`term:${term.id}`) ?? [],
        display: term.lemma,
        id: term.id,
        kind: "term",
        mediaSlug: bundle.mediaSlug,
        reading: term.reading,
        sourceFile: relativeSource(term.source.filePath, repositoryRoot)
      });
    }

    for (const grammar of bundle.grammarPatterns) {
      entries.push({
        aliases: grammar.aliases,
        cards: cardsByEntry.get(`grammar:${grammar.id}`) ?? [],
        display: grammar.pattern,
        id: grammar.id,
        kind: "grammar",
        mediaSlug: bundle.mediaSlug,
        reading: grammar.reading,
        sourceFile: relativeSource(grammar.source.filePath, repositoryRoot)
      });
    }
  }

  return {
    cards: cards.sort(compareCards),
    entries: entries.sort(compareEntries)
  };
}

function collectMatches(input: {
  index: ReturnType<typeof buildLookupIndex>;
  kind: ContentLookupKind;
  normalizedQuery: string;
}) {
  const matches: ContentLookupMatch[] = [];

  if (input.kind !== "card") {
    for (const entry of input.index.entries) {
      if (input.kind !== "all" && input.kind !== entry.kind) {
        continue;
      }

      const matchedFields = getEntryMatchedFields(entry, input.normalizedQuery);

      if (matchedFields.length === 0) {
        continue;
      }

      matches.push({
        cards: entry.cards,
        display: entry.display,
        id: entry.id,
        kind: entry.kind,
        matchedFields,
        mediaSlug: entry.mediaSlug,
        reading: entry.reading,
        sourceFile: entry.sourceFile
      });
    }
  }

  if (input.kind === "all" || input.kind === "card") {
    const cardIdsAlreadyReported = new Set(
      matches.flatMap((match) => match.cards.map((card) => card.id))
    );

    for (const card of input.index.cards) {
      if (cardIdsAlreadyReported.has(card.id)) {
        continue;
      }

      const matchedFields = getCardMatchedFields(card, input.normalizedQuery);

      if (matchedFields.length === 0) {
        continue;
      }

      matches.push({
        cards: [card],
        display: card.front,
        id: card.id,
        kind: "card",
        matchedFields,
        mediaSlug: card.mediaSlug,
        sourceFile: card.sourceFile
      });
    }
  }

  return matches;
}

function getEntryMatchedFields(entry: LookupEntry, normalizedQuery: string) {
  const fields: string[] = [];

  if (normalizeLookupText(entry.id) === normalizedQuery) {
    fields.push("id");
  }

  if (normalizeLookupText(entry.display) === normalizedQuery) {
    fields.push("surface");
  }

  if (entry.reading && normalizeLookupText(entry.reading) === normalizedQuery) {
    fields.push("reading");
  }

  if (
    entry.kind === "term" &&
    entry.aliases.some(
      (alias) => normalizeLookupText(alias) === normalizedQuery
    )
  ) {
    fields.push("alias");
  }

  if (
    entry.kind === "grammar" &&
    entry.aliases.some(
      (alias) => normalizeLookupText(alias) === normalizedQuery
    )
  ) {
    fields.push("alias");
  }

  return fields;
}

function getCardMatchedFields(card: LookupCard, normalizedQuery: string) {
  const fields: string[] = [];

  if (normalizeLookupText(card.id) === normalizedQuery) {
    fields.push("id");
  }

  if (normalizeLookupText(card.front) === normalizedQuery) {
    fields.push("front");
  }

  return fields;
}

function resolveVerdict(matches: ContentLookupMatch[]): ContentLookupVerdict {
  if (
    matches.some((match) => match.kind === "card" || match.cards.length > 0)
  ) {
    return "covered-card";
  }

  if (
    matches.some((match) => match.kind === "grammar" || match.kind === "term")
  ) {
    return "entry-only";
  }

  return "new";
}

function resolveAction(verdict: ContentLookupVerdict) {
  switch (verdict) {
    case "covered-card":
      return "reuse existing card; do not create another review card.";
    case "entry-only":
      return "reuse existing entry_id; create a card only if the review surface deserves it.";
    case "new":
      return "no exact entry/card found; create only if editorial rules justify it.";
  }
}

function buildCardSummary(
  card: NormalizedCard,
  repositoryRoot: string
): ContentLookupCardSummary {
  return {
    cardType: card.cardType,
    entryId: card.entryId,
    entryType: card.entryType,
    front: stripInlineMarkdown(card.front.raw),
    id: card.id,
    sourceFile: relativeSource(card.source.filePath, repositoryRoot)
  };
}

function compareEntries(left: LookupEntry, right: LookupEntry) {
  return (
    left.mediaSlug.localeCompare(right.mediaSlug) ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function compareCards(left: LookupCard, right: LookupCard) {
  return (
    left.mediaSlug.localeCompare(right.mediaSlug) ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeLookupText(value: string) {
  return normalizeSearchText(
    stripOuterQuotes(stripInlineMarkdown(value))
  ).replace(/[~〜～]/g, "~");
}

function stripOuterQuotes(value: string) {
  const trimmed = value.trim();
  const pairs: Array<[string, string]> = [
    ["'", "'"],
    ['"', '"'],
    ["“", "”"],
    ["‘", "’"],
    ["「", "」"],
    ["『", "』"]
  ];

  for (const [open, close] of pairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return trimmed.slice(open.length, trimmed.length - close.length);
    }
  }

  return trimmed;
}

function quoteForLine(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function relativeSource(filePath: string, repositoryRoot = process.cwd()) {
  const relative = path.relative(repositoryRoot, filePath);

  return (relative.length > 0 ? relative : filePath).replaceAll("\\", "/");
}

import path from "node:path";

import { stripInlineMarkdown } from "../../study/model/inline-markdown.ts";
import {
  lintEditorialContent,
  type EditorialLintWarning
} from "./editorial-lint.ts";
import type {
  ContentBlock,
  InlineNode,
  NormalizedCard,
  NormalizedGrammarPattern,
  NormalizedLessonDocument,
  NormalizedMediaBundle,
  NormalizedTerm,
  RichTextFragment
} from "../types.ts";

export type ContentLessonBriefResult = {
  cards: LessonBriefCard[];
  commands: {
    import: string;
    validate: string;
  };
  entries: LessonBriefEntry[];
  files: {
    cards: string[];
    textbook: string;
  };
  images: LessonBriefImage[];
  lesson: {
    difficulty?: string;
    id: string;
    order: number;
    prerequisites: string[];
    segment_ref?: string;
    slug: string;
    summary?: string;
    tags: string[];
    title: string;
  };
  media: {
    id?: string;
    slug: string;
    title?: string;
  };
  outline: LessonBriefHeading[];
  references: LessonBriefReference[];
  schema_version: 1;
  truncated: {
    outline: boolean;
    warnings: boolean;
  };
  warnings: {
    items: LessonBriefWarning[];
    P0: number;
    P1: number;
    total: number;
  };
};

export type LessonBriefEntry = {
  audio: "missing" | "ok";
  cards: number;
  display: string;
  id: string;
  kind: "grammar" | "term";
  meaning_it: string;
  pitch_accent?: number;
  reading?: string;
  reason: string;
  source: string;
};

export type LessonBriefCard = {
  back: string;
  entry: string;
  example_it?: string;
  example_jp?: string;
  front: string;
  id: string;
  notes_it?: string;
  source: string;
  tags: string[];
  type: string;
};

export type LessonBriefHeading = {
  depth: number;
  text: string;
};

export type LessonBriefImage = {
  src: string;
};

export type LessonBriefReference = {
  display: string;
  target: string;
};

export type LessonBriefWarning = {
  code: string;
  location: string;
  severity: "P0" | "P1";
  snippet: string;
};

type EntryReason = "carded" | "declared" | "referenced";

export function buildContentLessonBrief(input: {
  mediaBundle: NormalizedMediaBundle;
  contentRoot: string;
  lessonSlug: string;
  outlineLimit?: number;
  repositoryRoot?: string;
  warningLimit?: number;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const outlineLimit = Math.max(1, input.outlineLimit ?? 10);
  const warningLimit = Math.max(1, input.warningLimit ?? 5);
  const lesson = input.mediaBundle.lessons.find(
    (candidate) => candidate.frontmatter.slug === input.lessonSlug
  );

  if (!lesson) {
    throw new Error(
      `Lesson '${input.lessonSlug}' was not found in media '${input.mediaBundle.mediaSlug}'.`
    );
  }

  const selectedCards = input.mediaBundle.cards
    .filter((card) => card.lessonId === lesson.frontmatter.id)
    .sort(compareCards);
  const cardsByEntry = groupCardsByEntry(selectedCards);
  const entryReasons = collectEntryReasons(
    input.mediaBundle,
    lesson,
    selectedCards
  );
  const entries = buildEntries({
    cardsByEntry,
    entryReasons,
    mediaBundle: input.mediaBundle,
    repositoryRoot
  });
  const outline = collectHeadings(lesson.body.blocks).slice(0, outlineLimit);
  const editorialLint = lintEditorialContent({
    bundles: [input.mediaBundle],
    lessonSlugs: [input.lessonSlug],
    limit: warningLimit,
    repositoryRoot
  });
  const cardFiles = [
    ...new Set(
      selectedCards.map((card) =>
        relativeSource(card.source.filePath, repositoryRoot)
      )
    )
  ].sort();

  return {
    cards: selectedCards.map((card) => buildCardBrief(card, repositoryRoot)),
    commands: buildCommands({
      contentRoot: input.contentRoot,
      lessonSlug: input.lessonSlug,
      mediaSlug: input.mediaBundle.mediaSlug,
      repositoryRoot
    }),
    entries,
    files: {
      cards: cardFiles,
      textbook: relativeSource(lesson.sourceFile, repositoryRoot)
    },
    images: collectImages(lesson.body.blocks),
    lesson: {
      id: lesson.frontmatter.id,
      order: lesson.frontmatter.order,
      prerequisites: lesson.frontmatter.prerequisites,
      slug: lesson.frontmatter.slug,
      tags: lesson.frontmatter.tags,
      title: lesson.frontmatter.title,
      ...(lesson.frontmatter.difficulty
        ? { difficulty: lesson.frontmatter.difficulty }
        : {}),
      ...(lesson.frontmatter.segmentRef
        ? { segment_ref: lesson.frontmatter.segmentRef }
        : {}),
      ...(lesson.frontmatter.summary
        ? { summary: lesson.frontmatter.summary }
        : {})
    },
    media: {
      slug: input.mediaBundle.mediaSlug,
      ...(input.mediaBundle.media?.frontmatter.id
        ? { id: input.mediaBundle.media.frontmatter.id }
        : {}),
      ...(input.mediaBundle.media?.frontmatter.title
        ? { title: input.mediaBundle.media.frontmatter.title }
        : {})
    },
    outline,
    references: buildReferences(input.mediaBundle, lesson),
    schema_version: 1,
    truncated: {
      outline: collectHeadings(lesson.body.blocks).length > outlineLimit,
      warnings: editorialLint.truncated
    },
    warnings: {
      items: editorialLint.warnings.map((warning) =>
        buildWarningBrief(warning, repositoryRoot)
      ),
      P0: editorialLint.counts.P0,
      P1: editorialLint.counts.P1,
      total: editorialLint.counts.total
    }
  } satisfies ContentLessonBriefResult;
}

export function formatContentLessonBrief(result: ContentLessonBriefResult) {
  const lines = [
    [
      "LESSON",
      `media=${result.media.slug}`,
      `slug=${result.lesson.slug}`,
      `id=${result.lesson.id}`,
      `order=${result.lesson.order}`,
      `segment=${result.lesson.segment_ref ?? "-"}`,
      `difficulty=${result.lesson.difficulty ?? "-"}`,
      `title=${quoteForLine(result.lesson.title)}`
    ].join(" "),
    [
      "FILES",
      `textbook=${result.files.textbook}`,
      `cards=${result.files.cards.length > 0 ? result.files.cards.join(",") : "none"}`
    ].join(" ")
  ];

  if (result.lesson.summary) {
    lines.push(`SUMMARY ${quoteForLine(result.lesson.summary)}`);
  }

  lines.push(
    `TAGS ${result.lesson.tags.length > 0 ? result.lesson.tags.join(",") : "none"}`
  );

  for (const heading of result.outline) {
    lines.push(`HEADING h${heading.depth} ${quoteForLine(heading.text)}`);
  }

  for (const entry of result.entries) {
    lines.push(
      [
        "ENTRY",
        entry.kind,
        entry.id,
        `display=${quoteForLine(entry.display)}`,
        entry.reading ? `reading=${entry.reading}` : null,
        `meaning=${quoteForLine(entry.meaning_it)}`,
        `cards=${entry.cards}`,
        `audio=${entry.audio}`,
        entry.pitch_accent !== undefined ? `pitch=${entry.pitch_accent}` : null,
        `reason=${entry.reason}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }

  for (const card of result.cards) {
    lines.push(
      [
        "CARD",
        card.id,
        `entry=${card.entry}`,
        `type=${card.type}`,
        `front=${quoteForLine(card.front)}`,
        `back=${quoteForLine(card.back)}`,
        result.files.cards.length > 1 ? `source=${card.source}` : null
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }

  for (const image of result.images) {
    lines.push(`IMAGE ${image.src}`);
  }

  if (result.references.length > 0) {
    lines.push(
      `REFS ${result.references
        .map(
          (reference) =>
            `${reference.target}=${quoteForCompact(reference.display)}`
        )
        .join(",")}`
    );
  } else {
    lines.push("REFS none");
  }

  lines.push(
    `WARNINGS total=${result.warnings.total} P0=${result.warnings.P0} P1=${result.warnings.P1}`
  );

  for (const warning of result.warnings.items) {
    lines.push(
      [
        "WARNING",
        warning.severity,
        warning.code,
        warning.location,
        `snippet=${quoteForLine(warning.snippet)}`
      ].join(" ")
    );
  }

  if (result.truncated.outline) {
    lines.push("NOTE outline truncated; rerun with --outline-limit for more.");
  }

  if (result.truncated.warnings) {
    lines.push("NOTE warnings truncated; rerun with --warning-limit for more.");
  }

  lines.push(`COMMAND validate=${quoteForLine(result.commands.validate)}`);
  lines.push(`COMMAND import=${quoteForLine(result.commands.import)}`);

  return `${lines.join("\n")}\n`;
}

function collectEntryReasons(
  mediaBundle: NormalizedMediaBundle,
  lesson: NormalizedLessonDocument,
  cards: NormalizedCard[]
) {
  const reasons = new Map<string, Set<EntryReason>>();

  for (const termId of lesson.declaredTermIds) {
    addEntryReason(reasons, `term:${termId}`, "declared");
  }

  for (const grammarId of lesson.declaredGrammarIds) {
    addEntryReason(reasons, `grammar:${grammarId}`, "declared");
  }

  for (const reference of mediaBundle.references) {
    if (
      reference.sourceDocumentKind === "lesson" &&
      reference.sourceDocumentId === lesson.frontmatter.id
    ) {
      addEntryReason(
        reasons,
        `${reference.referenceType}:${reference.targetId}`,
        "referenced"
      );
    }
  }

  for (const card of cards) {
    addEntryReason(reasons, `${card.entryType}:${card.entryId}`, "carded");
  }

  return reasons;
}

function addEntryReason(
  reasons: Map<string, Set<EntryReason>>,
  key: string,
  reason: EntryReason
) {
  const existing = reasons.get(key) ?? new Set<EntryReason>();

  existing.add(reason);
  reasons.set(key, existing);
}

function buildEntries(input: {
  cardsByEntry: Map<string, NormalizedCard[]>;
  entryReasons: Map<string, Set<EntryReason>>;
  mediaBundle: NormalizedMediaBundle;
  repositoryRoot: string;
}) {
  const termById = new Map(
    input.mediaBundle.terms.map((term) => [term.id, term])
  );
  const grammarById = new Map(
    input.mediaBundle.grammarPatterns.map((grammar) => [grammar.id, grammar])
  );
  const entries: LessonBriefEntry[] = [];

  for (const [key, reasons] of input.entryReasons) {
    const [kind, id] = key.split(":") as ["grammar" | "term", string];
    const entry = kind === "term" ? termById.get(id) : grammarById.get(id);

    if (!entry) {
      continue;
    }

    entries.push(
      buildEntryBrief({
        cards: input.cardsByEntry.get(key) ?? [],
        entry,
        reason: [...reasons].sort().join("+"),
        repositoryRoot: input.repositoryRoot
      })
    );
  }

  return entries.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id)
  );
}

function buildEntryBrief(input: {
  cards: NormalizedCard[];
  entry: NormalizedGrammarPattern | NormalizedTerm;
  reason: string;
  repositoryRoot: string;
}): LessonBriefEntry {
  const entry = input.entry;

  return {
    audio: entry.audio ? "ok" : "missing",
    cards: input.cards.length,
    display: entry.kind === "term" ? entry.lemma : entry.pattern,
    id: entry.id,
    kind: entry.kind,
    meaning_it: entry.meaningIt,
    ...(entry.pitchAccent !== undefined
      ? { pitch_accent: entry.pitchAccent }
      : {}),
    ...(entry.reading ? { reading: entry.reading } : {}),
    reason: input.reason,
    source: relativeSource(entry.source.filePath, input.repositoryRoot)
  };
}

function buildCardBrief(card: NormalizedCard, repositoryRoot: string) {
  return {
    back: compactText(card.back.raw),
    entry: `${card.entryType}:${card.entryId}`,
    front: compactText(card.front.raw),
    id: card.id,
    source: relativeSource(card.source.filePath, repositoryRoot),
    tags: card.tags,
    type: card.cardType,
    ...(card.exampleJp ? { example_jp: compactText(card.exampleJp.raw) } : {}),
    ...(card.exampleIt ? { example_it: compactText(card.exampleIt.raw) } : {}),
    ...(card.notesIt ? { notes_it: compactText(card.notesIt.raw) } : {})
  } satisfies LessonBriefCard;
}

function buildReferences(
  mediaBundle: NormalizedMediaBundle,
  lesson: NormalizedLessonDocument
) {
  const deduped = new Map<string, LessonBriefReference>();

  for (const reference of mediaBundle.references) {
    if (
      reference.sourceDocumentKind !== "lesson" ||
      reference.sourceDocumentId !== lesson.frontmatter.id
    ) {
      continue;
    }

    const key = `${reference.referenceType}:${reference.targetId}`;
    deduped.set(key, {
      display: reference.display,
      target: key
    });
  }

  return [...deduped.values()].sort((left, right) =>
    left.target.localeCompare(right.target)
  );
}

function buildWarningBrief(
  warning: EditorialLintWarning,
  repositoryRoot: string
) {
  return {
    code: warning.code,
    location: formatWarningLocation(warning, repositoryRoot),
    severity: warning.severity,
    snippet: warning.snippet
  } satisfies LessonBriefWarning;
}

function formatWarningLocation(
  warning: EditorialLintWarning,
  repositoryRoot: string
) {
  const line = warning.line ? `:${warning.line}` : "";
  const column = warning.line && warning.column ? `:${warning.column}` : "";

  return `${relativeSource(warning.filePath, repositoryRoot)}${line}${column}`;
}

function groupCardsByEntry(cards: NormalizedCard[]) {
  const grouped = new Map<string, NormalizedCard[]>();

  for (const card of cards) {
    const key = `${card.entryType}:${card.entryId}`;
    const existing = grouped.get(key) ?? [];

    existing.push(card);
    grouped.set(key, existing);
  }

  return grouped;
}

function collectHeadings(blocks: ContentBlock[]): LessonBriefHeading[] {
  const headings: LessonBriefHeading[] = [];

  for (const block of blocks) {
    if (block.type === "heading" && block.depth <= 2) {
      headings.push({
        depth: block.depth,
        text: inlineNodesToText(block.children)
      });
    }
  }

  return headings;
}

function collectImages(blocks: ContentBlock[]) {
  const images: LessonBriefImage[] = [];

  for (const block of blocks) {
    if (block.type === "image") {
      images.push({
        src: block.src
      });
      continue;
    }

    for (const child of childBlocks(block)) {
      images.push(...collectImages([child]));
    }
  }

  return images;
}

function childBlocks(block: ContentBlock): ContentBlock[] {
  switch (block.type) {
    case "blockquote":
      return block.children;
    case "list":
      return block.items.flatMap((item) => item.children);
    default:
      return [];
  }
}

function buildCommands(input: {
  contentRoot: string;
  lessonSlug: string;
  mediaSlug: string;
  repositoryRoot: string;
}) {
  return {
    import: [
      "./scripts/with-node.sh pnpm content:import --",
      ...buildContentRootArgs(input.contentRoot, input.repositoryRoot),
      "--media-slug",
      input.mediaSlug,
      "--lesson-slug",
      input.lessonSlug
    ].join(" "),
    validate: [
      "./scripts/with-node.sh pnpm content:validate --",
      ...buildContentRootArgs(input.contentRoot, input.repositoryRoot),
      "--media-slug",
      input.mediaSlug
    ].join(" ")
  };
}

function buildContentRootArgs(contentRoot: string, repositoryRoot: string) {
  const relativeContentRoot = relativeSource(contentRoot, repositoryRoot);

  return relativeContentRoot === "content"
    ? []
    : ["--content-root", relativeContentRoot];
}

function compareCards(left: NormalizedCard, right: NormalizedCard) {
  return (
    left.source.filePath.localeCompare(right.source.filePath) ||
    left.source.sequence - right.source.sequence ||
    left.id.localeCompare(right.id)
  );
}

function inlineNodesToText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "furigana":
          return node.base;
        case "reference":
        case "emphasis":
        case "strong":
        case "inlineCode":
        case "link":
          return inlineNodesToText(node.children);
        case "break":
          return " ";
      }
    })
    .join("")
    .replace(/\s+/gu, " ")
    .trim();
}

function compactText(value: string | RichTextFragment) {
  const raw = typeof value === "string" ? value : value.raw;
  return stripInlineMarkdown(raw).replace(/\s+/gu, " ").trim();
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

function quoteForCompact(value: string) {
  return JSON.stringify(value).slice(1, -1);
}

function relativeSource(filePath: string, repositoryRoot: string) {
  const relative = path
    .relative(repositoryRoot, path.resolve(filePath))
    .replaceAll("\\", "/");

  return relative.startsWith("..") || path.isAbsolute(relative)
    ? filePath.replaceAll("\\", "/")
    : relative;
}

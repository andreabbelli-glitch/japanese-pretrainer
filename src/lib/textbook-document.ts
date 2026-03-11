import type {
  CardDefinitionBlock,
  ContentBlock,
  ExampleSentenceBlock,
  GrammarDefinitionBlock,
  InlineNode,
  MarkdownDocument,
  NormalizedCard,
  NormalizedGrammarPattern,
  NormalizedTerm,
  RichTextFragment,
  TermDefinitionBlock
} from "@/lib/content/types";

type UnknownRecord = Record<string, unknown>;

export function parseTextbookDocument(astJson: string | null): MarkdownDocument | null {
  if (!astJson) {
    return null;
  }

  try {
    return normalizeMarkdownDocument(JSON.parse(astJson));
  } catch {
    return null;
  }
}

function normalizeMarkdownDocument(value: unknown): MarkdownDocument | null {
  if (!isRecord(value)) {
    return null;
  }

  const raw = typeof value.raw === "string" ? value.raw : "";
  const blocksSource = Array.isArray(value.blocks)
    ? value.blocks
    : value.type === "root" && Array.isArray(value.children)
      ? value.children
      : null;

  if (!blocksSource) {
    return null;
  }

  return {
    raw,
    blocks: blocksSource
      .map((block) => normalizeBlock(block))
      .filter((block): block is ContentBlock => block !== null)
  };
}

function normalizeBlock(value: unknown): ContentBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "paragraph":
      return {
        type: "paragraph",
        children: normalizeInlineChildren(value)
      };
    case "heading":
      return {
        type: "heading",
        depth: normalizeHeadingDepth(value.depth),
        children: normalizeInlineChildren(value)
      };
    case "list":
      return {
        type: "list",
        ordered: typeof value.ordered === "boolean" ? value.ordered : false,
        start: typeof value.start === "number" ? value.start : null,
        items: normalizeListItems(value.items ?? value.children)
      };
    case "blockquote":
      return {
        type: "blockquote",
        children: normalizeBlocks(value.children)
      };
    case "code":
      return {
        type: "code",
        lang: typeof value.lang === "string" ? value.lang : null,
        meta: typeof value.meta === "string" ? value.meta : null,
        value: typeof value.value === "string" ? value.value : ""
      };
    case "thematicBreak":
      return {
        type: "thematicBreak"
      };
    case "exampleSentence": {
      const sentence =
        normalizeRichTextFragment(value.sentence) ??
        (typeof value.jp === "string"
          ? {
            raw: value.jp,
            nodes: [{ type: "text" as const, value: value.jp }]
          }
          : null);
      const translationIt =
        normalizeRichTextFragment(value.translationIt) ??
        (typeof value.translation_it === "string"
          ? {
            raw: value.translation_it,
            nodes: [{ type: "text" as const, value: value.translation_it }]
          }
          : null);

      if (!sentence || !translationIt) {
        return null;
      }

      const block: ExampleSentenceBlock = {
        type: "exampleSentence",
        sentence,
        translationIt
      };

      return block;
    }
    case "termDefinition": {
      const entry = normalizeTerm(value.entry);

      if (!entry) {
        return null;
      }

      const block: TermDefinitionBlock = {
        type: "termDefinition",
        entry
      };

      return block;
    }
    case "grammarDefinition": {
      const entry = normalizeGrammar(value.entry);

      if (!entry) {
        return null;
      }

      const block: GrammarDefinitionBlock = {
        type: "grammarDefinition",
        entry
      };

      return block;
    }
    case "cardDefinition": {
      const card = normalizeCard(value.card);

      if (!card) {
        return null;
      }

      const block: CardDefinitionBlock = {
        type: "cardDefinition",
        card
      };

      return block;
    }
    default:
      return null;
  }
}

function normalizeBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((block) => normalizeBlock(block))
    .filter((block): block is ContentBlock => block !== null);
}

function normalizeListItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeListItem(item))
    .filter((item): item is Extract<ContentBlock, { type: "list" }>["items"][number] => item !== null);
}

function normalizeListItem(value: unknown) {
  if (typeof value === "string") {
    return buildTextListItem(value);
  }

  if (!isRecord(value)) {
    return null;
  }

  if (value.type === "listItem") {
    const children = normalizeBlocks(value.children);

    if (children.length > 0) {
      return {
        type: "listItem" as const,
        children
      };
    }

    const inlineChildren = normalizeInlineChildren(value);

    if (inlineChildren.length > 0) {
      return {
        type: "listItem" as const,
        children: [
          {
            type: "paragraph" as const,
            children: inlineChildren
          }
        ]
      };
    }
  }

  if (typeof value.value === "string") {
    return buildTextListItem(value.value);
  }

  return null;
}

function buildTextListItem(value: string) {
  return {
    type: "listItem" as const,
    children: [
      {
        type: "paragraph" as const,
        children: [{ type: "text" as const, value }]
      }
    ]
  };
}

function normalizeInlineChildren(value: UnknownRecord): InlineNode[] {
  if (Array.isArray(value.children)) {
    return normalizeInlineNodes(value.children);
  }

  if (typeof value.value === "string") {
    return [{ type: "text", value: value.value }];
  }

  return [];
}

function normalizeInlineNodes(value: unknown): InlineNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((node) => normalizeInlineNode(node));
}

function normalizeInlineNode(value: unknown): InlineNode[] {
  if (typeof value === "string") {
    return [{ type: "text", value }];
  }

  if (!isRecord(value) || typeof value.type !== "string") {
    if (isRecord(value) && typeof value.value === "string") {
      return [{ type: "text", value: value.value }];
    }

    return [];
  }

  switch (value.type) {
    case "text":
      return typeof value.value === "string" ? [{ type: "text", value: value.value }] : [];
    case "furigana":
      return typeof value.base === "string" && typeof value.reading === "string"
        ? [
          {
            type: "furigana",
            raw:
              typeof value.raw === "string"
                ? value.raw
                : `{{${value.base}|${value.reading}}}`,
            base: value.base,
            reading: value.reading
          }
        ]
        : [];
    case "reference": {
      const targetType =
        value.targetType === "term" || value.entryType === "term"
          ? "term"
          : value.targetType === "grammar" || value.entryType === "grammar"
            ? "grammar"
            : null;
      const targetId =
        typeof value.targetId === "string"
          ? value.targetId
          : typeof value.entryId === "string"
            ? value.entryId
            : null;

      if (!targetType || !targetId) {
        return normalizeInlineChildren(value);
      }

      const children: InlineNode[] =
        normalizeInlineNodes(value.children).length > 0
          ? normalizeInlineNodes(value.children)
          : typeof value.display === "string"
            ? [{ type: "text", value: value.display }]
            : typeof value.value === "string"
              ? [{ type: "text", value: value.value }]
              : [];

      return [
        {
          type: "reference",
          raw:
            typeof value.raw === "string"
              ? value.raw
              : typeof value.display === "string"
                ? value.display
                : children.map((node) => extractInlineText(node)).join(""),
          display:
            typeof value.display === "string"
              ? value.display
              : children.map((node) => extractInlineText(node)).join(""),
          targetType,
          targetId,
          children
        }
      ];
    }
    case "emphasis":
      return [
        {
          type: "emphasis",
          children: normalizeInlineNodes(value.children)
        }
      ];
    case "strong":
      return [
        {
          type: "strong",
          children: normalizeInlineNodes(value.children)
        }
      ];
    case "inlineCode":
      if (Array.isArray(value.children)) {
        const children = normalizeInlineNodes(value.children);

        return children.length > 0
          ? [{ type: "inlineCode", children }]
          : [];
      }

      return typeof value.value === "string"
        ? [{ type: "inlineCode", children: [{ type: "text", value: value.value }] }]
        : [];
    case "link":
      return typeof value.url === "string"
        ? [
          {
            type: "link",
            url: value.url,
            title:
              typeof value.title === "string" || value.title === null
                ? value.title
                : undefined,
            children: normalizeInlineNodes(value.children)
          }
        ]
        : normalizeInlineChildren(value);
    case "break":
      return [{ type: "break" }];
    default:
      return typeof value.value === "string" ? [{ type: "text", value: value.value }] : [];
  }
}

function normalizeTerm(value: unknown): NormalizedTerm | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.lemma !== "string" ||
    typeof value.reading !== "string" ||
    typeof value.romaji !== "string" ||
    typeof value.meaningIt !== "string"
  ) {
    return null;
  }

  return {
    kind: "term",
    id: value.id,
    lemma: value.lemma,
    reading: value.reading,
    romaji: value.romaji,
    meaningIt: value.meaningIt,
    pos: typeof value.pos === "string" ? value.pos : undefined,
    meaningLiteralIt:
      typeof value.meaningLiteralIt === "string" ? value.meaningLiteralIt : undefined,
    notesIt: normalizeRichTextFragment(value.notesIt) ?? undefined,
    levelHint: typeof value.levelHint === "string" ? value.levelHint : undefined,
    aliases: normalizeStringArray(value.aliases),
    segmentRef: typeof value.segmentRef === "string" ? value.segmentRef : undefined,
    source: {
      filePath:
        isRecord(value.source) && typeof value.source.filePath === "string"
          ? value.source.filePath
          : "",
      documentKind:
        isRecord(value.source) && value.source.documentKind === "cards"
          ? "cards"
          : "lesson",
      sequence:
        isRecord(value.source) && typeof value.source.sequence === "number"
          ? value.source.sequence
          : 0,
      documentId:
        isRecord(value.source) && typeof value.source.documentId === "string"
          ? value.source.documentId
          : undefined,
      documentOrder:
        isRecord(value.source) && typeof value.source.documentOrder === "number"
          ? value.source.documentOrder
          : undefined,
      segmentRef:
        isRecord(value.source) && typeof value.source.segmentRef === "string"
          ? value.source.segmentRef
          : undefined
    }
  };
}

function normalizeGrammar(value: unknown): NormalizedGrammarPattern | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.pattern !== "string" ||
    typeof value.title !== "string" ||
    typeof value.meaningIt !== "string"
  ) {
    return null;
  }

  return {
    kind: "grammar",
    id: value.id,
    pattern: value.pattern,
    title: value.title,
    reading: typeof value.reading === "string" ? value.reading : undefined,
    meaningIt: value.meaningIt,
    notesIt: normalizeRichTextFragment(value.notesIt) ?? undefined,
    levelHint: typeof value.levelHint === "string" ? value.levelHint : undefined,
    aliases: normalizeStringArray(value.aliases),
    segmentRef: typeof value.segmentRef === "string" ? value.segmentRef : undefined,
    source: {
      filePath:
        isRecord(value.source) && typeof value.source.filePath === "string"
          ? value.source.filePath
          : "",
      documentKind:
        isRecord(value.source) && value.source.documentKind === "cards"
          ? "cards"
          : "lesson",
      sequence:
        isRecord(value.source) && typeof value.source.sequence === "number"
          ? value.source.sequence
          : 0,
      documentId:
        isRecord(value.source) && typeof value.source.documentId === "string"
          ? value.source.documentId
          : undefined,
      documentOrder:
        isRecord(value.source) && typeof value.source.documentOrder === "number"
          ? value.source.documentOrder
          : undefined,
      segmentRef:
        isRecord(value.source) && typeof value.source.segmentRef === "string"
          ? value.source.segmentRef
          : undefined
    }
  };
}

function normalizeCard(value: unknown): NormalizedCard | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    (value.entryType !== "term" && value.entryType !== "grammar") ||
    typeof value.entryId !== "string" ||
    typeof value.cardType !== "string"
  ) {
    return null;
  }

  const front = normalizeRichTextFragment(value.front);
  const back = normalizeRichTextFragment(value.back);

  if (!front || !back) {
    return null;
  }

  return {
    kind: "card",
    id: value.id,
    entryType: value.entryType,
    entryId: value.entryId,
    cardType: value.cardType,
    front,
    back,
    notesIt: normalizeRichTextFragment(value.notesIt) ?? undefined,
    tags: normalizeStringArray(value.tags),
    source: {
      filePath:
        isRecord(value.source) && typeof value.source.filePath === "string"
          ? value.source.filePath
          : "",
      documentKind:
        isRecord(value.source) && value.source.documentKind === "cards"
          ? "cards"
          : "lesson",
      sequence:
        isRecord(value.source) && typeof value.source.sequence === "number"
          ? value.source.sequence
          : 0,
      documentId:
        isRecord(value.source) && typeof value.source.documentId === "string"
          ? value.source.documentId
          : undefined,
      documentOrder:
        isRecord(value.source) && typeof value.source.documentOrder === "number"
          ? value.source.documentOrder
          : undefined,
      segmentRef:
        isRecord(value.source) && typeof value.source.segmentRef === "string"
          ? value.source.segmentRef
          : undefined
    }
  };
}

function normalizeRichTextFragment(value: unknown): RichTextFragment | null {
  if (typeof value === "string") {
    return {
      raw: value,
      nodes: [{ type: "text", value }]
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.raw !== "string" || !Array.isArray(value.nodes)) {
    return null;
  }

  return {
    raw: value.raw,
    nodes: normalizeInlineNodes(value.nodes)
  };
}

function normalizeHeadingDepth(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 1;
  }

  return Math.max(1, Math.min(6, Math.trunc(value)));
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function extractInlineText(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "furigana":
      return node.base;
    case "reference":
    case "emphasis":
    case "strong":
    case "link":
      return node.children.map((child) => extractInlineText(child)).join("");
    case "inlineCode":
      return node.children.map((child) => extractInlineText(child)).join("");
    case "break":
      return " ";
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

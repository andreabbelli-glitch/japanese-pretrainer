import { createHash } from "node:crypto";
import path from "node:path";

import type {
  ContentBlock,
  GrammarDefinitionBlock,
  InlineNode,
  MarkdownDocument,
  NormalizedGrammarPattern,
  NormalizedTerm,
  RichTextFragment,
  TermDefinitionBlock
} from "../types.ts";
import { normalizeSearchText } from "../../study-search.ts";

export { normalizeGrammarSearchText, normalizeSearchText } from "../../study-search.ts";

export function buildDeterministicId(
  namespace: string,
  ...parts: Array<string | number | null | undefined>
) {
  const hash = createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("\u001f"))
    .digest("hex")
    .slice(0, 20);

  return `${namespace}_${hash}`;
}

export function normalizeSourceFile(
  contentRoot: string,
  sourceFile: string
): string {
  const relativePath = path.relative(contentRoot, sourceFile);

  if (!relativePath.startsWith("..")) {
    return relativePath.split(path.sep).join("/");
  }

  return sourceFile.split(path.sep).join("/");
}

export function inferTermAliasType(
  aliasText: string,
  readingNorm: string,
  romajiNorm: string
) {
  const aliasNorm = normalizeSearchText(aliasText);

  if (aliasNorm === readingNorm) {
    return "reading";
  }

  if (aliasNorm === romajiNorm || /^[a-z0-9 -]+$/i.test(aliasNorm)) {
    return "romaji";
  }

  return "alt";
}

export function resolveEntrySegmentRef(input: {
  segmentRef?: string;
  sourceSegmentRef?: string;
}) {
  return input.segmentRef ?? input.sourceSegmentRef ?? undefined;
}

export function humanizeSegmentSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return part;
      }

      return part[0]?.toUpperCase().concat(part.slice(1)) ?? part;
    })
    .join(" ");
}

export function renderLessonHtml(document: MarkdownDocument): string {
  return document.blocks.map((block) => renderBlock(block)).join("");
}

export function buildLessonExcerpt(
  document: MarkdownDocument,
  maxLength = 400
): string | null {
  const plainText = document.blocks
    .map((block) => extractBlockText(block))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length === 0) {
    return null;
  }

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength - 1).trimEnd()}…`;
}

export function collectReferenceKeysFromRichText(fragment?: RichTextFragment) {
  if (!fragment) {
    return [];
  }

  return dedupeReferenceKeys(collectReferenceKeysFromInlineNodes(fragment.nodes));
}

export function collectReferenceKeysFromBlocks(blocks: ContentBlock[]) {
  const keys = blocks.flatMap((block) => collectReferenceKeysFromBlock(block));

  return dedupeReferenceKeys(keys);
}

function renderBlock(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${renderInlineNodes(block.children)}</p>`;
    case "heading":
      return `<h${block.depth}>${renderInlineNodes(block.children)}</h${block.depth}>`;
    case "list":
      return renderList(block);
    case "blockquote":
      return `<blockquote>${block.children.map((child) => renderBlock(child)).join("")}</blockquote>`;
    case "code": {
      const className = block.lang
        ? ` class="language-${escapeHtml(block.lang)}"`
        : "";

      return `<pre><code${className}>${escapeHtml(block.value)}</code></pre>`;
    }
    case "thematicBreak":
      return "<hr />";
    case "termDefinition":
      return renderTermDefinition(block);
    case "grammarDefinition":
      return renderGrammarDefinition(block);
    case "cardDefinition":
      return [
        `<section class="card-definition" data-card-id="${escapeAttribute(block.card.id)}">`,
        `<div class="card-front">${renderInlineNodes(block.card.front.nodes)}</div>`,
        `<div class="card-back">${renderInlineNodes(block.card.back.nodes)}</div>`,
        block.card.notesIt
          ? `<div class="card-notes">${renderInlineNodes(block.card.notesIt.nodes)}</div>`
          : "",
        "</section>"
      ].join("");
  }
}

function renderList(block: Extract<ContentBlock, { type: "list" }>) {
  const tagName = block.ordered ? "ol" : "ul";
  const startAttribute =
    block.ordered && block.start && block.start !== 1
      ? ` start="${block.start}"`
      : "";

  return `<${tagName}${startAttribute}>${block.items
    .map((item) => `<li>${item.children.map((child) => renderBlock(child)).join("")}</li>`)
    .join("")}</${tagName}>`;
}

function renderTermDefinition(block: TermDefinitionBlock) {
  const entry = block.entry;
  const aliases =
    entry.aliases.length > 0
      ? `<p class="entry-aliases">${escapeHtml(entry.aliases.join(", "))}</p>`
      : "";
  const notes = entry.notesIt
    ? `<p class="entry-notes">${escapeHtml(entry.notesIt)}</p>`
    : "";

  return [
    `<section class="term-definition" data-entry-type="term" data-entry-id="${escapeAttribute(entry.id)}">`,
    `<h2>${escapeHtml(entry.lemma)}</h2>`,
    `<p>${escapeHtml(entry.reading)} / ${escapeHtml(entry.romaji)}</p>`,
    `<p>${escapeHtml(entry.meaningIt)}</p>`,
    aliases,
    notes,
    "</section>"
  ].join("");
}

function renderGrammarDefinition(block: GrammarDefinitionBlock) {
  const entry = block.entry;
  const aliases =
    entry.aliases.length > 0
      ? `<p class="entry-aliases">${escapeHtml(entry.aliases.join(", "))}</p>`
      : "";
  const notes = entry.notesIt
    ? `<p class="entry-notes">${escapeHtml(entry.notesIt)}</p>`
    : "";

  return [
    `<section class="grammar-definition" data-entry-type="grammar" data-entry-id="${escapeAttribute(entry.id)}">`,
    `<h2>${escapeHtml(entry.title)}</h2>`,
    `<p>${escapeHtml(entry.pattern)}</p>`,
    `<p>${escapeHtml(entry.meaningIt)}</p>`,
    aliases,
    notes,
    "</section>"
  ].join("");
}

function renderInlineNodes(nodes: InlineNode[]): string {
  return nodes.map((node) => renderInlineNode(node)).join("");
}

function renderInlineNode(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.value);
    case "furigana":
      return `<ruby><rb>${escapeHtml(node.base)}</rb><rt>${escapeHtml(node.reading)}</rt></ruby>`;
    case "reference":
      return [
        `<span class="content-entry-ref" data-entry-type="${escapeAttribute(node.targetType)}" data-entry-id="${escapeAttribute(node.targetId)}">`,
        renderInlineNodes(node.children),
        "</span>"
      ].join("");
    case "emphasis":
      return `<em>${renderInlineNodes(node.children)}</em>`;
    case "strong":
      return `<strong>${renderInlineNodes(node.children)}</strong>`;
    case "inlineCode":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "link": {
      const titleAttribute = node.title
        ? ` title="${escapeAttribute(node.title)}"`
        : "";

      return `<a href="${escapeAttribute(node.url)}"${titleAttribute}>${renderInlineNodes(node.children)}</a>`;
    }
    case "break":
      return "<br />";
  }
}

function extractBlockText(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return extractInlineNodesText(block.children);
    case "list":
      return block.items
        .map((item) => item.children.map((child) => extractBlockText(child)).join(" "))
        .join(" ");
    case "blockquote":
      return block.children.map((child) => extractBlockText(child)).join(" ");
    case "code":
      return block.value;
    case "thematicBreak":
      return "";
    case "termDefinition":
      return extractTermText(block.entry);
    case "grammarDefinition":
      return extractGrammarText(block.entry);
    case "cardDefinition":
      return [
        extractInlineNodesText(block.card.front.nodes),
        extractInlineNodesText(block.card.back.nodes),
        block.card.notesIt ? extractInlineNodesText(block.card.notesIt.nodes) : ""
      ]
        .filter((value) => value.length > 0)
        .join(" ");
  }
}

function extractTermText(entry: NormalizedTerm) {
  return [
    entry.lemma,
    entry.reading,
    entry.romaji,
    entry.meaningIt,
    entry.meaningLiteralIt ?? "",
    entry.notesIt ?? "",
    entry.aliases.join(" ")
  ]
    .filter((value) => value.length > 0)
    .join(" ");
}

function extractGrammarText(entry: NormalizedGrammarPattern) {
  return [
    entry.title,
    entry.pattern,
    entry.meaningIt,
    entry.notesIt ?? "",
    entry.aliases.join(" ")
  ]
    .filter((value) => value.length > 0)
    .join(" ");
}

function extractInlineNodesText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "furigana":
          return `${node.base} ${node.reading}`;
        case "reference":
        case "emphasis":
        case "strong":
        case "link":
          return extractInlineNodesText(node.children);
        case "inlineCode":
          return node.value;
        case "break":
          return " ";
      }
    })
    .join("");
}

function collectReferenceKeysFromBlock(
  block: ContentBlock
): Array<{ entryId: string; entryType: "term" | "grammar" }> {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return collectReferenceKeysFromInlineNodes(block.children);
    case "list":
      return block.items.flatMap((item) =>
        item.children.flatMap((child) => collectReferenceKeysFromBlock(child))
      );
    case "blockquote":
      return block.children.flatMap((child) => collectReferenceKeysFromBlock(child));
    case "code":
    case "thematicBreak":
      return [];
    case "termDefinition":
    case "grammarDefinition":
      return [];
    case "cardDefinition":
      return dedupeReferenceKeys([
        ...collectReferenceKeysFromInlineNodes(block.card.front.nodes),
        ...collectReferenceKeysFromInlineNodes(block.card.back.nodes),
        ...collectReferenceKeysFromRichText(block.card.notesIt)
      ]);
  }
}

function collectReferenceKeysFromInlineNodes(
  nodes: InlineNode[]
): Array<{ entryId: string; entryType: "term" | "grammar" }> {
  return nodes.flatMap((node) => {
    switch (node.type) {
      case "reference":
        return [
          {
            entryId: node.targetId,
            entryType: node.targetType
          },
          ...collectReferenceKeysFromInlineNodes(node.children)
        ];
      case "emphasis":
      case "strong":
      case "link":
        return collectReferenceKeysFromInlineNodes(node.children);
      case "text":
      case "furigana":
      case "inlineCode":
      case "break":
        return [];
    }
  });
}

function dedupeReferenceKeys(
  keys: Array<{ entryId: string; entryType: "term" | "grammar" }>
) {
  const seen = new Set<string>();

  return keys.filter((key) => {
    const compoundKey = `${key.entryType}:${key.entryId}`;

    if (seen.has(compoundKey)) {
      return false;
    }

    seen.add(compoundKey);
    return true;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

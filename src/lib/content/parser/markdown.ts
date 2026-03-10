import { unified } from "unified";
import remarkParse from "remark-parse";
import type {
  BlockContent,
  Code,
  DefinitionContent,
  Heading,
  Html,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Text,
  ThematicBreak
} from "mdast";

import type {
  CollectedReference,
  ContentBlock,
  InlineNode,
  RichTextFragment,
  SourcePoint,
  SourceRange,
  ValidationIssue
} from "../types.ts";
import type { DraftMarkdownDocument, RawStructuredBlockNode } from "./internal.ts";
import { createIssue, shiftRange } from "./utils.ts";

interface MarkdownParseOptions {
  source: string;
  rawSource?: string;
  filePath: string;
  documentKind: "media" | "lesson" | "cards";
  documentId?: string;
  lineOffset?: number;
  structuredBlockLookup?: Map<string, number>;
}

interface MarkdownParseResult {
  document: DraftMarkdownDocument;
  references: CollectedReference[];
  issues: ValidationIssue[];
}

interface ParseContext {
  filePath: string;
  documentKind: "media" | "lesson" | "cards";
  documentId?: string;
  lineOffset: number;
  fragmentOrigin?: SourcePoint;
  fallbackRange?: SourceRange;
  issues: ValidationIssue[];
  references: CollectedReference[];
  structuredBlockLookup: Map<string, number>;
}

export function parseMarkdownDocument(
  options: MarkdownParseOptions
): MarkdownParseResult {
  const parser = unified().use(remarkParse);
  const tree = parser.parse(options.source) as Root;
  const context: ParseContext = {
    filePath: options.filePath,
    documentKind: options.documentKind,
    documentId: options.documentId,
    lineOffset: options.lineOffset ?? 0,
    fragmentOrigin: undefined,
    fallbackRange: undefined,
    issues: [],
    references: [],
    structuredBlockLookup: options.structuredBlockLookup ?? new Map()
  };

  const blocks = tree.children
    .map((node, index) =>
      convertRootNode(node, context, `body.blocks[${index}]`)
    )
    .filter((block): block is ContentBlock | RawStructuredBlockNode => block !== null);

  return {
    document: {
      raw: options.rawSource ?? options.source,
      blocks
    },
    references: context.references,
    issues: context.issues
  };
}

export function parseInlineFragment(input: {
  source: string;
  filePath: string;
  documentKind: "lesson" | "cards";
  documentId?: string;
  sourcePath: string;
  fragmentOrigin?: SourcePoint;
  fallbackRange?: SourceRange;
}): {
  fragment: RichTextFragment;
  references: CollectedReference[];
  issues: ValidationIssue[];
} {
  const context: ParseContext = {
    filePath: input.filePath,
    documentKind: input.documentKind,
    documentId: input.documentId,
    lineOffset: 0,
    fragmentOrigin: input.fragmentOrigin,
    fallbackRange: input.fallbackRange,
    issues: [],
    references: [],
    structuredBlockLookup: new Map()
  };

  return {
    fragment: {
      raw: input.source,
      nodes: parseInlineSource(
        input.source,
        context,
        input.sourcePath,
        input.fallbackRange
      )
    },
    references: context.references,
    issues: context.issues
  };
}

function convertRootNode(
  node: RootContent | DefinitionContent,
  context: ParseContext,
  sourcePath: string
): ContentBlock | RawStructuredBlockNode | null {
  switch (node.type) {
    case "paragraph":
      return convertParagraph(node, context, sourcePath);
    case "heading":
      return convertHeading(node, context, sourcePath);
    case "list":
      return convertList(node, context, sourcePath);
    case "blockquote":
      return {
        type: "blockquote",
        position: resolveRange(toRange(node.position), context),
        children: node.children
          .map((child, index) =>
            convertBlockNode(
              child,
              context,
              `${sourcePath}.children[${index}]`
            )
          )
          .filter((block): block is ContentBlock => block !== null)
      };
    case "code":
      return convertCode(node, context);
    case "thematicBreak":
      return convertThematicBreak(node, context);
    case "html":
      return convertHtmlNode(node, context, sourcePath);
    default:
      context.issues.push(
        createIssue({
          code: "markdown.unsupported-block",
          category: "schema",
          message: `Unsupported markdown block '${node.type}'.`,
          filePath: context.filePath,
          path: sourcePath,
          range: resolveRange(toRange(node.position), context),
          hint: "Use headings, paragraphs, lists, blockquotes, code fences, or structured blocks."
        })
      );
      return null;
  }
}

function convertBlockNode(
  node: BlockContent | DefinitionContent,
  context: ParseContext,
  sourcePath: string
): ContentBlock | null {
  const converted = convertRootNode(node, context, sourcePath);

  if (converted?.type === "structuredBlock") {
    context.issues.push(
      createIssue({
        code: "markdown.invalid-structured-block-placement",
        category: "schema",
        message: "Structured blocks must appear at the top document flow level.",
        filePath: context.filePath,
        path: sourcePath,
        range: converted.position,
        hint: "Move the structured block outside lists or blockquotes."
      })
    );
    return null;
  }

  return converted;
}

function convertParagraph(
  node: Paragraph,
  context: ParseContext,
  sourcePath: string
): ContentBlock | RawStructuredBlockNode | null {
  if (node.children.length === 1 && node.children[0]?.type === "html") {
    const structured = convertHtmlNode(node.children[0], context, sourcePath);

    if (structured?.type === "structuredBlock") {
      return structured;
    }
  }

  return {
    type: "paragraph",
    position: resolveRange(toRange(node.position), context),
    children: convertInlineNodes(
      node.children,
      context,
      `${sourcePath}.children`,
      resolveRange(toRange(node.position), context)
    )
  };
}

function convertHeading(
  node: Heading,
  context: ParseContext,
  sourcePath: string
): ContentBlock {
  return {
    type: "heading",
    depth: node.depth,
    position: resolveRange(toRange(node.position), context),
    children: convertInlineNodes(
      node.children,
      context,
      `${sourcePath}.children`,
      resolveRange(toRange(node.position), context)
    )
  };
}

function convertList(
  node: List,
  context: ParseContext,
  sourcePath: string
): ContentBlock {
  return {
    type: "list",
    ordered: node.ordered ?? false,
    start: node.start ?? null,
    position: resolveRange(toRange(node.position), context),
    items: node.children.map((item, index) =>
      convertListItem(item, context, `${sourcePath}.items[${index}]`)
    )
  };
}

function convertListItem(
  node: ListItem,
  context: ParseContext,
  sourcePath: string
) {
  return {
    type: "listItem" as const,
    position: resolveRange(toRange(node.position), context),
    children: node.children
      .map((child, index) =>
        convertBlockNode(child, context, `${sourcePath}.children[${index}]`)
      )
      .filter((block): block is ContentBlock => block !== null)
  };
}

function convertCode(node: Code, context: ParseContext): ContentBlock {
  return {
    type: "code",
    lang: node.lang ?? null,
    meta: node.meta ?? null,
    position: resolveRange(toRange(node.position), context),
    value: node.value
  };
}

function convertThematicBreak(
  node: ThematicBreak,
  context: ParseContext
): ContentBlock {
  return {
    type: "thematicBreak",
    position: resolveRange(toRange(node.position), context)
  };
}

function convertHtmlNode(
  node: Html,
  context: ParseContext,
  sourcePath: string
): RawStructuredBlockNode | null {
  const placeholderMatch = node.value.match(/^<!--content-structured-block:(\d+)-->$/);

  if (placeholderMatch) {
    const placeholder = placeholderMatch[0];
    const blockIndex = context.structuredBlockLookup.get(placeholder);

    if (blockIndex === undefined) {
      context.issues.push(
        createIssue({
          code: "structured-block.missing-placeholder",
          category: "integrity",
          message: "Structured block placeholder could not be resolved.",
          filePath: context.filePath,
          path: sourcePath,
          range: resolveRange(toRange(node.position), context)
        })
      );
      return null;
    }

    return {
      type: "structuredBlock",
      blockIndex,
      blockType: "unknown",
      position: resolveRange(toRange(node.position), context)
    };
  }

  context.issues.push(
    createIssue({
      code: "markdown.unsupported-html",
      category: "schema",
      message: "Raw HTML is not supported in content files.",
      filePath: context.filePath,
      path: sourcePath,
      range: resolveRange(toRange(node.position), context),
      hint: "Use standard markdown or supported structured blocks instead of HTML."
    })
  );

  return null;
}

function convertInlineNodes(
  nodes: PhrasingContent[],
  context: ParseContext,
  sourcePath: string,
  fallbackRange?: SourceRange
): InlineNode[] {
  return nodes.flatMap((node, index) =>
    convertInlineNode(
      node,
      context,
      `${sourcePath}[${index}]`,
      fallbackRange
    )
  );
}

function convertInlineNode(
  node: PhrasingContent,
  context: ParseContext,
  sourcePath: string,
  fallbackRange?: SourceRange
): InlineNode[] {
  const resolvedRange = resolveRange(toRange(node.position), context, fallbackRange);

  switch (node.type) {
    case "text":
      return tokenizeTextNode(node, context, sourcePath, resolvedRange);
    case "emphasis":
      return [
        {
          type: "emphasis",
          children: convertInlineNodes(
            node.children,
            context,
            `${sourcePath}.children`,
            resolvedRange
          )
        }
      ];
    case "strong":
      return [
        {
          type: "strong",
          children: convertInlineNodes(
            node.children,
            context,
            `${sourcePath}.children`,
            resolvedRange
          )
        }
      ];
    case "inlineCode":
      return [
        {
          type: "inlineCode",
          children: parseInlineSource(
            node.value,
            context,
            `${sourcePath}.children`,
            resolvedRange,
            "inlineCode"
          )
        }
      ];
    case "break":
      return [{ type: "break" }];
    case "link":
      return [convertLink(node, context, sourcePath, resolvedRange)];
    case "html":
      context.issues.push(
        createIssue({
          code: "markdown.unsupported-html",
          category: "schema",
          message: "Raw HTML is not supported in inline content.",
          filePath: context.filePath,
          path: sourcePath,
          range: resolvedRange,
          hint: "Use plain markdown instead of HTML."
        })
      );
      return [{ type: "text", value: node.value }];
    default:
      context.issues.push(
        createIssue({
          code: "markdown.unsupported-inline",
          category: "schema",
          message: `Unsupported inline markdown node '${node.type}'.`,
          filePath: context.filePath,
          path: sourcePath,
          range: resolvedRange,
          hint: "Use plain text, emphasis, strong text, inline code, furigana, or semantic references."
        })
      );
      return [];
  }
}

function parseInlineSource(
  source: string,
  context: ParseContext,
  sourcePath: string,
  fallbackRange?: SourceRange,
  mode: "fragment" | "inlineCode" = "fragment"
): InlineNode[] {
  const parser = unified().use(remarkParse);
  const tree = parser.parse(source) as Root;

  if (tree.children.some((child) => child.type !== "paragraph")) {
    if (mode === "fragment") {
      reportUnsupportedFragmentBlocks(tree.children, context, sourcePath, fallbackRange);
    }

    return createLiteralInlineNodes(
      source,
      tree,
      context,
      sourcePath,
      fallbackRange
    );
  }

  const nodes: InlineNode[] = [];

  for (const [index, child] of tree.children.entries()) {
    if (child.type !== "paragraph") {
      continue;
    }

    nodes.push(
      ...convertInlineNodes(
        child.children,
        context,
        `${sourcePath}.nodes`,
        resolveRange(toRange(child.position), context, fallbackRange)
      )
    );

    if (index < tree.children.length - 1) {
      nodes.push({ type: "break" });
    }
  }

  return nodes;
}

function reportUnsupportedFragmentBlocks(
  children: Root["children"],
  context: ParseContext,
  sourcePath: string,
  fallbackRange?: SourceRange
) {
  for (const child of children) {
    if (child.type === "paragraph") {
      continue;
    }

    context.issues.push(
      createIssue({
        code: "markdown.unsupported-fragment-block",
        category: "schema",
        message:
          child.type === "thematicBreak"
            ? "Inline fragments cannot contain thematic breaks."
            : `Inline fragments cannot contain '${child.type}' blocks.`,
        filePath: context.filePath,
        path: sourcePath,
        range: resolveRange(toRange(child.position), context, fallbackRange),
        hint:
          child.type === "thematicBreak"
            ? "Use plain text or inline markdown inside this field."
            : "Keep card text fields to inline markdown only."
      })
    );
  }
}

function createLiteralInlineNodes(
  source: string,
  tree?: Root,
  context?: ParseContext,
  sourcePath?: string,
  fallbackRange?: SourceRange
): InlineNode[] {
  if (source.length === 0) {
    return [];
  }

  const nodes: InlineNode[] = [];
  const semanticLinks =
    tree && context && sourcePath
      ? collectSemanticLinks(tree).sort(
        (left, right) => left.startOffset - right.startOffset
      )
      : [];
  let cursor = 0;

  if (context && sourcePath) {
    for (const link of semanticLinks) {
      appendLiteralText(nodes, source.slice(cursor, link.startOffset));
      nodes.push(
        convertLink(
          link.node,
          context,
          sourcePath,
          sliceRange(fallbackRange, source, link.startOffset, link.endOffset)
        )
      );
      cursor = link.endOffset;
    }
  }

  appendLiteralText(nodes, source.slice(cursor));

  return nodes;
}

function appendLiteralText(nodes: InlineNode[], value: string) {
  if (value.length === 0) {
    return;
  }

  const lines = value.split("\n");

  lines.forEach((line, index) => {
    pushTextNode(nodes, line);

    if (index < lines.length - 1) {
      nodes.push({ type: "break" });
    }
  });
}

function collectSemanticLinks(root: Root): Array<{
  node: Link;
  startOffset: number;
  endOffset: number;
}> {
  const links: Array<{
    node: Link;
    startOffset: number;
    endOffset: number;
  }> = [];

  const visit = (node: {
    type: string;
    url?: string;
    position?: Root["position"];
    children?: unknown[];
  }) => {
    if (
      node.type === "link" &&
      typeof node.url === "string" &&
      /^(term|grammar):.+$/.test(node.url)
    ) {
      const startOffset = node.position?.start.offset;
      const endOffset = node.position?.end.offset;

      if (typeof startOffset === "number" && typeof endOffset === "number") {
        links.push({
          node: node as Link,
          startOffset,
          endOffset
        });
      }
    }

    if (!Array.isArray(node.children)) {
      return;
    }

    for (const child of node.children) {
      visit(
        child as {
          type: string;
          url?: string;
          position?: Root["position"];
          children?: unknown[];
        }
      );
    }
  };

  for (const child of root.children) {
    visit(
      child as {
        type: string;
        url?: string;
        position?: Root["position"];
        children?: unknown[];
      }
    );
  }

  return links;
}

function convertLink(
  node: Link,
  context: ParseContext,
  sourcePath: string,
  range?: SourceRange
): InlineNode {
  const children = convertInlineNodes(
    node.children,
    context,
    `${sourcePath}.children`,
    range
  );
  const display = flattenInlineNodes(children);
  const semanticMatch = node.url.match(/^(term|grammar):(.+)$/);

  if (semanticMatch) {
    const targetType = semanticMatch[1] as "term" | "grammar";
    const targetId = semanticMatch[2]?.trim() ?? "";
    const raw = `[${display}](${node.url})`;

    if (targetId.length === 0) {
      context.issues.push(
        createIssue({
          code: "reference.invalid-target",
          category: "syntax",
          message: "Semantic reference target is empty.",
          filePath: context.filePath,
          path: sourcePath,
          range,
          hint: "Use [label](term:term-id) or [label](grammar:grammar-id)."
        })
      );
    }

    context.references.push({
      referenceType: targetType,
      targetId,
      display,
      raw,
      sourceFile: context.filePath,
      sourceDocumentKind: context.documentKind,
      sourceDocumentId: context.documentId,
      sourcePath,
      location: range
    });

    return {
      type: "reference",
      raw,
      display,
      targetType,
      targetId,
      children
    };
  }

  context.issues.push(
    createIssue({
      code: "markdown.unsupported-link",
      category: "schema",
      message: "Only semantic links are supported in content files.",
      filePath: context.filePath,
      path: sourcePath,
      range,
      hint: "Use [label](term:term-id) or [label](grammar:grammar-id)."
    })
  );

  return {
    type: "link",
    url: node.url,
    title: node.title,
    children
  };
}

function tokenizeTextNode(
  node: Text,
  context: ParseContext,
  sourcePath: string,
  range?: SourceRange
): InlineNode[] {
  const value = node.value;
  const nodes: InlineNode[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const markerStart = value.indexOf("{{", cursor);

    if (markerStart === -1) {
      pushTextNode(nodes, value.slice(cursor));
      break;
    }

    if (markerStart > cursor) {
      pushTextNode(nodes, value.slice(cursor, markerStart));
    }

    const markerEnd = value.indexOf("}}", markerStart + 2);

    if (markerEnd === -1) {
      context.issues.push(
        createIssue({
          code: "furigana.unclosed",
          category: "syntax",
          message: "Furigana annotation is not closed.",
          filePath: context.filePath,
          path: sourcePath,
          range: sliceRange(range, value, markerStart, value.length),
          hint: "Use the form {{base|reading}}."
        })
      );
      pushTextNode(nodes, value.slice(markerStart));
      break;
    }

    const raw = value.slice(markerStart, markerEnd + 2);
    const inner = value.slice(markerStart + 2, markerEnd);
    const separatorIndex = inner.indexOf("|");
    const isValid =
      separatorIndex > 0 &&
      separatorIndex === inner.lastIndexOf("|") &&
      inner.slice(separatorIndex + 1).length > 0 &&
      !inner.includes("{") &&
      !inner.includes("}");

    if (!isValid) {
      context.issues.push(
        createIssue({
          code: "furigana.invalid",
          category: "syntax",
          message: "Furigana annotation must use the form {{base|reading}}.",
          filePath: context.filePath,
          path: sourcePath,
          range: sliceRange(range, value, markerStart, markerEnd + 2),
          hint: "Provide exactly one '|' separator and non-empty base/reading values."
        })
      );
      pushTextNode(nodes, raw);
      cursor = markerEnd + 2;
      continue;
    }

    const base = inner.slice(0, separatorIndex);
    const reading = inner.slice(separatorIndex + 1);

    nodes.push({
      type: "furigana",
      raw,
      base,
      reading
    });
    cursor = markerEnd + 2;
  }

  return nodes;
}

function pushTextNode(nodes: InlineNode[], value: string) {
  if (value.length === 0) {
    return;
  }

  const previous = nodes[nodes.length - 1];

  if (previous?.type === "text") {
    previous.value += value;
    return;
  }

  nodes.push({
    type: "text",
    value
  });
}

function flattenInlineNodes(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return node.value;
        case "furigana":
          return node.base;
        case "reference":
          return node.display;
        case "emphasis":
        case "strong":
        case "link":
          return flattenInlineNodes(node.children);
        case "inlineCode":
          return flattenInlineNodes(node.children);
        case "break":
          return "\n";
      }
    })
    .join("");
}

function toRange(position: RootContent["position"]): SourceRange | undefined {
  if (!position) {
    return undefined;
  }

  return {
    start: {
      line: position.start.line,
      column: position.start.column,
      offset: position.start.offset
    },
    end: {
      line: position.end.line,
      column: position.end.column,
      offset: position.end.offset
    }
  };
}

function sliceRange(
  range: SourceRange | undefined,
  rawValue: string,
  startOffset: number,
  endOffset: number
): SourceRange | undefined {
  if (!range) {
    return undefined;
  }

  let line = range.start.line;
  let column = range.start.column;

  for (let index = 0; index < startOffset; index += 1) {
    const char = rawValue[index];

    if (char === "\n") {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }

  const start = {
    line,
    column
  };

  for (let index = startOffset; index < endOffset; index += 1) {
    const char = rawValue[index];

    if (char === "\n") {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }

  return {
    start,
    end: {
      line,
      column
    }
  };
}

function resolveRange(
  range: SourceRange | undefined,
  context: ParseContext,
  fallbackRange?: SourceRange
) {
  const shiftedRange = range ? shiftRange(range, context.lineOffset) : undefined;

  if (shiftedRange && context.fragmentOrigin) {
    return translateRange(shiftedRange, context.fragmentOrigin);
  }

  return shiftedRange ?? fallbackRange ?? context.fallbackRange;
}

function translateRange(range: SourceRange, origin: SourcePoint): SourceRange {
  return {
    start: translatePoint(range.start, origin),
    end: translatePoint(range.end, origin)
  };
}

function translatePoint(point: SourcePoint, origin: SourcePoint): SourcePoint {
  return {
    line: origin.line + point.line - 1,
    column: origin.column + point.column - 1
  };
}

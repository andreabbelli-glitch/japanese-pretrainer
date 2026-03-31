import { parseInlineFragment } from "./content/parser/markdown.ts";
import type { InlineNode } from "./content/types.ts";

export function parseInlineText(text: string): InlineNode[] {
  return parseInlineFragment({
    source: text,
    filePath: "inline-render",
    documentKind: "lesson",
    sourcePath: "inline"
  }).fragment.nodes;
}

export function flattenInlineNodes(nodes: InlineNode[]): string {
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
          return flattenInlineNodes(node.children);
        case "break":
          return " ";
      }
    })
    .join("");
}

export function stripInlineMarkdown(text: string): string {
  return flattenInlineNodes(parseInlineText(text));
}

export function deriveInlineReading(text: string): string | undefined {
  const derived = deriveInlineNodesReading(parseInlineText(text));

  if (derived === null) {
    return undefined;
  }

  const normalized = derived
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

function deriveInlineNodesReading(nodes: InlineNode[]): string | null {
  let reading = "";

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (/\p{Script=Han}/u.test(node.value)) {
          return null;
        }

        reading += node.value;
        break;
      case "furigana":
        reading += node.reading;
        break;
      case "reference":
      case "emphasis":
      case "strong":
      case "inlineCode":
      case "link": {
        const childReading = deriveInlineNodesReading(node.children);

        if (childReading === null) {
          return null;
        }

        reading += childReading;
        break;
      }
      case "break":
        reading += " ";
        break;
    }
  }

  return reading;
}

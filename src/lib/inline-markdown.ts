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

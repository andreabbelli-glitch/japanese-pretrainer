import { Fragment, type ReactNode } from "react";

import { parseInlineFragment } from "@/lib/content/parser/markdown";
import type { InlineNode } from "@/lib/content/types";

export function renderFurigana(text: string) {
  return renderInlineNodes(parseInlineText(text));
}

export function stripInlineMarkdown(text: string): string {
  return flattenInlineNodes(parseInlineText(text));
}

function parseInlineText(text: string): InlineNode[] {
  return parseInlineFragment({
    source: text,
    filePath: "inline-render",
    documentKind: "lesson",
    sourcePath: "inline"
  }).fragment.nodes;
}

function renderInlineNodes(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => renderInlineNode(node, `inline-${index}`));
}

function renderInlineNode(node: InlineNode, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return <Fragment key={key}>{node.value}</Fragment>;
    case "furigana":
      return (
        <ruby key={key}>
          {node.base}
          <rt>{node.reading}</rt>
        </ruby>
      );
    case "reference":
      return (
        <strong key={key} className="inline-ref">
          {renderInlineNodes(node.children)}
        </strong>
      );
    case "emphasis":
      return <em key={key}>{renderInlineNodes(node.children)}</em>;
    case "strong":
      return <strong key={key}>{renderInlineNodes(node.children)}</strong>;
    case "inlineCode":
      return (
        <code key={key} className="jp-inline">
          {renderInlineNodes(node.children)}
        </code>
      );
    case "link":
      return (
        <a href={node.url} key={key} title={node.title ?? undefined}>
          {renderInlineNodes(node.children)}
        </a>
      );
    case "break":
      return <br key={key} />;
  }
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

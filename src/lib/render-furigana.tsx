import { Fragment, type ReactNode } from "react";

import { parseInlineFragment } from "@/lib/content/parser/markdown";
import type { InlineNode } from "@/lib/content/types";

type RenderFuriganaOptions = {
  linkBehavior?: "render" | "flatten";
};

export function renderFurigana(
  text: string,
  options?: RenderFuriganaOptions
) {
  return renderInlineNodes(parseInlineText(text), options);
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

function renderInlineNodes(
  nodes: InlineNode[],
  options?: RenderFuriganaOptions
): ReactNode[] {
  return nodes.map((node, index) =>
    renderInlineNode(node, `inline-${index}`, options)
  );
}

function renderInlineNode(
  node: InlineNode,
  key: string,
  options?: RenderFuriganaOptions
): ReactNode {
  switch (node.type) {
    case "text":
      return <Fragment key={key}>{node.value}</Fragment>;
    case "furigana":
      return (
        <ruby className="app-ruby" key={key}>
          <rb>{node.base}</rb>
          <rt>{node.reading}</rt>
        </ruby>
      );
    case "reference":
      return (
        <strong key={key} className="inline-ref">
          {renderInlineNodes(node.children, options)}
        </strong>
      );
    case "emphasis":
      return <em key={key}>{renderInlineNodes(node.children, options)}</em>;
    case "strong":
      return <strong key={key}>{renderInlineNodes(node.children, options)}</strong>;
    case "inlineCode":
      return (
        <code key={key} className="jp-inline">
          {renderInlineNodes(node.children, options)}
        </code>
      );
    case "link":
      if (options?.linkBehavior === "flatten") {
        return (
          <Fragment key={key}>
            {renderInlineNodes(node.children, options)}
          </Fragment>
        );
      }

      return (
        <a href={node.url} key={key} title={node.title ?? undefined}>
          {renderInlineNodes(node.children, options)}
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

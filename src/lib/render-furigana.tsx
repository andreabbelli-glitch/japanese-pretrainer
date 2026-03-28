import { Fragment, type ReactNode } from "react";

import type { InlineNode } from "./content/types.ts";
import {
  parseInlineText,
  stripInlineMarkdown as stripInlineMarkdownText
} from "./inline-markdown.ts";

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
  return stripInlineMarkdownText(text);
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
    case "furigana": {
      const segments = splitMonoRuby(node.base, node.reading);

      if (segments.length === 1) {
        return (
          <ruby className="app-ruby" key={key}>
            <rb>{node.base}</rb>
            <rt>{node.reading}</rt>
          </ruby>
        );
      }

      return (
        <span key={key}>
          {segments.map(([base, reading], i) => (
            <ruby className="app-ruby" key={`${key}-${i}`}>
              <rb>{base}</rb>
              <rt>{reading}</rt>
            </ruby>
          ))}
        </span>
      );
    }
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

/**
 * Split a furigana annotation into per-character (mono ruby) segments
 * when the reading uses dot separators.
 *
 * "目的地" + "もく.てき.ち" → [["目","もく"], ["的","てき"], ["地","ち"]]
 *
 * Falls back to a single segment when dots are absent or the count
 * doesn't match the base character count.
 */
export function splitMonoRuby(
  base: string,
  reading: string
): [string, string][] {
  if (!reading.includes(".")) return [[base, reading]];

  const readingParts = reading.split(".");
  const baseChars = [...base];

  if (readingParts.length !== baseChars.length) return [[base, reading]];

  return baseChars.map((ch, i) => [ch, readingParts[i]]);
}

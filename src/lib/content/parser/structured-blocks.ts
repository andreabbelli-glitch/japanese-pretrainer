import { parseDocument } from "yaml";

import type { SourcePoint, SourceRange, ValidationIssue } from "../types.ts";
import type { RawStructuredBlock } from "./internal.ts";
import { createIssue, isRecord } from "./utils.ts";

export interface StructuredBlockExtraction {
  transformedSource: string;
  blocks: RawStructuredBlock[];
  issues: ValidationIssue[];
}

const blockStartPattern = /^:::\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*$/;
const blockEndPattern = /^:::\s*$/;
const fencePattern = /^(```+|~~~+)/;

export function extractStructuredBlocks(
  source: string,
  filePath: string,
  lineOffset: number
): StructuredBlockExtraction {
  const lines = source.split("\n");
  const transformedLines: string[] = [];
  const blocks: RawStructuredBlock[] = [];
  const issues: ValidationIssue[] = [];

  let activeFence: string | null = null;
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor] ?? "";
    const fenceMatch = line.match(fencePattern);

    if (fenceMatch) {
      const fence = fenceMatch[1];

      if (activeFence === null) {
        activeFence = fence[0] ?? null;
      } else if (activeFence === fence[0]) {
        activeFence = null;
      }

      transformedLines.push(line);
      cursor += 1;
      continue;
    }

    const blockMatch = activeFence === null ? line.match(blockStartPattern) : null;

    if (!blockMatch) {
      transformedLines.push(line);
      cursor += 1;
      continue;
    }

    const blockType = blockMatch[1];
    const startIndex = cursor;
    const bodyLines: string[] = [];
    let endIndex = -1;
    cursor += 1;

    while (cursor < lines.length) {
      const currentLine = lines[cursor] ?? "";

      if (blockEndPattern.test(currentLine)) {
        endIndex = cursor;
        cursor += 1;
        break;
      }

      bodyLines.push(currentLine);
      cursor += 1;
    }

    if (endIndex === -1) {
      issues.push(
        createIssue({
          code: "structured-block.unclosed",
          category: "syntax",
          message: `Structured block '${blockType}' is not closed.`,
          filePath,
          range: {
            start: {
              line: lineOffset + startIndex + 1,
              column: 1
            },
            end: {
              line: lineOffset + startIndex + 1,
              column: line.length + 1
            }
          },
          hint: "Terminate the block with a closing ':::' line."
        })
      );

      transformedLines.push(...lines.slice(startIndex));
      break;
    }

    const placeholder = `<!--content-structured-block:${blocks.length}-->`;
    const raw = lines.slice(startIndex, endIndex + 1).join("\n");
    const yamlSource = bodyLines.join("\n");
    const document = parseDocument(yamlSource, {
      prettyErrors: false,
      keepSourceTokens: true
    });
    const fieldRanges = collectFieldRanges(
      document,
      yamlSource,
      lineOffset + startIndex + 2
    );
    const fieldStyles = collectFieldStyles(document);

    for (const error of document.errors) {
      const linePos = "linePos" in error ? error.linePos : undefined;
      const start = linePos?.[0];
      const end = linePos?.[1];

      issues.push(
        createIssue({
          code: "structured-block.invalid-yaml",
          category: "syntax",
          message: error.message,
          filePath,
          range:
            start && end
              ? {
                  start: {
                    line: lineOffset + startIndex + 1 + start.line,
                    column: start.col
                  },
                  end: {
                    line: lineOffset + startIndex + 1 + end.line,
                    column: end.col
                  }
                }
              : undefined,
          path: blockType,
          hint: "Use valid YAML key/value pairs inside the structured block."
        })
      );
    }

    let data: Record<string, unknown> | null = null;
    const parsed = document.toJSON();

    if (parsed !== null && parsed !== undefined && !isRecord(parsed)) {
      issues.push(
        createIssue({
          code: "structured-block.invalid-root",
          category: "schema",
          message: `Structured block '${blockType}' must contain a YAML object.`,
          filePath,
          path: blockType,
          range: {
            start: {
              line: lineOffset + startIndex + 1,
              column: 1
            },
            end: {
              line: lineOffset + endIndex + 1,
              column: 4
            }
          },
          hint: "Declare the block fields as top-level key/value pairs."
        })
      );
    } else {
      data = parsed;
    }

    blocks.push({
      index: blocks.length,
      blockType,
      raw,
      placeholder,
      data,
      fieldRanges,
      fieldStyles,
      position: {
        start: {
          line: lineOffset + startIndex + 1,
          column: 1
        },
        end: {
          line: lineOffset + endIndex + 1,
          column: 4
        }
      }
    });

    transformedLines.push(placeholder);
  }

  return {
    transformedSource: transformedLines.join("\n"),
    blocks,
    issues
  };
}

function collectFieldRanges(
  document: ReturnType<typeof parseDocument>,
  source: string,
  startLine: number
) {
  const fieldRanges: Record<string, SourceRange> = {};
  const contents = document.contents;

  if (!isYamlMap(contents)) {
    return fieldRanges;
  }

  for (const item of contents.items) {
    const key = asTopLevelKey(item);
    const value = item?.value;

    if (!key || !value) {
      continue;
    }

    const startOffset = getValueStartOffset(value);

    if (startOffset === undefined) {
      continue;
    }

    const endOffset = getValueEndOffset(value, startOffset);

    fieldRanges[key] = {
      start: offsetToPoint(source, startOffset, startLine),
      end: offsetToPoint(source, endOffset, startLine)
    };
  }

  return fieldRanges;
}

function collectFieldStyles(document: ReturnType<typeof parseDocument>) {
  const fieldStyles: Record<string, string> = {};
  const contents = document.contents;

  if (!isYamlMap(contents)) {
    return fieldStyles;
  }

  for (const item of contents.items) {
    const key = asTopLevelKey(item);
    const value = item?.value;
    const valueNode = asYamlValueNode(value);

    if (!key || !valueNode || typeof valueNode.type !== "string" || valueNode.type.length === 0) {
      continue;
    }

    fieldStyles[key] = valueNode.type;
  }

  return fieldStyles;
}

function isYamlMap(
  value: unknown
): value is {
  items: Array<{ key?: { value?: unknown }; value?: unknown }>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray(value.items)
  );
}

function asTopLevelKey(item: unknown) {
  const keyValue =
    typeof item === "object" && item !== null && "key" in item
      ? (item.key as { value?: unknown } | undefined)?.value
      : undefined;

  return typeof keyValue === "string" && keyValue.length > 0 ? keyValue : null;
}

function getValueStartOffset(value: unknown) {
  const valueNode = asYamlValueNode(value);
  const tokenOffset = valueNode?.srcToken?.offset;

  if (!valueNode) {
    return undefined;
  }

  if (
    valueNode.srcToken?.type === "double-quoted-scalar" ||
    valueNode.srcToken?.type === "single-quoted-scalar"
  ) {
    return typeof tokenOffset === "number" ? tokenOffset + 1 : undefined;
  }

  if (valueNode.srcToken?.type === "block-scalar") {
    return getBlockScalarContentOffset(valueNode.srcToken);
  }

  if (typeof tokenOffset === "number") {
    return tokenOffset;
  }

  return Array.isArray(valueNode.range) && typeof valueNode.range[0] === "number"
    ? valueNode.range[0]
    : undefined;
}

function getValueEndOffset(value: unknown, startOffset: number) {
  const valueNode = asYamlValueNode(value);
  const rawEnd =
    Array.isArray(valueNode?.range) && typeof valueNode.range[1] === "number"
      ? valueNode.range[1]
      : startOffset;

  if (
    valueNode?.srcToken?.type === "double-quoted-scalar" ||
    valueNode?.srcToken?.type === "single-quoted-scalar"
  ) {
    return Math.max(startOffset, rawEnd - 1);
  }

  return Math.max(startOffset, rawEnd);
}

function asYamlValueNode(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as {
    range?: number[];
    type?: string;
    srcToken?: {
      type?: string;
      offset?: number;
      props?: Array<{ source?: string }>;
      source?: string;
    };
  };
}

function getBlockScalarContentOffset(token: {
  offset?: number;
  props?: Array<{ source?: string }>;
  source?: string;
}) {
  const baseOffset = typeof token.offset === "number" ? token.offset : 0;
  const propsLength = (token.props ?? []).reduce(
    (total, item) => total + (item.source?.length ?? 0),
    0
  );
  const rawSource = token.source ?? "";
  const firstLine = rawSource.split("\n")[0] ?? "";
  const indentLength = firstLine.match(/^[ \t]*/)?.[0].length ?? 0;

  return baseOffset + propsLength + indentLength;
}

function offsetToPoint(
  source: string,
  offset: number,
  startLine: number
): SourcePoint {
  const limit = Math.max(0, Math.min(offset, source.length));
  let line = startLine;
  let column = 1;

  for (let index = 0; index < limit; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }

  return {
    line,
    column
  };
}

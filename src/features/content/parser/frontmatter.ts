import { parseDocument } from "yaml";

import type { SourceRange } from "../types.ts";
import type { ValidationIssue } from "../types.ts";
import { createIssue, isRecord } from "./utils.ts";

export interface ParsedFrontmatterResult {
  data: Record<string, unknown> | null;
  body: string;
  bodyLineOffset: number;
  fieldRanges: Record<string, SourceRange>;
  fieldStyles: Record<string, string>;
  issues: ValidationIssue[];
}

export function parseFrontmatter(
  source: string,
  filePath: string
): ParsedFrontmatterResult {
  const normalizedSource = normalizeSourceForFrontmatter(source);
  const lines = normalizedSource.split("\n");

  if (lines[0] !== "---") {
    return {
      data: null,
      body: normalizedSource,
      bodyLineOffset: 0,
      fieldRanges: {},
      fieldStyles: {},
      issues: [
        createIssue({
          code: "frontmatter.missing",
          category: "syntax",
          message: "File is missing YAML frontmatter.",
          filePath,
          hint: "Start the file with '---' and close the frontmatter with another '---'."
        })
      ]
    };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line === "---"
  );

  if (closingIndex === -1) {
    return {
      data: null,
      body: "",
      bodyLineOffset: 0,
      fieldRanges: {},
      fieldStyles: {},
      issues: [
        createIssue({
          code: "frontmatter.unclosed",
          category: "syntax",
          message: "YAML frontmatter is not closed.",
          filePath,
          hint: "Add a closing '---' line after the frontmatter fields."
        })
      ]
    };
  }

  const yamlSource = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n");
  const issues: ValidationIssue[] = [];
  const document = parseDocument(yamlSource, {
    prettyErrors: false,
    keepSourceTokens: true
  });
  const { fieldRanges, fieldStyles } = collectFieldMetadata(document, yamlSource, 2);

  for (const error of document.errors) {
    const linePos = "linePos" in error ? error.linePos : undefined;
    const start = linePos?.[0];
    const end = linePos?.[1];

    issues.push(
      createIssue({
        code: "frontmatter.invalid-yaml",
        category: "syntax",
        message: error.message,
        filePath,
        range:
          start && end
            ? {
                start: {
                  line: start.line + 1,
                  column: start.col
                },
                end: {
                  line: end.line + 1,
                  column: end.col
                }
              }
            : undefined,
        hint: "Fix the YAML syntax in the frontmatter."
      })
    );
  }

  let data: Record<string, unknown> | null = null;
  const parsed = document.toJSON();

  if (parsed !== null && parsed !== undefined && !isRecord(parsed)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-root",
        category: "schema",
        message: "Frontmatter must be a YAML object.",
        filePath,
        range: {
          start: {
            line: 1,
            column: 1
          },
          end: {
            line: closingIndex + 1,
            column: 3
          }
        },
        hint: "Use key/value pairs at the top level of the frontmatter."
      })
    );
  } else {
    data = parsed;
  }

  return {
    data,
    body,
    bodyLineOffset: closingIndex + 1,
    fieldRanges,
    fieldStyles,
    issues
  };
}

function normalizeSourceForFrontmatter(source: string) {
  const withoutBom = source.startsWith("\uFEFF") ? source.slice(1) : source;

  return withoutBom.replace(/\r\n?/g, "\n");
}

function collectFieldMetadata(
  document: ReturnType<typeof parseDocument>,
  source: string,
  startLine: number
) {
  const fieldRanges: Record<string, SourceRange> = {};
  const fieldStyles: Record<string, string> = {};
  const contents = document.contents;

  if (!isYamlMap(contents)) {
    return {
      fieldRanges,
      fieldStyles
    };
  }

  for (const item of contents.items) {
    const key = asTopLevelKey(item);
    const value = item?.value;
    const valueNode = asYamlValueNode(value);

    if (!key || !value) {
      continue;
    }

    if (typeof valueNode?.type === "string" && valueNode.type.length > 0) {
      fieldStyles[key] = valueNode.type;
    }

    const startOffset = getValueStartOffset(valueNode);

    if (startOffset === undefined) {
      continue;
    }

    const endOffset = getValueEndOffset(valueNode, startOffset);

    fieldRanges[key] = {
      start: offsetToPoint(source, startOffset, startLine),
      end: offsetToPoint(source, endOffset, startLine)
    };
  }

  return {
    fieldRanges,
    fieldStyles
  };
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

function getValueStartOffset(
  valueNode: ReturnType<typeof asYamlValueNode>
) {
  if (!valueNode || !Array.isArray(valueNode.range) || valueNode.range.length < 2) {
    return undefined;
  }

  return valueNode.range[0];
}

function getValueEndOffset(
  valueNode: ReturnType<typeof asYamlValueNode>,
  fallbackOffset: number
) {
  if (!valueNode || !Array.isArray(valueNode.range) || valueNode.range.length < 2) {
    return fallbackOffset;
  }

  return valueNode.range[1];
}

function asYamlValueNode(value: unknown): {
  range?: [number, number, number?];
  type?: string;
} | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as {
    range?: [number, number, number?];
    type?: string;
  };
}

function offsetToPoint(source: string, offset: number, startLine: number) {
  const boundedOffset = Math.max(0, Math.min(offset, source.length));
  let line = startLine;
  let column = 1;

  for (let index = 0; index < boundedOffset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return {
    line,
    column,
    offset: boundedOffset
  };
}

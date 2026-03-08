import { parseDocument } from "yaml";

import type { ValidationIssue } from "../types";
import { createIssue, isRecord } from "./utils";

export interface ParsedFrontmatterResult {
  data: Record<string, unknown> | null;
  body: string;
  bodyLineOffset: number;
  issues: ValidationIssue[];
}

export function parseFrontmatter(
  source: string,
  filePath: string
): ParsedFrontmatterResult {
  const lines = source.split("\n");

  if (lines[0] !== "---") {
    return {
      data: null,
      body: source,
      bodyLineOffset: 0,
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
    prettyErrors: false
  });

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
    issues
  };
}

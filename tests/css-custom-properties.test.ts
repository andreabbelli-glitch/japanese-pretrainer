import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");

// Escape hatch for genuinely runtime-only CSS variables that cannot be found
// through static CSS or inline style keys. Keep this empty unless necessary.
const ALLOWED_RUNTIME_CUSTOM_PROPERTIES = new Set<string>();

type SourceFile = {
  path: string;
  text: string;
};

type MissingCustomPropertyUsage = {
  file: string;
  line: number;
  token: string;
};

describe("css custom properties", () => {
  it("detects a var() custom property usage without a definition or fallback", () => {
    const violations = findMissingCustomPropertyUsages({
      cssFiles: [
        {
          path: "fixture.css",
          text: ".example { color: var(--missing-token); }"
        }
      ],
      inlineStyleFiles: []
    });

    expect(violations).toEqual([
      {
        file: "fixture.css",
        line: 1,
        token: "--missing-token"
      }
    ]);
  });

  it("treats CSS definitions, inline definitions, and var() fallbacks as valid", () => {
    const violations = findMissingCustomPropertyUsages({
      cssFiles: [
        {
          path: "fixture.css",
          text: [
            ":root { --defined-token: #111; }",
            ".defined { color: var(--defined-token); }",
            ".inline { left: calc(var(--inline-token) * 1px); }",
            ".fallback { max-height: var(--runtime-token, calc(100vh - 2rem)); }"
          ].join("\n")
        }
      ],
      inlineStyleFiles: [
        {
          path: "component.tsx",
          text: 'const style = { "--inline-token": "2" };'
        }
      ]
    });

    expect(violations).toEqual([]);
  });

  it("keeps source CSS var() usages backed by definitions or fallbacks", async () => {
    const [cssFiles, inlineStyleFiles] = await Promise.all([
      readSourceFiles(SOURCE_ROOT, isCssFile),
      readSourceFiles(SOURCE_ROOT, isTypeScriptSourceFile)
    ]);

    const violations = findMissingCustomPropertyUsages({
      cssFiles,
      inlineStyleFiles
    });

    if (violations.length > 0) {
      throw new Error(formatMissingCustomPropertyUsages(violations));
    }

    expect(violations).toEqual([]);
  });
});

function findMissingCustomPropertyUsages(input: {
  cssFiles: SourceFile[];
  inlineStyleFiles: SourceFile[];
}): MissingCustomPropertyUsage[] {
  const definedProperties = new Set<string>(ALLOWED_RUNTIME_CUSTOM_PROPERTIES);

  for (const file of input.cssFiles) {
    for (const property of collectCssCustomPropertyDefinitions(file.text)) {
      definedProperties.add(property);
    }
  }

  for (const file of input.inlineStyleFiles) {
    for (const property of collectInlineCustomPropertyDefinitions(file.text)) {
      definedProperties.add(property);
    }
  }

  return input.cssFiles.flatMap((file) =>
    collectCssVarUsages(file)
      .filter((usage) => !usage.hasFallback)
      .filter((usage) => !definedProperties.has(usage.token))
      .map(({ line, token }) => ({
        file: file.path,
        line,
        token
      }))
  );
}

async function readSourceFiles(
  directory: string,
  includeFile: (filePath: string) => boolean
): Promise<SourceFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return readSourceFiles(absolutePath, includeFile);
      }

      if (!entry.isFile() || !includeFile(absolutePath)) {
        return [];
      }

      const text = await readFile(absolutePath, "utf8");
      return [
        {
          path: path.relative(PROJECT_ROOT, absolutePath),
          text
        }
      ];
    })
  );

  return nestedFiles.flat().sort((a, b) => a.path.localeCompare(b.path));
}

function isCssFile(filePath: string) {
  return filePath.endsWith(".css");
}

function isTypeScriptSourceFile(filePath: string) {
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

function collectCssCustomPropertyDefinitions(css: string) {
  const strippedCss = stripCssComments(css);
  const definitions = new Set<string>();
  const definitionPattern = /(?<![\w-])(--[A-Za-z0-9_-]+)\s*:/g;

  for (const match of strippedCss.matchAll(definitionPattern)) {
    const token = match[1];

    if (token) {
      definitions.add(token);
    }
  }

  return definitions;
}

function collectInlineCustomPropertyDefinitions(source: string) {
  const definitions = new Set<string>();
  const propertyKeyPattern = /["'](--[A-Za-z0-9_-]+)["']\s*:/g;
  const setPropertyPattern =
    /\.setProperty\(\s*["'](--[A-Za-z0-9_-]+)["']\s*,/g;

  for (const match of source.matchAll(propertyKeyPattern)) {
    const token = match[1];

    if (token) {
      definitions.add(token);
    }
  }

  for (const match of source.matchAll(setPropertyPattern)) {
    const token = match[1];

    if (token) {
      definitions.add(token);
    }
  }

  return definitions;
}

function collectCssVarUsages(file: SourceFile) {
  const css = stripCssComments(file.text);
  const usages: Array<{ hasFallback: boolean; line: number; token: string }> =
    [];
  let searchStart = 0;

  while (searchStart < css.length) {
    const varIndex = css.indexOf("var(", searchStart);

    if (varIndex === -1) {
      break;
    }

    const openParenIndex = varIndex + "var".length;
    const closeParenIndex = findMatchingClosingParen(css, openParenIndex);

    if (closeParenIndex === -1) {
      searchStart = varIndex + "var(".length;
      continue;
    }

    const content = css.slice(openParenIndex + 1, closeParenIndex);
    const parsedUsage = parseVarFunctionContent(content);

    if (parsedUsage) {
      usages.push({
        ...parsedUsage,
        line: getLineNumber(css, varIndex)
      });
    }

    searchStart = closeParenIndex + 1;
  }

  return usages;
}

function parseVarFunctionContent(content: string) {
  const tokenMatch = /^\s*(--[A-Za-z0-9_-]+)/.exec(content);
  const token = tokenMatch?.[1];

  if (!token || tokenMatch.index === undefined) {
    return null;
  }

  const fallbackSearchStart = tokenMatch.index + token.length;
  let depth = 0;

  for (let index = fallbackSearchStart; index < content.length; index += 1) {
    const char = content[index];

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (char === "," && depth === 0) {
      return {
        hasFallback: true,
        token
      };
    }
  }

  return {
    hasFallback: false,
    token
  };
}

function findMatchingClosingParen(value: string, openParenIndex: number) {
  let depth = 0;

  for (let index = openParenIndex; index < value.length; index += 1) {
    const char = value[index];

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function stripCssComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " ")
  );
}

function getLineNumber(value: string, index: number) {
  let line = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (value[cursor] === "\n") {
      line += 1;
    }
  }

  return line;
}

function formatMissingCustomPropertyUsages(
  violations: MissingCustomPropertyUsage[]
) {
  const lines = violations.map(
    (violation) => `- ${violation.file}:${violation.line} ${violation.token}`
  );

  return [
    "Found CSS custom properties used as var(--token) without a fallback,",
    "but no matching CSS definition or static inline style definition was found.",
    ...lines
  ].join("\n");
}

import { createIssue, isStringArray } from "./parser/utils.ts";
import type { InlineNode, SourceRange, ValidationIssue } from "./types.ts";

export const bareKanjiPattern = /\p{Script=Han}/u;
const japaneseScriptPattern =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const bareNumeralPattern = /[+-]?\d[\d,]*(?:\.\d+)?/u;

export function readRequiredString(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(
      createIssue({
        code: "schema.required-string",
        category: "schema",
        message: `Field '${key}' must be a non-empty string.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

export function readOptionalString(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(
      createIssue({
        code: "schema.invalid-string",
        category: "schema",
        message: `Field '${key}' must be a non-empty string when provided.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

export function readOptionalStringArray(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (value === undefined) {
    return undefined;
  }

  if (!isStringArray(value) || value.some((item) => item.trim().length === 0)) {
    issues.push(
      createIssue({
        code: "schema.invalid-string-array",
        category: "schema",
        message: `Field '${key}' must be an array of non-empty strings.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

export function readRequiredInteger(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push(
      createIssue({
        code: "schema.required-integer",
        category: "schema",
        message: `Field '${key}' must be an integer.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

export function readOptionalPitchAccent(
  values: Record<string, unknown>,
  filePath: string,
  sourcePath: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = values.pitch_accent;

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  issues.push(
    createIssue({
      code: "structured-block.invalid-pitch-accent",
      category: "schema",
      message:
        "Field 'pitch_accent' must be an integer greater than or equal to 0.",
      filePath,
      path: `${sourcePath}.pitch_accent`,
      range
    })
  );

  return undefined;
}

export function reportUnknownKeys(
  raw: Record<string, unknown>,
  allowedKeys: string[],
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(raw)) {
    if (allowed.has(key)) {
      continue;
    }

    issues.push(
      createIssue({
        code: "schema.unknown-field",
        category: "schema",
        message: `Unknown field '${key}'.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range,
        hint: "Remove unsupported fields or update the formal content spec first."
      })
    );
  }
}

export function reportUnsafeYamlPlainScalars(
  raw: Record<string, unknown>,
  keys: string[],
  filePath: string,
  pathPrefix: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
) {
  for (const key of keys) {
    const value = raw[key];
    const reason =
      typeof value === "string"
        ? getUnsafeYamlPlainScalarReason(key, value)
        : null;

    if (
      typeof value !== "string" ||
      fieldStyles[key] !== "PLAIN" ||
      reason === null
    ) {
      continue;
    }

    issues.push(
      createIssue({
        code: "yaml.unsafe-plain-scalar",
        category: "syntax",
        message: formatUnsafeYamlPlainScalarMessage(key, reason.kind),
        filePath,
        path: `${pathPrefix}.${key}`,
        range: fieldRanges[key],
        hint: formatUnsafeYamlPlainScalarHint(key, reason.kind),
        details: {
          field: key,
          scalarStyle: "plain",
          reason: reason.kind
        }
      })
    );
  }
}

export function containsUnsupportedLessonSummaryMarkup(value: string) {
  return (
    /\[[^\]]+\]\((?:term|grammar):[^)]+\)/.test(value) ||
    /\{\{[^|}]+\|[^}]+\}\}/.test(value) ||
    /`[^`]+`/.test(value)
  );
}

export function reportVisibleRichTextIssue(input: {
  fragment: { nodes: InlineNode[] };
  filePath: string;
  sourcePath: string;
  range: SourceRange | undefined;
  issues: ValidationIssue[];
  checkBareKanji?: boolean;
  checkBareNumerals?: boolean;
}) {
  if (
    input.checkBareKanji &&
    inlineNodesContainBareKanji(input.fragment.nodes)
  ) {
    input.issues.push(
      createIssue({
        code: "furigana.visible-text-bare-kanji",
        category: "schema",
        message:
          "Visible learner-facing text contains kanji outside furigana markup.",
        filePath: input.filePath,
        path: input.sourcePath,
        range: input.range,
        hint: "Annotate visible kanji with furigana, or use a semantic reference whose full label is already annotated."
      })
    );
  }

  if (
    input.checkBareNumerals &&
    inlineNodesContainJapaneseScript(input.fragment.nodes) &&
    inlineNodesContainBareNumerals(input.fragment.nodes)
  ) {
    input.issues.push(
      createIssue({
        code: "furigana.visible-text-bare-numerals",
        category: "schema",
        message:
          "Visible learner-facing Japanese text contains numerals outside furigana markup.",
        filePath: input.filePath,
        path: input.sourcePath,
        range: input.range,
        hint: "Annotate visible numbers with one furigana block on the full chunk, for example {{4|よん}}, {{5000|ごせん}}, or {{1枚|いちまい}}."
      })
    );
  }
}

export function reportImageAltKanjiIssue(
  alt: string,
  filePath: string,
  sourcePath: string,
  range: SourceRange | undefined,
  issues: ValidationIssue[]
) {
  if (!bareKanjiPattern.test(alt)) {
    return;
  }

  issues.push(
    createIssue({
      code: "image.alt-bare-kanji",
      category: "schema",
      message:
        "Image alt text contains kanji, but alt strings cannot render furigana or semantic references.",
      filePath,
      path: sourcePath,
      range,
      hint: "Rewrite the alt in Italian or with kana/katakana only; keep kanji support in the visible caption instead."
    })
  );
}

export function reportImageCaptionKanjiIssue(
  nodes: InlineNode[],
  filePath: string,
  sourcePath: string,
  range: SourceRange | undefined,
  issues: ValidationIssue[]
) {
  if (!inlineNodesContainBareKanji(nodes)) {
    return;
  }

  issues.push(
    createIssue({
      code: "image.caption-bare-kanji",
      category: "schema",
      message: "Image caption contains visible kanji outside furigana markup.",
      filePath,
      path: sourcePath,
      range,
      hint: "Annotate visible labels with furigana, or use a semantic reference whose label is fully annotated, for example [{{報酬確認|ほうしゅうかくにん}}](term:...)."
    })
  );
}

function getUnsafeYamlPlainScalarReason(key: string, value: string) {
  if (usesDescriptivePlainScalar(key, value)) {
    return {
      kind: "descriptive-prose" as const
    };
  }

  if (containsUnsafeInlineYamlContent(value)) {
    return {
      kind: "markdown-rich" as const
    };
  }

  if (isCardTextExamplePlainScalar(key, value)) {
    return {
      kind: "card-text-example" as const
    };
  }

  return null;
}

function usesDescriptivePlainScalar(key: string, value: string) {
  return (
    ["notes_it", "summary", "description", "notes"].includes(key) &&
    value.trim().length > 0
  );
}

function containsUnsafeInlineYamlContent(value: string) {
  return (
    value.includes(":") ||
    value.includes("：") ||
    /\{\{[^|}]+\|[^}]+\}\}/.test(value) ||
    /\[[^\]]+\]\((?:term|grammar):[^)]+\)/.test(value) ||
    /`[^`]+`/.test(value)
  );
}

function isCardTextExamplePlainScalar(key: string, value: string) {
  if (
    key !== "front" &&
    key !== "back" &&
    key !== "example_jp" &&
    key !== "example_it"
  ) {
    return false;
  }

  return (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) &&
    (/[。！？]/u.test(value) || (value.includes("、") && value.length >= 12))
  );
}

function formatUnsafeYamlPlainScalarMessage(
  key: string,
  reason: "descriptive-prose" | "markdown-rich" | "card-text-example"
) {
  if (reason === "descriptive-prose") {
    return `Field '${key}' uses a plain YAML scalar for descriptive prose.`;
  }

  if (reason === "card-text-example") {
    return `Field '${key}' uses a plain YAML scalar for a full card-text example.`;
  }

  return `Field '${key}' uses a plain YAML scalar that is fragile for markdown-rich content.`;
}

function formatUnsafeYamlPlainScalarHint(
  key: string,
  reason: "descriptive-prose" | "markdown-rich" | "card-text-example"
) {
  if (reason === "card-text-example") {
    return `Rewrite '${key}' as a block scalar with >- when embedding full rules-text examples.`;
  }

  return `Rewrite '${key}' as a block scalar with >- to keep the value stable.`;
}

function inlineNodesContainBareKanji(nodes: InlineNode[]): boolean {
  return nodes.some((node) => {
    switch (node.type) {
      case "text":
        return bareKanjiPattern.test(node.value);
      case "furigana":
      case "break":
        return false;
      case "reference":
      case "emphasis":
      case "strong":
      case "inlineCode":
      case "link":
        return inlineNodesContainBareKanji(node.children);
    }
  });
}

function inlineNodesContainJapaneseScript(nodes: InlineNode[]): boolean {
  return nodes.some((node) => {
    switch (node.type) {
      case "text":
        return japaneseScriptPattern.test(node.value);
      case "furigana":
        return (
          japaneseScriptPattern.test(node.base) ||
          japaneseScriptPattern.test(node.reading)
        );
      case "break":
        return false;
      case "reference":
      case "emphasis":
      case "strong":
      case "inlineCode":
      case "link":
        return inlineNodesContainJapaneseScript(node.children);
    }
  });
}

function inlineNodesContainBareNumerals(nodes: InlineNode[]): boolean {
  return nodes.some((node) => {
    switch (node.type) {
      case "text":
        return bareNumeralPattern.test(node.value);
      case "furigana":
      case "break":
        return false;
      case "reference":
      case "emphasis":
      case "strong":
      case "inlineCode":
      case "link":
        return inlineNodesContainBareNumerals(node.children);
    }
  });
}

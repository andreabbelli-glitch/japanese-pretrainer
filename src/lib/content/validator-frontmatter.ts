import {
  lessonStatusValues,
  mediaStatusValues
} from "../../domain/content.ts";
import { isUrlSafeSlug } from "./parser/utils.ts";
import {
  bareKanjiPattern,
  containsUnsupportedLessonSummaryMarkup,
  readOptionalString,
  readOptionalStringArray,
  readRequiredInteger,
  readRequiredString,
  reportUnknownKeys,
  reportUnsafeYamlPlainScalars
} from "./validator-fields.ts";
import { createIssue } from "./parser/utils.ts";
import type {
  CardsFrontmatter,
  LessonFrontmatter,
  MediaFrontmatter,
  SourceRange,
  ValidationIssue
} from "./types.ts";

export function normalizeMediaFrontmatter(
  raw: Record<string, unknown> | null,
  filePath: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
): MediaFrontmatter | null {
  const scope = "frontmatter";

  if (!raw) {
    return null;
  }

  reportUnknownKeys(
    raw,
    [
      "id",
      "slug",
      "title",
      "media_type",
      "segment_kind",
      "language",
      "base_explanation_language",
      "subtitle",
      "description",
      "tags",
      "cover_image",
      "notes",
      "status"
    ],
    filePath,
    scope,
    issues
  );
  reportUnsafeYamlPlainScalars(
    raw,
    ["description", "notes"],
    filePath,
    scope,
    fieldRanges,
    fieldStyles,
    issues
  );

  const id = readRequiredString(raw, "id", filePath, scope, issues);
  const slug = readRequiredString(raw, "slug", filePath, scope, issues);
  const title = readRequiredString(raw, "title", filePath, scope, issues);
  const mediaType = readRequiredString(
    raw,
    "media_type",
    filePath,
    scope,
    issues
  );
  const segmentKind = readRequiredString(
    raw,
    "segment_kind",
    filePath,
    scope,
    issues
  );
  const language = readRequiredString(raw, "language", filePath, scope, issues);
  const baseExplanationLanguage = readRequiredString(
    raw,
    "base_explanation_language",
    filePath,
    scope,
    issues
  );
  const subtitle = readOptionalString(raw, "subtitle", filePath, scope, issues);
  const description = readOptionalString(
    raw,
    "description",
    filePath,
    scope,
    issues
  );
  const tags =
    readOptionalStringArray(raw, "tags", filePath, scope, issues) ?? [];
  const coverImage = readOptionalString(
    raw,
    "cover_image",
    filePath,
    scope,
    issues
  );
  const notes = readOptionalString(raw, "notes", filePath, scope, issues);
  const status = readOptionalString(raw, "status", filePath, scope, issues);

  if (slug && !isUrlSafeSlug(slug)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-slug",
        category: "schema",
        message: "Slug must be URL-safe.",
        filePath,
        path: `${scope}.slug`,
        hint: "Use a path-safe slug without spaces or slashes."
      })
    );
  }

  if (status && !(mediaStatusValues as readonly string[]).includes(status)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-status",
        category: "schema",
        message: `Invalid media status '${status}'.`,
        filePath,
        path: `${scope}.status`,
        hint: `Use one of: ${mediaStatusValues.join(", ")}.`
      })
    );
  }

  if (description && bareKanjiPattern.test(description)) {
    issues.push(
      createIssue({
        code: "frontmatter.description-bare-kanji",
        category: "schema",
        message:
          "Media description is plain text and cannot render furigana, so visible kanji should be avoided.",
        filePath,
        path: `${scope}.description`,
        range: fieldRanges.description,
        hint: "Rewrite the description in Italian or with kana/katakana only."
      })
    );
  }

  if (
    !id ||
    !slug ||
    !title ||
    !mediaType ||
    !segmentKind ||
    !language ||
    !baseExplanationLanguage
  ) {
    return null;
  }

  return {
    id,
    slug,
    title,
    mediaType,
    segmentKind,
    language,
    baseExplanationLanguage,
    subtitle: subtitle ?? undefined,
    description: description ?? undefined,
    status: status ?? undefined,
    tags,
    coverImage: coverImage ?? undefined,
    notes: notes ?? undefined
  };
}

export function normalizeLessonFrontmatter(
  raw: Record<string, unknown> | null,
  filePath: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
): LessonFrontmatter | null {
  const scope = "frontmatter";

  if (!raw) {
    return null;
  }

  reportUnknownKeys(
    raw,
    [
      "id",
      "media_id",
      "slug",
      "title",
      "order",
      "segment_ref",
      "difficulty",
      "tags",
      "status",
      "summary",
      "prerequisites"
    ],
    filePath,
    scope,
    issues
  );
  reportUnsafeYamlPlainScalars(
    raw,
    ["summary"],
    filePath,
    scope,
    fieldRanges,
    fieldStyles,
    issues
  );

  const id = readRequiredString(raw, "id", filePath, scope, issues);
  const mediaId = readRequiredString(raw, "media_id", filePath, scope, issues);
  const slug = readRequiredString(raw, "slug", filePath, scope, issues);
  const title = readRequiredString(raw, "title", filePath, scope, issues);
  const order = readRequiredInteger(raw, "order", filePath, scope, issues);
  const segmentRef = readOptionalString(
    raw,
    "segment_ref",
    filePath,
    scope,
    issues
  );
  const difficulty = readOptionalString(
    raw,
    "difficulty",
    filePath,
    scope,
    issues
  );
  const tags =
    readOptionalStringArray(raw, "tags", filePath, scope, issues) ?? [];
  const status = readOptionalString(raw, "status", filePath, scope, issues);
  const summary = readOptionalString(raw, "summary", filePath, scope, issues);
  const prerequisites =
    readOptionalStringArray(raw, "prerequisites", filePath, scope, issues) ??
    [];

  if (summary && containsUnsupportedLessonSummaryMarkup(summary)) {
    issues.push(
      createIssue({
        code: "frontmatter.summary-plain-text-only",
        category: "schema",
        message:
          "Lesson summary must be plain text; semantic links, furigana markup, and inline code are rendered literally in the UI.",
        filePath,
        path: `${scope}.summary`,
        range: fieldRanges.summary,
        hint: "Rewrite the summary as plain text without semantic links, furigana markup, or backticks.",
        details: {
          field: "summary"
        }
      })
    );
  }

  if (summary && bareKanjiPattern.test(summary)) {
    issues.push(
      createIssue({
        code: "frontmatter.summary-bare-kanji",
        category: "schema",
        message:
          "Lesson summary is plain text and cannot render furigana, so visible kanji should be avoided.",
        filePath,
        path: `${scope}.summary`,
        range: fieldRanges.summary,
        hint: "Rewrite the summary in Italian or with kana/katakana only."
      })
    );
  }

  if (slug && !isUrlSafeSlug(slug)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-slug",
        category: "schema",
        message: "Lesson slug must be URL-safe.",
        filePath,
        path: `${scope}.slug`
      })
    );
  }

  if (status && !(lessonStatusValues as readonly string[]).includes(status)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-status",
        category: "schema",
        message: `Invalid lesson status '${status}'.`,
        filePath,
        path: `${scope}.status`,
        hint: `Use one of: ${lessonStatusValues.join(", ")}.`
      })
    );
  }

  if (!id || !mediaId || !slug || !title || order === undefined) {
    return null;
  }

  return {
    id,
    mediaId,
    slug,
    title,
    order,
    segmentRef: segmentRef ?? undefined,
    difficulty: difficulty ?? undefined,
    tags,
    status: status ?? undefined,
    summary: summary ?? undefined,
    prerequisites
  };
}

export function normalizeCardsFrontmatter(
  raw: Record<string, unknown> | null,
  filePath: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
): CardsFrontmatter | null {
  const scope = "frontmatter";

  if (!raw) {
    return null;
  }

  reportUnknownKeys(
    raw,
    ["id", "media_id", "slug", "title", "order", "segment_ref"],
    filePath,
    scope,
    issues
  );

  const id = readRequiredString(raw, "id", filePath, scope, issues);
  const mediaId = readRequiredString(raw, "media_id", filePath, scope, issues);
  const slug = readRequiredString(raw, "slug", filePath, scope, issues);
  const title = readRequiredString(raw, "title", filePath, scope, issues);
  const order = readRequiredInteger(raw, "order", filePath, scope, issues);
  const segmentRef = readOptionalString(
    raw,
    "segment_ref",
    filePath,
    scope,
    issues
  );

  if (slug && !isUrlSafeSlug(slug)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-slug",
        category: "schema",
        message: "Cards slug must be URL-safe.",
        filePath,
        path: `${scope}.slug`
      })
    );
  }

  if (!id || !mediaId || !slug || !title || order === undefined) {
    return null;
  }

  return {
    id,
    mediaId,
    slug,
    title,
    order,
    segmentRef: segmentRef ?? undefined
  };
}

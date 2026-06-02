import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ContentNextIdPlan } from "./next-id.ts";
import { parseFrontmatter } from "../parser/frontmatter.ts";
import { normalizeLessonFrontmatter } from "../validator-frontmatter.ts";
import type { ValidationIssue } from "../types.ts";

export type ContentScaffoldPlan = {
  commands: {
    import: null;
    validate: string;
  };
  files: {
    cards: {
      action: "not-created";
      path: string;
      reason: string;
    };
    textbook: {
      action: "create";
      path: string;
    };
  };
  next: ContentNextIdPlan["next"];
  schema_version: 1;
  status: "ready";
  warnings: string[];
};

export type ContentScaffoldWriteResult = Omit<ContentScaffoldPlan, "status"> & {
  status: "created";
};

export function buildContentScaffoldPlan(input: {
  difficulty?: string;
  nextIdPlan: ContentNextIdPlan;
  summary?: string;
  tags?: string[];
  title: string;
}): ContentScaffoldPlan {
  const warnings = [
    ...input.nextIdPlan.warnings,
    "cards file not created; create it only when real card blocks are ready."
  ];

  return {
    commands: {
      import: null,
      validate: [
        "./scripts/with-node.sh",
        "pnpm",
        "content:validate",
        "--",
        "--content-root",
        input.nextIdPlan.content_root,
        "--media-slug",
        input.nextIdPlan.media.slug
      ].join(" ")
    },
    files: {
      cards: {
        action: "not-created",
        path: input.nextIdPlan.next.paths.cards,
        reason: "cards files require real :::card blocks to validate"
      },
      textbook: {
        action: "create",
        path: input.nextIdPlan.next.paths.textbook
      }
    },
    next: input.nextIdPlan.next,
    schema_version: 1,
    status: "ready",
    warnings
  } satisfies ContentScaffoldPlan;
}

export function renderTextbookScaffold(input: {
  difficulty?: string;
  mediaId: string;
  nextIdPlan: ContentNextIdPlan;
  summary?: string;
  tags?: string[];
  title: string;
}) {
  assertSingleLinePlainText(input.title, "title");
  const frontmatterLines = [
    "id: " + quoteYamlString(input.nextIdPlan.next.lesson_id),
    "media_id: " + quoteYamlString(input.mediaId),
    "slug: " + quoteYamlString(input.nextIdPlan.next.lesson_slug),
    "title: " + quoteYamlString(input.title),
    "order: " + input.nextIdPlan.next.order,
    input.difficulty
      ? "difficulty: " + quoteYamlString(input.difficulty)
      : null,
    input.nextIdPlan.next.segment_ref
      ? "segment_ref: " + quoteYamlString(input.nextIdPlan.next.segment_ref)
      : null,
    "status: active",
    "tags: " + formatYamlStringArray(input.tags ?? []),
    input.summary ? "summary: " + quoteYamlString(input.summary) : null,
    "prerequisites: []"
  ].filter((line): line is string => line !== null);

  return `---\n${frontmatterLines.join("\n")}\n---\n\n# ${input.title}\n`;
}

export async function writeContentScaffold(input: {
  plan: ContentScaffoldPlan;
  repositoryRoot?: string;
  textbookSource: string;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const textbookPath = path.resolve(
    repositoryRoot,
    input.plan.files.textbook.path
  );

  assertValidTextbookScaffoldSource(input.textbookSource, textbookPath);
  await mkdir(path.dirname(textbookPath), { recursive: true });
  await writeFile(textbookPath, input.textbookSource, {
    encoding: "utf8",
    flag: "wx"
  });

  return {
    ...input.plan,
    status: "created"
  } satisfies ContentScaffoldWriteResult;
}

export function formatContentScaffoldResult(
  result: ContentScaffoldPlan | ContentScaffoldWriteResult
) {
  return `${[
    `SCAFFOLD ${result.status}`,
    `TEXTBOOK ${result.files.textbook.path}`,
    `CARDS ${result.files.cards.action} ${result.files.cards.path}`,
    `CARDS_REASON ${result.files.cards.reason}`,
    `LESSON_ID ${result.next.lesson_id}`,
    `LESSON_SLUG ${result.next.lesson_slug}`,
    `ORDER ${result.next.order}`,
    `VALIDATE ${result.commands.validate}`,
    "IMPORT withheld; fill the lesson body and real cards first, then run content:scope.",
    ...result.warnings.map((warning) => `WARNING ${warning}`)
  ].join("\n")}\n`;
}

function quoteYamlString(value: string) {
  return JSON.stringify(value);
}

function assertSingleLinePlainText(value: string, fieldName: string) {
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(
      `content:scaffold refused ${fieldName} with control characters or line breaks.`
    );
  }
}

export function assertValidTextbookScaffoldSource(
  source: string,
  filePath: string
) {
  const parsed = parseFrontmatter(source, filePath);
  const issues: ValidationIssue[] = [...parsed.issues];

  normalizeLessonFrontmatter(
    parsed.data,
    filePath,
    parsed.fieldRanges,
    parsed.fieldStyles,
    issues
  );

  if (issues.length === 0) {
    return;
  }

  throw new Error(
    [
      "content:scaffold refused to write invalid textbook frontmatter.",
      ...issues.map((issue) => `${issue.code} ${issue.message}`)
    ].join("\n")
  );
}

function formatYamlStringArray(values: string[]) {
  if (values.length === 0) {
    return "[]";
  }

  return `[${values.map(quoteYamlString).join(", ")}]`;
}

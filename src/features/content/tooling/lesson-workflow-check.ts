import path from "node:path";

import type { DatabaseClient } from "../../../db/client.ts";
import {
  resolveRevalidatedLessons,
  revalidateImportedContentCache,
  type ContentCacheRevalidationResult
} from "../importer/cache-revalidation.ts";
import type { ImportContentResult } from "../importer/types.ts";
import { parseMediaDirectory } from "../validator.ts";
import type { NormalizedMediaBundle, ValidationIssue } from "../types.ts";
import {
  lintEditorialContent,
  type EditorialLintResult,
  type EditorialLintWarning
} from "./editorial-lint.ts";
import { buildContentScopePlan, type ContentScopeMediaPlan } from "./scope.ts";

export type LessonWorkflowCheckMode = "check" | "import";
export type LessonWorkflowCheckStatus = "attention" | "failed" | "pass";

export type LessonWorkflowCheckResult = {
  checks: Array<{
    name: "editorial" | "scope" | "validate";
    status: "fail" | "pass" | "warn";
  }>;
  commands: {
    import: string | null;
    validate: string;
  };
  editorial: {
    counts: EditorialLintResult["counts"];
    truncated: boolean;
    warnings: EditorialLintWarning[];
  };
  import_result?: {
    files_changed: number;
    files_scanned: number;
    import_id: string;
    status: "completed";
  };
  import_status: "completed" | "planned" | "withheld";
  lesson_slugs: string[];
  media_slug: string;
  mode: LessonWorkflowCheckMode;
  notes: string[];
  revalidation?: ContentCacheRevalidationResult;
  schema_version: 1;
  scope: {
    lesson_slugs: string[];
    mode: ContentScopeMediaPlan["mode"];
  };
  status: LessonWorkflowCheckStatus;
  summary: {
    cards: number;
    cards_files: number;
    files: number;
    grammar: number;
    lessons: number;
    terms: number;
  };
  warnings: string[];
};

export type LessonWorkflowCheckImportInput = {
  contentRoot: string;
  database: DatabaseClient;
  lessonSlugs: string[];
  mediaSlug: string;
};

export type LessonWorkflowCheckInput = {
  allowEditorialWarnings?: boolean;
  contentRoot: string;
  database?: DatabaseClient;
  import?: boolean;
  importContent?: (
    input: LessonWorkflowCheckImportInput
  ) => Promise<ImportContentResult>;
  lessonSlugs: string[];
  limit?: number;
  mediaSlug: string;
  repositoryRoot?: string;
};

export class LessonWorkflowCheckFailure extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

const safeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export async function runLessonWorkflowCheck(
  input: LessonWorkflowCheckInput
): Promise<LessonWorkflowCheckResult> {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const contentRoot = path.resolve(repositoryRoot, input.contentRoot);
  const mediaSlug = normalizeSlug(input.mediaSlug, "--media-slug");
  const lessonSlugs = [...new Set(input.lessonSlugs)].map((lessonSlug) =>
    normalizeSlug(lessonSlug, "--lesson-slug")
  );
  const mode: LessonWorkflowCheckMode = input.import ? "import" : "check";

  if (lessonSlugs.length === 0) {
    throw new LessonWorkflowCheckFailure(
      "Provide at least one --lesson-slug.",
      1
    );
  }

  const parseResult = await parseMediaDirectory(
    path.join(contentRoot, "media", mediaSlug)
  );
  const validateCommand = buildValidateCommand({
    contentRoot,
    mediaSlug,
    repositoryRoot
  });

  if (!parseResult.ok) {
    return {
      checks: [
        { name: "validate", status: "fail" },
        { name: "editorial", status: "fail" },
        { name: "scope", status: "fail" }
      ],
      commands: {
        import: null,
        validate: validateCommand
      },
      editorial: emptyEditorialResult(),
      import_status: "withheld",
      lesson_slugs: lessonSlugs,
      media_slug: mediaSlug,
      mode,
      notes: [],
      schema_version: 1,
      scope: {
        lesson_slugs: [],
        mode: "no-import"
      },
      status: "failed",
      summary: emptySummary(),
      warnings: formatValidationWarnings(parseResult.issues)
    };
  }

  const mediaBundle = parseResult.data;
  assertLessonsExist(mediaBundle, lessonSlugs);
  const scopePlan = await buildLessonScopePlan({
    contentRoot,
    lessonSlugs,
    mediaBundle,
    mediaSlug,
    repositoryRoot
  });
  const importCommand = scopePlan.importCommand;
  const editorial = lintEditorialContent({
    bundles: [mediaBundle],
    lessonSlugs,
    limit: input.limit,
    repositoryRoot
  });
  const hasEditorialWarnings = editorial.counts.total > 0;
  const allowEditorialWarnings = input.allowEditorialWarnings ?? false;
  const notes: string[] = [];
  const warnings: string[] = [];
  const checks: LessonWorkflowCheckResult["checks"] = [
    { name: "validate", status: "pass" },
    {
      name: "editorial",
      status: hasEditorialWarnings ? "warn" : "pass"
    },
    { name: "scope", status: "pass" }
  ];
  let status: LessonWorkflowCheckStatus = hasEditorialWarnings
    ? "attention"
    : "pass";
  let importStatus: LessonWorkflowCheckResult["import_status"] = input.import
    ? "withheld"
    : "planned";
  let importResult: ImportContentResult | null = null;
  let revalidationResult: ContentCacheRevalidationResult | null = null;

  if (hasEditorialWarnings && !allowEditorialWarnings) {
    importStatus = "withheld";
    warnings.push("editorial warnings block import");
    notes.push(
      "fix editorial warnings, or rerun with --allow-editorial-warnings only after explicit review"
    );
  } else if (input.import) {
    if (!input.database || !input.importContent) {
      throw new LessonWorkflowCheckFailure(
        "Internal error: --import requires a database client and importer.",
        4
      );
    }

    importResult = await input.importContent({
      contentRoot,
      database: input.database,
      lessonSlugs,
      mediaSlug
    });

    if (importResult.status === "failed") {
      return {
        checks,
        commands: {
          import: importCommand,
          validate: validateCommand
        },
        editorial: formatEditorialSummary(editorial),
        import_status: "withheld",
        lesson_slugs: lessonSlugs,
        media_slug: mediaSlug,
        mode,
        notes: [importResult.message],
        schema_version: 1,
        scope: {
          lesson_slugs: scopePlan.lessonSlugs,
          mode: scopePlan.mode
        },
        status: "failed",
        summary: summarizeBundle(mediaBundle),
        warnings: [
          "import failed",
          ...formatValidationWarnings(importResult.issues)
        ]
      };
    }

    importStatus = "completed";
    status = hasEditorialWarnings ? "attention" : "pass";
    notes.push("lesson-scoped import completed");
    revalidationResult = await revalidateImportedContentCache({
      importId: importResult.importId,
      lessons: resolveRevalidatedLessons({
        lessonSlugs,
        parseBundles: importResult.parseResult.data.bundles
      }),
      mediaSlugs: importResult.parseResult.data.bundles.map(
        (bundle) => bundle.mediaSlug
      )
    });
    notes.push(revalidationResult.message);

    if (revalidationResult.status === "failed") {
      status = "failed";
      warnings.push("cache revalidation failed");
    }
  } else {
    notes.push("import not run; rerun with --import when DB sync is intended");
  }

  return {
    checks,
    commands: {
      import: importCommand,
      validate: validateCommand
    },
    editorial: formatEditorialSummary(editorial),
    ...(importResult?.status === "completed"
      ? {
          import_result: {
            files_changed: importResult.filesChanged,
            files_scanned: importResult.filesScanned,
            import_id: importResult.importId,
            status: "completed" as const
          }
        }
      : {}),
    import_status: importStatus,
    lesson_slugs: lessonSlugs,
    media_slug: mediaSlug,
    mode,
    notes,
    ...(revalidationResult ? { revalidation: revalidationResult } : {}),
    schema_version: 1,
    scope: {
      lesson_slugs: scopePlan.lessonSlugs,
      mode: scopePlan.mode
    },
    status,
    summary: summarizeBundle(mediaBundle),
    warnings
  };
}

export function formatLessonWorkflowCheckResult(
  result: LessonWorkflowCheckResult
) {
  const lines = [
    [
      `LESSON_WORKFLOW_CHECK ${result.status}`,
      `media=${result.media_slug}`,
      `lessons=${result.lesson_slugs.length}`,
      `mode=${result.mode}`
    ].join(" "),
    [
      "VALIDATE",
      findCheckStatus(result, "validate"),
      `files=${result.summary.files}`,
      `lessons=${result.summary.lessons}`,
      `cards_files=${result.summary.cards_files}`,
      `terms=${result.summary.terms}`,
      `grammar=${result.summary.grammar}`,
      `cards=${result.summary.cards}`,
      `command=${quoteForLine(result.commands.validate)}`
    ].join(" "),
    [
      "EDITORIAL",
      findCheckStatus(result, "editorial"),
      `warnings=${result.editorial.counts.total}`,
      `P0=${result.editorial.counts.P0}`,
      `P1=${result.editorial.counts.P1}`
    ].join(" "),
    [
      "SCOPE",
      result.scope.mode,
      `lessons=${result.scope.lesson_slugs.join(",")}`
    ].join(" ")
  ];

  for (const warning of result.editorial.warnings) {
    lines.push(
      [
        "WARNING",
        warning.severity,
        warning.code,
        `${warning.sourcePath}${warning.line ? `:${warning.line}` : ""}`,
        `message=${quoteForLine(warning.message)}`,
        `snippet=${quoteForLine(warning.snippet)}`
      ].join(" ")
    );
  }

  for (const warning of result.warnings) {
    lines.push(`WARNING ${warning}`);
  }

  if (result.import_status === "completed" && result.import_result) {
    lines.push(
      [
        "IMPORT completed",
        `import_id=${result.import_result.import_id}`,
        `files_scanned=${result.import_result.files_scanned}`,
        `files_changed=${result.import_result.files_changed}`
      ].join(" ")
    );
  } else if (result.commands.import) {
    lines.push(
      [
        `IMPORT ${result.import_status}`,
        `command=${quoteForLine(result.commands.import)}`
      ].join(" ")
    );
  } else {
    lines.push(`IMPORT ${result.import_status}`);
  }

  if (result.revalidation) {
    lines.push(
      `CACHE_REVALIDATION ${result.revalidation.status} message=${quoteForLine(
        result.revalidation.message
      )}`
    );
  }

  for (const note of result.notes) {
    lines.push(`NOTE ${note}`);
  }

  return `${lines.join("\n")}\n`;
}

export function getLessonWorkflowCheckExitCode(
  result: LessonWorkflowCheckResult
) {
  if (result.status === "pass") {
    return 0;
  }

  if (
    result.status === "attention" &&
    !result.warnings.includes("editorial warnings block import")
  ) {
    return 0;
  }

  if (result.warnings.includes("editorial warnings block import")) {
    return 3;
  }

  if (result.warnings.includes("import failed")) {
    return 4;
  }

  if (result.warnings.includes("cache revalidation failed")) {
    return 4;
  }

  return 2;
}

function normalizeSlug(value: string, flag: string) {
  if (!safeSlugPattern.test(value)) {
    throw new LessonWorkflowCheckFailure(
      `${flag} must be a URL-safe lowercase slug.`,
      1
    );
  }

  return value;
}

function assertLessonsExist(
  mediaBundle: NormalizedMediaBundle,
  lessonSlugs: string[]
) {
  const existingSlugs = new Set(
    mediaBundle.lessons.map((lesson) => lesson.frontmatter.slug)
  );
  const missingSlugs = lessonSlugs.filter(
    (lessonSlug) => !existingSlugs.has(lessonSlug)
  );

  if (missingSlugs.length > 0) {
    throw new LessonWorkflowCheckFailure(
      `Unknown lesson slug(s): ${missingSlugs.join(",")}.`,
      1
    );
  }
}

async function buildLessonScopePlan(input: {
  contentRoot: string;
  lessonSlugs: string[];
  mediaBundle: NormalizedMediaBundle;
  mediaSlug: string;
  repositoryRoot: string;
}) {
  const lessonSlugSet = new Set(input.lessonSlugs);
  const lessonPaths = input.mediaBundle.lessons
    .filter((lesson) => lessonSlugSet.has(lesson.frontmatter.slug))
    .map((lesson) => lesson.sourceFile);
  const cardsPaths = input.mediaBundle.cardFiles
    .filter((cardsFile) => lessonSlugSet.has(cardsFile.frontmatter.slug))
    .map((cardsFile) => cardsFile.sourceFile);
  const scopePlan = await buildContentScopePlan({
    changes: [...lessonPaths, ...cardsPaths].map((filePath) => ({
      path: filePath,
      status: "modified" as const
    })),
    contentRoot: input.contentRoot,
    repositoryRoot: input.repositoryRoot
  });
  const mediaPlan = scopePlan.media.find(
    (candidate) => candidate.mediaSlug === input.mediaSlug
  );

  if (!mediaPlan || mediaPlan.mode !== "lesson" || !mediaPlan.importCommand) {
    throw new LessonWorkflowCheckFailure(
      "content:lesson-workflow-check refused because the resolved content scope is not lesson-scoped. Use content:scope for media-wide or ambiguous changes.",
      2
    );
  }

  const resolvedLessonSlugs = new Set(mediaPlan.lessonSlugs);
  const missingLessonSlugs = input.lessonSlugs.filter(
    (lessonSlug) => !resolvedLessonSlugs.has(lessonSlug)
  );

  if (missingLessonSlugs.length > 0) {
    throw new LessonWorkflowCheckFailure(
      `content:lesson-workflow-check refused because resolved scope did not include requested lesson(s): ${missingLessonSlugs.join(",")}.`,
      2
    );
  }

  return mediaPlan;
}

function buildValidateCommand(input: {
  contentRoot: string;
  mediaSlug: string;
  repositoryRoot: string;
}) {
  return [
    "./scripts/with-node.sh pnpm content:validate --",
    ...buildContentRootArgs(input.contentRoot, input.repositoryRoot),
    "--media-slug",
    input.mediaSlug
  ].join(" ");
}

function buildContentRootArgs(contentRoot: string, repositoryRoot: string) {
  const relativeContentRoot = relativeSource(contentRoot, repositoryRoot);

  return relativeContentRoot === "content"
    ? []
    : ["--content-root", relativeContentRoot];
}

function summarizeBundle(mediaBundle: NormalizedMediaBundle) {
  return {
    cards: mediaBundle.cards.length,
    cards_files: mediaBundle.cardFiles.length,
    files:
      (mediaBundle.media ? 1 : 0) +
      mediaBundle.lessons.length +
      mediaBundle.cardFiles.length,
    grammar: mediaBundle.grammarPatterns.length,
    lessons: mediaBundle.lessons.length,
    terms: mediaBundle.terms.length
  };
}

function emptySummary(): LessonWorkflowCheckResult["summary"] {
  return {
    cards: 0,
    cards_files: 0,
    files: 0,
    grammar: 0,
    lessons: 0,
    terms: 0
  };
}

function formatEditorialSummary(
  result: EditorialLintResult
): LessonWorkflowCheckResult["editorial"] {
  return {
    counts: result.counts,
    truncated: result.truncated,
    warnings: result.warnings
  };
}

function emptyEditorialResult(): LessonWorkflowCheckResult["editorial"] {
  return {
    counts: {
      P0: 0,
      P1: 0,
      total: 0
    },
    truncated: false,
    warnings: []
  };
}

function formatValidationWarnings(issues: ValidationIssue[]) {
  return issues
    .slice(0, 20)
    .map(
      (issue) => `${issue.code} ${issue.location.filePath}: ${issue.message}`
    );
}

function findCheckStatus(
  result: LessonWorkflowCheckResult,
  name: LessonWorkflowCheckResult["checks"][number]["name"]
) {
  return result.checks.find((check) => check.name === name)?.status ?? "fail";
}

function relativeSource(filePath: string, repositoryRoot: string) {
  const relative = path.relative(repositoryRoot, filePath);

  return (relative.length > 0 ? relative : filePath).replaceAll("\\", "/");
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

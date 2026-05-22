import path from "node:path";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db, type DatabaseClient } from "../../../db/client.ts";
import { contentImport } from "../../../db/schema/index.ts";

import { parseContentRoot } from "../validator.ts";
import { syncContentWorkspace } from "./sync.ts";
import type { ImportContentOptions, ImportContentResult } from "./types.ts";

export async function importContentWorkspace(
  options: ImportContentOptions
): Promise<ImportContentResult> {
  const database = options.database ?? db;
  const contentRoot = path.resolve(options.contentRoot);
  const importId = options.importId ?? `content_import_${randomUUID()}`;
  const startedAt = (options.now ?? new Date()).toISOString();
  const mediaSlugs = normalizeMediaSlugs(options.mediaSlugs);
  const lessonSlugs = normalizeLessonSlugs(options.lessonSlugs);

  await database.insert(contentImport).values({
    id: importId,
    startedAt,
    finishedAt: null,
    status: "running",
    filesScanned: 0,
    filesChanged: 0,
    message: `Parsing content root ${contentRoot}.`
  });

  try {
    const importScope = resolveImportScope({ lessonSlugs, mediaSlugs });

    if (importScope.status === "failed") {
      await updateImportRecord(database, {
        id: importId,
        filesScanned: 0,
        filesChanged: 0,
        finishedAt: new Date().toISOString(),
        message: importScope.message,
        status: "failed"
      });

      return {
        filesChanged: 0,
        filesScanned: 0,
        importId,
        issues: [],
        message: importScope.message,
        parseResult: {
          data: {
            contentRoot,
            bundles: []
          },
          issues: [],
          ok: false
        },
        status: "failed"
      };
    }

    const parseResult = await parseContentRoot(contentRoot);
    const filesScanned = countScannedFiles(parseResult.data);

    if (!parseResult.ok) {
      const message = `Import aborted: ${parseResult.issues.length} validation issue(s).`;

      await updateImportRecord(database, {
        id: importId,
        filesScanned,
        filesChanged: 0,
        finishedAt: new Date().toISOString(),
        message,
        status: "failed"
      });

      return {
        filesChanged: 0,
        filesScanned,
        importId,
        issues: parseResult.issues,
        message,
        parseResult,
        status: "failed"
      };
    }

    const scopedWorkspace = selectWorkspaceBundles(
      parseResult.data,
      importScope.scope
    );

    if (scopedWorkspace.status === "failed") {
      const message = scopedWorkspace.message;

      await updateImportRecord(database, {
        id: importId,
        filesScanned,
        filesChanged: 0,
        finishedAt: new Date().toISOString(),
        message,
        status: "failed"
      });

      return {
        filesChanged: 0,
        filesScanned,
        importId,
        issues: [],
        message,
        parseResult,
        status: "failed"
      };
    }

    const syncResult = await database.transaction((transaction) =>
      syncContentWorkspace(transaction, {
        contentRoot,
        importId,
        lessonScopes: scopedWorkspace.lessonScopes,
        nowIso: startedAt,
        syncMode: importScope.scope.type,
        workspace: scopedWorkspace.workspace
      })
    );
    const message = buildSuccessMessage(
      scopedWorkspace.workspace.bundles.length,
      syncResult.summary
    );

    await updateImportRecord(database, {
      id: importId,
      filesScanned,
      filesChanged: syncResult.filesChanged,
      finishedAt: new Date().toISOString(),
      message,
      status: "completed"
    });

    return {
      filesChanged: syncResult.filesChanged,
      filesScanned,
      importId,
      issues: [],
      parseResult: {
        ...parseResult,
        data: scopedWorkspace.workspace
      },
      status: "completed",
      summary: syncResult.summary
    };
  } catch (error) {
    await updateImportRecord(database, {
      id: importId,
      filesScanned: 0,
      filesChanged: 0,
      finishedAt: new Date().toISOString(),
      message: formatUnexpectedError(error),
      status: "failed"
    });

    throw error;
  }
}

async function updateImportRecord(
  database: DatabaseClient,
  row: Partial<typeof contentImport.$inferInsert> & { id: string }
) {
  await database
    .update(contentImport)
    .set({
      filesChanged: row.filesChanged,
      filesScanned: row.filesScanned,
      finishedAt: row.finishedAt,
      message: row.message,
      status: row.status
    })
    .where(eq(contentImport.id, row.id));
}

function countScannedFiles(workspace: {
  bundles: Array<{
    cardFiles: unknown[];
    lessons: unknown[];
    media: unknown | null;
  }>;
}) {
  return workspace.bundles.reduce((total, bundle) => {
    return (
      total +
      (bundle.media ? 1 : 0) +
      bundle.lessons.length +
      bundle.cardFiles.length
    );
  }, 0);
}

function normalizeMediaSlugs(mediaSlugs: string[] | undefined) {
  return [
    ...new Set((mediaSlugs ?? []).map((slug) => slug.trim()).filter(Boolean))
  ];
}

function normalizeLessonSlugs(lessonSlugs: string[] | undefined) {
  return [
    ...new Set((lessonSlugs ?? []).map((slug) => slug.trim()).filter(Boolean))
  ];
}

type ImportScope =
  | {
      type: "full";
    }
  | {
      mediaSlugs: string[];
      type: "media";
    }
  | {
      lessonSlugs: string[];
      mediaSlug: string;
      type: "lessons";
    };

type ResolvedImportScope =
  | {
      scope: ImportScope;
      status: "ready";
    }
  | {
      message: string;
      status: "failed";
    };

function resolveImportScope(input: {
  lessonSlugs: string[];
  mediaSlugs: string[];
}): ResolvedImportScope {
  if (input.lessonSlugs.length === 0) {
    return {
      scope:
        input.mediaSlugs.length > 0
          ? {
              mediaSlugs: input.mediaSlugs,
              type: "media"
            }
          : {
              type: "full"
            },
      status: "ready"
    };
  }

  if (input.mediaSlugs.length !== 1) {
    return {
      message:
        "Import aborted: lesson scope requires exactly one --media-slug.",
      status: "failed"
    };
  }

  return {
    scope: {
      lessonSlugs: input.lessonSlugs,
      mediaSlug: input.mediaSlugs[0],
      type: "lessons"
    },
    status: "ready"
  };
}

function selectWorkspaceBundles<
  TWorkspace extends {
    bundles: Array<{
      lessons: Array<{
        frontmatter: {
          slug: string;
        };
      }>;
      mediaSlug: string;
    }>;
  }
>(
  workspace: TWorkspace,
  scope: ImportScope
):
  | {
      lessonScopes: Array<{ lessonSlugs: string[]; mediaSlug: string }>;
      status: "ready";
      workspace: TWorkspace;
    }
  | {
      message: string;
      status: "failed";
    } {
  if (scope.type === "full") {
    return {
      lessonScopes: [],
      status: "ready",
      workspace
    };
  }

  const mediaSlugs =
    scope.type === "lessons" ? [scope.mediaSlug] : scope.mediaSlugs;
  const requestedSlugs = new Set(mediaSlugs);
  const bundles = workspace.bundles.filter((bundle) =>
    requestedSlugs.has(bundle.mediaSlug)
  );

  if (bundles.length !== requestedSlugs.size) {
    return {
      message: buildMissingMediaScopeMessage(mediaSlugs, workspace),
      status: "failed"
    };
  }

  if (scope.type === "lessons") {
    const bundle = bundles[0];
    const availableLessonSlugs = new Set(
      bundle.lessons.map((lesson) => lesson.frontmatter.slug)
    );
    const missingLessonSlugs = scope.lessonSlugs.filter(
      (slug) => !availableLessonSlugs.has(slug)
    );

    if (missingLessonSlugs.length > 0) {
      return {
        message: `Import aborted: lesson scope not found for ${scope.mediaSlug}: ${missingLessonSlugs.join(", ")}.`,
        status: "failed"
      };
    }

    return {
      lessonScopes: [
        {
          lessonSlugs: scope.lessonSlugs,
          mediaSlug: scope.mediaSlug
        }
      ],
      status: "ready",
      workspace: {
        ...workspace,
        bundles
      }
    };
  }

  return {
    lessonScopes: [],
    status: "ready",
    workspace: {
      ...workspace,
      bundles
    }
  };
}

function buildMissingMediaScopeMessage(
  mediaSlugs: string[],
  workspace: {
    bundles: Array<{
      mediaSlug: string;
    }>;
  }
) {
  const availableSlugs = new Set(
    workspace.bundles.map((bundle) => bundle.mediaSlug)
  );
  const missingSlugs = mediaSlugs.filter((slug) => !availableSlugs.has(slug));

  return `Import aborted: media scope not found for ${missingSlugs.join(", ")}.`;
}

function buildSuccessMessage(
  bundleCount: number,
  summary: {
    archivedCardIds: string[];
    archivedLessonIds: string[];
    archivedMediaIds: string[];
    prunedGrammarIds: string[];
    prunedTermIds: string[];
  }
) {
  return [
    `Imported ${bundleCount} media bundle(s).`,
    summary.archivedMediaIds.length > 0
      ? `Archived media: ${summary.archivedMediaIds.length}.`
      : null,
    summary.archivedLessonIds.length > 0
      ? `Archived lessons: ${summary.archivedLessonIds.length}.`
      : null,
    summary.archivedCardIds.length > 0
      ? `Archived cards: ${summary.archivedCardIds.length}.`
      : null,
    summary.prunedTermIds.length > 0
      ? `Pruned terms: ${summary.prunedTermIds.length}.`
      : null,
    summary.prunedGrammarIds.length > 0
      ? `Pruned grammar patterns: ${summary.prunedGrammarIds.length}.`
      : null
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return `Import failed: ${error.message}`;
  }

  return "Import failed with an unknown error.";
}

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

    const scopedWorkspace = selectWorkspaceBundles(parseResult.data, mediaSlugs);

    if (scopedWorkspace === null) {
      const message = buildMissingMediaScopeMessage(mediaSlugs, parseResult.data);

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
        nowIso: startedAt,
        syncMode: mediaSlugs.length > 0 ? "incremental" : "full",
        workspace: scopedWorkspace
      })
    );
    const message = buildSuccessMessage(scopedWorkspace.bundles.length, syncResult.summary);

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
        data: scopedWorkspace
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
    return total + (bundle.media ? 1 : 0) + bundle.lessons.length + bundle.cardFiles.length;
  }, 0);
}

function normalizeMediaSlugs(mediaSlugs: string[] | undefined) {
  return [...new Set((mediaSlugs ?? []).map((slug) => slug.trim()).filter(Boolean))];
}

function selectWorkspaceBundles<
  TWorkspace extends {
    bundles: Array<{
      mediaSlug: string;
    }>;
  }
>(
  workspace: TWorkspace,
  mediaSlugs: string[]
): TWorkspace | null {
  if (mediaSlugs.length === 0) {
    return workspace;
  }

  const requestedSlugs = new Set(mediaSlugs);
  const bundles = workspace.bundles.filter((bundle) => requestedSlugs.has(bundle.mediaSlug));

  if (bundles.length !== requestedSlugs.size) {
    return null;
  }

  return {
    ...workspace,
    bundles
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
  const availableSlugs = new Set(workspace.bundles.map((bundle) => bundle.mediaSlug));
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

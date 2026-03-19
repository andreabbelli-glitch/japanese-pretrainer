import "dotenv/config";

import path from "node:path";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const result = await importContentWorkspace({
    contentRoot: cliOptions.contentRoot,
    mediaSlugs: cliOptions.mediaSlugs,
    database: db
  });

  if (result.status === "failed") {
    console.error(
      [
        result.message,
        cliOptions.mediaSlugs.length > 0
          ? `Scope: media=${cliOptions.mediaSlugs.join(",")}.`
          : null,
        result.issues.length > 0
          ? `Validation issues: ${result.issues.length}.`
          : null
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );

    for (const issue of result.issues) {
      console.error(formatIssue(issue));
    }

    process.exitCode = 1;
  } else {
    console.info(
      [
        `Imported ${result.parseResult.data.bundles.length} bundle(s) from ${cliOptions.contentRoot}.`,
        cliOptions.mediaSlugs.length > 0
          ? `Mode: incremental (${cliOptions.mediaSlugs.join(",")}).`
          : "Mode: full.",
        `Import id: ${result.importId}.`,
        `Files scanned: ${result.filesScanned}.`,
        `Files changed: ${result.filesChanged}.`
      ].join(" ")
    );

    if (
      result.summary.archivedMediaIds.length > 0 ||
      result.summary.archivedLessonIds.length > 0 ||
      result.summary.archivedCardIds.length > 0 ||
      result.summary.prunedTermIds.length > 0 ||
      result.summary.prunedGrammarIds.length > 0
    ) {
      console.info(
        [
          result.summary.archivedMediaIds.length > 0
            ? `archived media=${result.summary.archivedMediaIds.length}`
            : null,
          result.summary.archivedLessonIds.length > 0
            ? `archived lessons=${result.summary.archivedLessonIds.length}`
            : null,
          result.summary.archivedCardIds.length > 0
            ? `archived cards=${result.summary.archivedCardIds.length}`
            : null,
          result.summary.prunedTermIds.length > 0
            ? `pruned terms=${result.summary.prunedTermIds.length}`
            : null,
          result.summary.prunedGrammarIds.length > 0
            ? `pruned grammar=${result.summary.prunedGrammarIds.length}`
            : null
        ]
          .filter((value): value is string => value !== null)
          .join(" | ")
      );
    }

    if (cliOptions.mediaSlugs.length === 0) {
      const purgedMedia = await purgeArchivedMedia(db);

      if (purgedMedia.length > 0) {
        console.info(`purged archived media=${purgedMedia.join(",")}`);
      }
    }

    const backfillResult = await backfillReviewSubjectState(db);

    console.info(
      `Backfilled review_subject_state: ${backfillResult.insertedCount} subject state(s) from ${backfillResult.cardCount} card(s).`
    );
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
} finally {
  closeDatabaseClient(db);
}

function resolveCliOptions(args: string[]) {
  let contentRoot = path.resolve(process.cwd(), "content");
  const mediaSlugs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --content-root.");
      }

      contentRoot = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (value === "--media-slug") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --media-slug.");
      }

      mediaSlugs.push(nextValue);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return {
    contentRoot,
    mediaSlugs: [...new Set(mediaSlugs)]
  };
}

function formatIssue(issue: {
  category: string;
  code: string;
  location: {
    filePath: string;
    range?: {
      start: {
        line: number;
        column: number;
      };
    };
  };
  message: string;
}) {
  const line = issue.location.range?.start.line;
  const column = issue.location.range?.start.column;
  const position =
    line && column ? `:${line}:${column}` : line ? `:${line}` : "";

  return [
    `[${issue.category}] ${issue.code}`,
    `${issue.location.filePath}${position}`,
    issue.message
  ].join(" - ");
}

function formatUnexpectedError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : "";

  if (
    errorMessage.includes("no such table:") ||
    errorMessage.includes("SQLITE_ERROR") ||
    errorMessage.includes("content_import")
  ) {
    return [
      "Import failed: the database schema is not initialized.",
      "Run `./scripts/with-node.sh pnpm db:migrate` for the target DATABASE_URL, then retry the import."
    ].join(" ");
  }

  if (errorMessage.length > 0) {
    return `Import failed: ${errorMessage}`;
  }

  return "Import failed with an unknown error.";
}

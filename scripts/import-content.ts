import dotenv from "dotenv";

import path from "node:path";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

const CONTENT_CACHE_REVALIDATE_TIMEOUT_MS = 15_000;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

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

    const cacheRevalidationResult = await revalidateContentCache({
      importId: result.importId,
      lessons: result.parseResult.data.bundles.flatMap((bundle) =>
        bundle.lessons.map((lesson) => ({
          lessonSlug: lesson.frontmatter.slug,
          mediaSlug: bundle.mediaSlug
        }))
      ),
      mediaSlugs: result.parseResult.data.bundles.map((bundle) => bundle.mediaSlug)
    });

    if (cacheRevalidationResult.status === "failed") {
      console.error(cacheRevalidationResult.message);
      process.exitCode = 1;
    } else if (cacheRevalidationResult.status === "performed") {
      console.info(cacheRevalidationResult.message);
    }
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

async function revalidateContentCache(input: {
  importId: string;
  lessons: Array<{
    lessonSlug: string;
    mediaSlug: string;
  }>;
  mediaSlugs: string[];
}) {
  const revalidateUrl = process.env.CONTENT_CACHE_REVALIDATE_URL?.trim();
  const revalidateSecret = process.env.CONTENT_CACHE_REVALIDATE_SECRET?.trim();

  if (!revalidateUrl || !revalidateSecret) {
    return {
      message:
        "Import completed. Cache revalidation skipped because CONTENT_CACHE_REVALIDATE_URL or CONTENT_CACHE_REVALIDATE_SECRET is not configured.",
      status: "skipped" as const
    };
  }

  try {
    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": revalidateSecret
      },
      body: JSON.stringify({
        importId: input.importId,
        lessons: dedupeLessons(input.lessons),
        mediaSlugs: [...new Set(input.mediaSlugs)]
      }),
      signal: AbortSignal.timeout(CONTENT_CACHE_REVALIDATE_TIMEOUT_MS)
    });

    if (!response.ok) {
      const details = await readRevalidationError(response);

      return {
        message: `Import completed, but cache revalidation failed (${response.status}). ${details}`,
        status: "failed" as const
      };
    }

    return {
      message: `Cache revalidation completed for import ${input.importId}.`,
      status: "performed" as const
    };
  } catch (error) {
    return {
      message: `Import completed, but cache revalidation failed: ${formatRevalidationError(error)}`,
      status: "failed" as const
    };
  }
}

function dedupeLessons(
  lessons: Array<{
    lessonSlug: string;
    mediaSlug: string;
  }>
) {
  const unique = new Map<string, { lessonSlug: string; mediaSlug: string }>();

  for (const lesson of lessons) {
    unique.set(`${lesson.mediaSlug}:${lesson.lessonSlug}`, lesson);
  }

  return [...unique.values()];
}

async function readRevalidationError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };

    if (payload.error?.trim()) {
      return payload.error.trim();
    }
  } catch {}

  const text = await response.text().catch(() => "");

  return text.trim() || "No error details returned.";
}

function formatRevalidationError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "Unknown revalidation error.";
}

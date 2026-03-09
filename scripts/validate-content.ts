import path from "node:path";

import {
  parseContentRoot,
  parseMediaDirectory,
  type ValidationIssue
} from "../src/lib/content/index.ts";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));

  if (cliOptions.mediaSlug) {
    const mediaDirectory = path.join(cliOptions.contentRoot, "media", cliOptions.mediaSlug);
    const result = await parseMediaDirectory(mediaDirectory);

    if (!result.ok) {
      console.error(
        `Validation failed for media '${cliOptions.mediaSlug}': ${result.issues.length} issue(s).`
      );

      for (const issue of result.issues) {
        console.error(formatIssue(issue));
      }

      process.exitCode = 1;
    } else {
      console.info(
        [
          `Validated media '${cliOptions.mediaSlug}'.`,
          `Files scanned: ${countBundleFiles(result.data)}.`,
          `Lessons: ${result.data.lessons.length}.`,
          `Cards files: ${result.data.cardFiles.length}.`,
          `Terms: ${result.data.terms.length}.`,
          `Grammar: ${result.data.grammarPatterns.length}.`,
          `Cards: ${result.data.cards.length}.`
        ].join(" ")
      );
    }
  } else {
    const result = await parseContentRoot(cliOptions.contentRoot);

    if (!result.ok) {
      console.error(
        `Validation failed for content root ${cliOptions.contentRoot}: ${result.issues.length} issue(s).`
      );

      for (const issue of result.issues) {
        console.error(formatIssue(issue));
      }

      process.exitCode = 1;
    } else {
      console.info(
        [
          `Validated ${result.data.bundles.length} media bundle(s) from ${cliOptions.contentRoot}.`,
          `Files scanned: ${countWorkspaceFiles(result.data)}.`
        ].join(" ")
      );
    }
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

function resolveCliOptions(args: string[]) {
  let contentRoot = path.resolve(process.cwd(), "content");
  let mediaSlug: string | null = null;

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

      if (mediaSlug !== null) {
        throw new Error("Use --media-slug only once with content:validate.");
      }

      mediaSlug = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return {
    contentRoot,
    mediaSlug
  };
}

function countBundleFiles(bundle: {
  cardFiles: unknown[];
  lessons: unknown[];
  media: unknown | null;
}) {
  return (bundle.media ? 1 : 0) + bundle.lessons.length + bundle.cardFiles.length;
}

function countWorkspaceFiles(workspace: {
  bundles: Array<{
    cardFiles: unknown[];
    lessons: unknown[];
    media: unknown | null;
  }>;
}) {
  return workspace.bundles.reduce((total, bundle) => total + countBundleFiles(bundle), 0);
}

function formatIssue(issue: ValidationIssue) {
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
  if (error instanceof Error && error.message.length > 0) {
    return `Validation failed: ${error.message}`;
  }

  return "Validation failed with an unknown error.";
}

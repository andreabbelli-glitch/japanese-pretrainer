import path from "node:path";

import {
  formatLessonWorkflowCheckResult,
  getLessonWorkflowCheckExitCode,
  LessonWorkflowCheckFailure,
  runLessonWorkflowCheck
} from "../src/features/content/tooling/lesson-workflow-check.ts";

try {
  const options = resolveCliOptions(process.argv.slice(2));
  const importDependencies = options.import
    ? await loadImportDependencies()
    : undefined;
  const result = await runLessonWorkflowCheck({
    allowEditorialWarnings: options.allowEditorialWarnings,
    contentRoot: options.contentRoot,
    database: importDependencies?.database,
    import: options.import,
    importContent: importDependencies?.importContent,
    lessonSlugs: options.lessonSlugs,
    limit: options.limit,
    mediaSlug: options.mediaSlug,
    repositoryRoot: process.cwd()
  });

  process.stdout.write(
    options.json
      ? `${JSON.stringify(result)}\n`
      : formatLessonWorkflowCheckResult(result)
  );
  process.exitCode = getLessonWorkflowCheckExitCode(result);
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = readExitCode(error);
} finally {
  const closeDatabase = globalThis.__lessonWorkflowCheckCloseDatabase__;

  if (closeDatabase) {
    closeDatabase();
  }
}

declare global {
  var __lessonWorkflowCheckCloseDatabase__: (() => void) | undefined;
}

type CliOptions = {
  allowEditorialWarnings: boolean;
  contentRoot: string;
  import: boolean;
  json: boolean;
  lessonSlugs: string[];
  limit: number;
  mediaSlug: string;
};

function resolveCliOptions(args: string[]): CliOptions {
  let allowEditorialWarnings = false;
  let contentRoot = path.resolve(process.cwd(), "content");
  let importRequested = false;
  let json = false;
  const lessonSlugs: string[] = [];
  let limit = 20;
  let mediaSlug: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--allow-editorial-warnings") {
      allowEditorialWarnings = true;
      continue;
    }

    if (value === "--content-root") {
      contentRoot = path.resolve(
        readOptionValue(args, index, "--content-root")
      );
      index += 1;
      continue;
    }

    if (value === "--import") {
      importRequested = true;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--lesson-slug") {
      lessonSlugs.push(readOptionValue(args, index, "--lesson-slug"));
      index += 1;
      continue;
    }

    if (value === "--limit") {
      limit = readPositiveInteger(args, index, "--limit");
      index += 1;
      continue;
    }

    if (value === "--media-slug") {
      mediaSlug = readSingleStringOption(mediaSlug, args, index, value);
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    throw new Error(`Unexpected positional argument: ${value}`);
  }

  if (!mediaSlug) {
    throw new Error("Missing --media-slug.");
  }

  if (lessonSlugs.length === 0) {
    throw new Error("Provide at least one --lesson-slug.");
  }

  return {
    allowEditorialWarnings,
    contentRoot,
    import: importRequested,
    json,
    lessonSlugs,
    limit,
    mediaSlug
  };
}

async function loadImportDependencies() {
  await import("./load-env.ts");
  const dbModule = await import("../src/db/client.ts");
  const importerModule = await import("../src/features/content/importer.ts");

  globalThis.__lessonWorkflowCheckCloseDatabase__ = () => {
    dbModule.closeDatabaseClient(dbModule.db);
  };

  return {
    database: dbModule.db,
    importContent: async (input: {
      contentRoot: string;
      database: typeof dbModule.db;
      lessonSlugs: string[];
      mediaSlug: string;
    }) =>
      importerModule.importContentWorkspace({
        contentRoot: input.contentRoot,
        database: input.database,
        lessonSlugs: input.lessonSlugs,
        mediaSlugs: [input.mediaSlug]
      })
  };
}

function readSingleStringOption(
  currentValue: string | null,
  args: string[],
  index: number,
  flag: string
) {
  if (currentValue !== null) {
    throw new Error(`${flag} cannot be provided more than once.`);
  }

  return readOptionValue(args, index, flag);
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--") || value.trim().length === 0) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readPositiveInteger(args: string[], index: number, flag: string) {
  const rawValue = readOptionValue(args, index, flag);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "content:lesson-workflow-check failed with an unknown error.";
}

function readExitCode(error: unknown) {
  return error instanceof LessonWorkflowCheckFailure ? error.exitCode : 1;
}

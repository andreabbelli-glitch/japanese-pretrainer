import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildForvoPreflight,
  formatForvoPreflightReport
} from "../src/features/pronunciation/tooling/forvo-preflight.ts";
import type { DatabaseClient } from "../src/db/client.ts";
import type { PronunciationResolveMode } from "../src/features/pronunciation/tooling/resolve.ts";

type CliOptions = {
  contentRoot: string;
  entryIds: string[];
  json: boolean;
  knownMissingPath: string;
  lessonUrl?: string;
  limit?: number;
  mediaSlug?: string;
  mode?: PronunciationResolveMode;
  refresh: boolean;
  requestRegistryPath: string;
  retryKnownMissing: boolean;
  wordListPath?: string;
  words: string[];
};

try {
  const options = parseCliOptions(process.argv.slice(2));

  if (!options.mode) {
    throw new Error(
      "Missing required --mode (review | next-lesson | lesson-url | targeted)."
    );
  }

  if (options.mode === "next-lesson" && !options.mediaSlug) {
    throw new Error("Mode 'next-lesson' requires --media <slug>.");
  }

  if (options.mode === "lesson-url" && !options.lessonUrl) {
    throw new Error("Mode 'lesson-url' requires --lesson-url <url|path>.");
  }

  if (options.mode === "targeted" && !options.mediaSlug) {
    throw new Error("Mode 'targeted' requires --media <slug>.");
  }

  if (
    options.mode === "targeted" &&
    options.entryIds.length === 0 &&
    options.words.length === 0 &&
    !options.wordListPath
  ) {
    throw new Error(
      "Mode 'targeted' requires --entry <id>, --word <word>, or --words-file <path>."
    );
  }

  const wordListSource = options.wordListPath
    ? await readFile(path.resolve(options.wordListPath), "utf8")
    : undefined;
  const databaseContext = await resolveDatabaseContext(options.mode);

  try {
    const report = await buildForvoPreflight({
      contentRoot: path.resolve(options.contentRoot),
      database: databaseContext.database,
      entryIds: options.entryIds,
      knownMissingPath: path.resolve(options.knownMissingPath),
      lessonUrl: options.lessonUrl,
      limit: options.limit,
      mediaSlug: options.mediaSlug,
      mode: options.mode,
      refresh: options.refresh,
      requestRegistryPath: path.resolve(options.requestRegistryPath),
      retryKnownMissing: options.retryKnownMissing,
      wordListPath: options.wordListPath
        ? path.resolve(options.wordListPath)
        : undefined,
      wordListSource,
      words: options.words
    });

    process.stdout.write(
      options.json
        ? `${JSON.stringify(report)}\n`
        : formatForvoPreflightReport(report)
    );
  } finally {
    databaseContext.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function resolveDatabaseContext(
  mode: PronunciationResolveMode
): Promise<{ close: () => void; database?: DatabaseClient }> {
  if (mode === "targeted") {
    return {
      close: () => undefined
    };
  }

  const { closeDatabaseClient, db } = await import("../src/db/client.ts");

  return {
    close: () => closeDatabaseClient(db),
    database: db
  };
}

function parseCliOptions(argv: string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    contentRoot: "content",
    entryIds: [],
    json: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    refresh: false,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json"),
    retryKnownMissing: false,
    words: []
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const argument = normalizedArgv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--content-root") {
      options.contentRoot = readOptionValue(
        normalizedArgv,
        index,
        "--content-root"
      );
      index += 1;
      continue;
    }

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--mode") {
      options.mode = readModeOption(normalizedArgv, index, "--mode");
      index += 1;
      continue;
    }

    if (argument === "--media" || argument === "--media-slug") {
      options.mediaSlug = readOptionValue(normalizedArgv, index, argument);
      index += 1;
      continue;
    }

    if (argument === "--lesson-url") {
      options.lessonUrl = readOptionValue(
        normalizedArgv,
        index,
        "--lesson-url"
      );
      index += 1;
      continue;
    }

    if (argument === "--entry") {
      options.entryIds.push(readOptionValue(normalizedArgv, index, "--entry"));
      index += 1;
      continue;
    }

    if (argument === "--word") {
      options.words.push(readOptionValue(normalizedArgv, index, "--word"));
      index += 1;
      continue;
    }

    if (argument === "--words-file") {
      options.wordListPath = readOptionValue(
        normalizedArgv,
        index,
        "--words-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      options.limit = readNonNegativeIntegerOption(
        normalizedArgv,
        index,
        "--limit"
      );
      index += 1;
      continue;
    }

    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }

    if (argument === "--retry-known-missing") {
      options.retryKnownMissing = true;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath = readOptionValue(
        normalizedArgv,
        index,
        "--known-missing-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--request-registry-file") {
      options.requestRegistryPath = readOptionValue(
        normalizedArgv,
        index,
        "--request-registry-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      throw new Error(
        "forvo:preflight is already read-only; remove --dry-run."
      );
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readModeOption(
  argv: string[],
  index: number,
  flag: string
): PronunciationResolveMode {
  const mode = readOptionValue(argv, index, flag);

  if (
    mode === "review" ||
    mode === "next-lesson" ||
    mode === "lesson-url" ||
    mode === "targeted"
  ) {
    return mode;
  }

  throw new Error(
    "--mode must be one of review, next-lesson, lesson-url, or targeted."
  );
}

function readOptionValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readNonNegativeIntegerOption(
  argv: string[],
  index: number,
  flag: string
) {
  const value = readOptionValue(argv, index, flag);

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} must be a safe non-negative integer.`);
  }

  return parsed;
}

function expandEqualsOptions(argv: string[]) {
  return argv.flatMap((argument) => {
    if (!argument.startsWith("--") || !argument.includes("=")) {
      return [argument];
    }

    const separatorIndex = argument.indexOf("=");

    return [
      argument.slice(0, separatorIndex),
      argument.slice(separatorIndex + 1)
    ];
  });
}

import "./load-env.ts";

import os from "node:os";
import path from "node:path";

import { db } from "../src/db/client.ts";
import { assertForvoManualRunCanStart } from "../src/lib/pronunciation.ts";
import {
  resolvePronunciations,
  type PronunciationResolveMode
} from "../src/lib/pronunciation-resolve.ts";

type CliOptions = {
  ankiAppPath?: string;
  ankiBaseDir: string;
  ankiPythonPath?: string;
  browserTimeoutMs?: number;
  contentRoot: string;
  controlPort: number;
  dryRun: boolean;
  knownMissingPath: string;
  lessonUrl?: string;
  limit?: number;
  manualDownloadsDir: string;
  manualOpenUrls: boolean;
  mediaSlug?: string;
  mode?: PronunciationResolveMode;
  openWordAddOnSkip: boolean;
  refresh: boolean;
  requestRegistryPath: string;
  retryKnownMissing: boolean;
};

const options = parseCliOptions(process.argv.slice(2));

if (!options.openWordAddOnSkip) {
  try {
    assertForvoManualRunCanStart({
      openWordAddOnSkip: options.openWordAddOnSkip,
      requireInteractiveTTY: false
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else if (!options.mode) {
  console.error("Missing required --mode (review | next-lesson | lesson-url).");
  process.exitCode = 1;
} else if (options.mode === "next-lesson" && !options.mediaSlug) {
  console.error("Mode 'next-lesson' requires --media <slug>.");
  process.exitCode = 1;
} else if (options.mode === "lesson-url" && !options.lessonUrl) {
  console.error("Mode 'lesson-url' requires --lesson-url <url|path>.");
  process.exitCode = 1;
} else {
  try {
    const result = await resolvePronunciations({
      contentRoot: path.resolve(options.contentRoot),
      database: db,
      dryRun: options.dryRun,
      forvoOptions: {
        ankiAppPath: options.ankiAppPath,
        ankiBaseDir: path.resolve(options.ankiBaseDir),
        ankiPythonPath: options.ankiPythonPath,
        browserTimeoutMs: options.browserTimeoutMs,
        knownMissingPath: path.resolve(options.knownMissingPath),
        openWordAddOnMiss: options.openWordAddOnSkip,
        requestRegistryPath: path.resolve(options.requestRegistryPath),
        retryKnownMissing: options.retryKnownMissing
      },
      knownMissingPath: path.resolve(options.knownMissingPath),
      lessonUrl: options.lessonUrl,
      limit: options.limit,
      mediaSlug: options.mediaSlug,
      mode: options.mode,
      refresh: options.refresh,
      retryKnownMissing: options.retryKnownMissing
    });

    console.info(
      `mode=${result.mode} media=${result.selectedMediaSlugs.join(",") || "none"}`
    );

    for (const summary of result.summaries) {
      console.info(
        `${summary.bundle.mediaSlug}: selected=${summary.targets.length} reuse=${summary.execution.reuseSummary.reused} forvo_matched=${summary.execution.forvoSummary?.matched ?? 0} forvo_missed=${summary.execution.forvoSummary?.missed ?? 0} pending=${summary.execution.pendingSummary.pendingCount}`
      );

      if (summary.lessonSlug) {
        console.info(`  lesson ${summary.lessonSlug}`);
      }

      if (summary.execution.knownMissingSkipped.length > 0) {
        console.info(
          `  skipped known missing: ${summary.execution.knownMissingSkipped.join(", ")}`
        );
      }

      if (summary.execution.finalEntryIds.length > 0) {
        console.info(
          `  forvo targets: ${summary.execution.finalEntryIds.join(", ")}`
        );
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    ankiBaseDir: path.join("data", "forvo-anki-profile"),
    contentRoot: "content",
    controlPort: 3210,
    dryRun: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    manualDownloadsDir: path.join(os.homedir(), "Downloads"),
    manualOpenUrls: true,
    openWordAddOnSkip: true,
    refresh: false,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json"),
    retryKnownMissing: false
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

    if (argument === "--mode") {
      const mode = readOptionValue(normalizedArgv, index, "--mode");
      if (
        mode === "review" ||
        mode === "next-lesson" ||
        mode === "lesson-url"
      ) {
        options.mode = mode;
      } else {
        throw new Error(
          "--mode must be one of review, next-lesson, or lesson-url."
        );
      }
      index += 1;
      continue;
    }

    if (argument === "--media") {
      options.mediaSlug = readOptionValue(normalizedArgv, index, "--media");
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

    if (argument === "--limit") {
      options.limit = readNonNegativeIntegerOption(
        normalizedArgv,
        index,
        "--limit"
      );
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }

    if (argument === "--downloads-dir") {
      options.manualDownloadsDir = readOptionValue(
        normalizedArgv,
        index,
        "--downloads-dir"
      );
      index += 1;
      continue;
    }

    if (argument === "--control-port") {
      options.controlPort = readPositiveIntegerOption(
        normalizedArgv,
        index,
        "--control-port"
      );
      index += 1;
      continue;
    }

    if (argument === "--anki-app") {
      options.ankiAppPath = readOptionValue(
        normalizedArgv,
        index,
        "--anki-app"
      );
      index += 1;
      continue;
    }

    if (argument === "--anki-python") {
      options.ankiPythonPath = readOptionValue(
        normalizedArgv,
        index,
        "--anki-python"
      );
      index += 1;
      continue;
    }

    if (argument === "--anki-base-dir" || argument === "--profile-dir") {
      options.ankiBaseDir = readOptionValue(normalizedArgv, index, argument);
      index += 1;
      continue;
    }

    if (argument === "--browser-timeout-ms") {
      options.browserTimeoutMs = readPositiveIntegerOption(
        normalizedArgv,
        index,
        "--browser-timeout-ms"
      );
      index += 1;
      continue;
    }

    if (argument === "--no-open") {
      options.manualOpenUrls = false;
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

    if (argument === "--retry-known-missing") {
      options.retryKnownMissing = true;
      continue;
    }

    if (argument === "--no-open-word-add-on-skip") {
      options.openWordAddOnSkip = false;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
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

function readPositiveIntegerOption(
  argv: string[],
  index: number,
  flag: string
) {
  const value = readOptionValue(argv, index, flag);

  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${flag} must be a safe positive integer.`);
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

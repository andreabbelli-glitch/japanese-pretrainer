import os from "node:os";
import path from "node:path";

import { db } from "../src/db/index.ts";
import { resolvePronunciations, type PronunciationResolveMode } from "../src/lib/pronunciation-resolve.ts";
import type { PronunciationFetchNetworkOptions } from "../src/lib/pronunciation.ts";

type CliOptions = {
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
  network: PronunciationFetchNetworkOptions;
  openWordAddOnSkip: boolean;
  refresh: boolean;
  requestRegistryPath: string;
  retryKnownMissing: boolean;
};

const options = parseCliOptions(process.argv.slice(2));

if (!options.mode) {
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
      forvoManualOptions: {
        controlPort: options.controlPort,
        downloadsDir: path.resolve(options.manualDownloadsDir),
        knownMissingPath: path.resolve(options.knownMissingPath),
        openUrls: options.manualOpenUrls,
        openWordAddOnSkip: options.openWordAddOnSkip,
        requestRegistryPath: path.resolve(options.requestRegistryPath),
        retryKnownMissing: options.retryKnownMissing
      },
      knownMissingPath: path.resolve(options.knownMissingPath),
      lessonUrl: options.lessonUrl,
      limit: options.limit,
      mediaSlug: options.mediaSlug,
      mode: options.mode,
      network: options.network,
      refresh: options.refresh
    });

    console.info(
      `mode=${result.mode} media=${result.selectedMediaSlugs.join(",") || "none"}`
    );

    for (const summary of result.summaries) {
      console.info(
        `${summary.bundle.mediaSlug}: selected=${summary.targets.length} reuse=${summary.execution.reuseSummary.reused} offline_matched=${summary.execution.offlineSummary.matched} offline_missed=${summary.execution.offlineSummary.missed} forvo_matched=${summary.execution.forvoSummary?.matched ?? 0} forvo_missed=${summary.execution.forvoSummary?.missed ?? 0} pending=${summary.execution.pendingSummary.pendingCount}`
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
  const options: CliOptions = {
    contentRoot: "content",
    controlPort: 3210,
    dryRun: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    manualDownloadsDir: path.join(os.homedir(), "Downloads"),
    manualOpenUrls: true,
    network: {},
    openWordAddOnSkip: true,
    refresh: false,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json"),
    retryKnownMissing: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--content-root") {
      options.contentRoot = argv[index + 1] ?? options.contentRoot;
      index += 1;
      continue;
    }

    if (argument === "--mode") {
      const mode = argv[index + 1];
      if (mode === "review" || mode === "next-lesson" || mode === "lesson-url") {
        options.mode = mode;
      }
      index += 1;
      continue;
    }

    if (argument === "--media") {
      options.mediaSlug = argv[index + 1] ?? options.mediaSlug;
      index += 1;
      continue;
    }

    if (argument === "--lesson-url") {
      options.lessonUrl = argv[index + 1] ?? options.lessonUrl;
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      const parsedLimit = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedLimit) && parsedLimit >= 0) {
        options.limit = parsedLimit;
      }

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

    if (argument === "--request-delay-ms") {
      const parsedDelay = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        options.network.requestDelayMs = parsedDelay;
      }

      index += 1;
      continue;
    }

    if (argument === "--request-timeout-ms") {
      const parsedTimeout = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedTimeout) && parsedTimeout >= 0) {
        options.network.requestTimeoutMs = parsedTimeout;
      }

      index += 1;
      continue;
    }

    if (argument === "--max-retries") {
      const parsedRetries = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedRetries) && parsedRetries >= 0) {
        options.network.maxRetries = parsedRetries;
      }

      index += 1;
      continue;
    }

    if (argument === "--retry-base-delay-ms") {
      const parsedDelay = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        options.network.retryBaseDelayMs = parsedDelay;
      }

      index += 1;
      continue;
    }

    if (argument === "--downloads-dir") {
      options.manualDownloadsDir = argv[index + 1] ?? options.manualDownloadsDir;
      index += 1;
      continue;
    }

    if (argument === "--control-port") {
      const parsedPort = Number.parseInt(argv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedPort) && parsedPort > 0) {
        options.controlPort = parsedPort;
      }

      index += 1;
      continue;
    }

    if (argument === "--no-open") {
      options.manualOpenUrls = false;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath = argv[index + 1] ?? options.knownMissingPath;
      index += 1;
      continue;
    }

    if (argument === "--request-registry-file") {
      options.requestRegistryPath =
        argv[index + 1] ?? options.requestRegistryPath;
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
  }

  return options;
}

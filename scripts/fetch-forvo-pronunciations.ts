import path from "node:path";
import { readFile } from "node:fs/promises";
import os from "node:os";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import {
  assertForvoManualRunCanStart,
  fetchForvoPronunciationsForBundle,
  fetchForvoPronunciationsForBundleManual,
  resolveRequestedTargets,
  reuseCrossMediaPronunciationsForBundle,
  writeBundlePronunciationPendingSummary
} from "../src/lib/pronunciation.ts";

type CliOptions = {
  browserTimeoutMs?: number;
  controlPort: number;
  contentRoot: string;
  dryRun: boolean;
  entryIds: string[];
  headless: boolean;
  keepBrowserOpen: boolean;
  limit?: number;
  manual: boolean;
  manualDownloadsDir: string;
  manualOpenUrls: boolean;
  mediaSlugs: string[];
  knownMissingPath: string;
  openWordAddOnSkip: boolean;
  profileDir: string;
  refresh: boolean;
  requestRegistryPath: string;
  retryKnownMissing: boolean;
  wordListPath?: string;
  words: string[];
};

const options = parseCliOptions(process.argv.slice(2));

if (options.manual || !options.openWordAddOnSkip) {
  try {
    assertForvoManualRunCanStart({
      openWordAddOnSkip: options.openWordAddOnSkip,
      requireInteractiveTTY: options.manual
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const contentRoot = path.resolve(options.contentRoot);
const parseResult = await parseContentRoot(contentRoot);
const wordListSource = options.wordListPath
  ? await readFile(path.resolve(options.wordListPath), "utf8")
  : undefined;

if (!parseResult.ok) {
  console.error("Content validation failed. Fix these issues first:");

  for (const issue of parseResult.issues) {
    console.error(
      `- [${issue.category}] ${issue.code} at ${issue.location.filePath}: ${issue.message}`
    );
  }

  process.exitCode = 1;
} else {
  let liveBundles = parseResult.data.bundles;
  const bundles = liveBundles.filter(
    (bundle) =>
      options.mediaSlugs.length === 0 ||
      options.mediaSlugs.includes(bundle.mediaSlug)
  );

  if (bundles.length === 0) {
    console.error("No media bundles matched the requested filters.");
    process.exitCode = 1;
  } else {
    for (const bundle of bundles) {
      const hasExplicitRequests =
        options.entryIds.length > 0 ||
        options.words.length > 0 ||
        typeof wordListSource === "string";
      const reuseTargets = hasExplicitRequests
        ? resolveRequestedTargets({
            bundle,
            entryIds: options.entryIds,
            refresh: options.refresh,
            wordListSource,
            words: options.words
          }).targets
        : undefined;
      const reuseSummary = await reuseCrossMediaPronunciationsForBundle({
        bundle,
        bundles: liveBundles,
        dryRun: options.dryRun,
        onlyTargets: reuseTargets
      });

      for (const result of reuseSummary.results) {
        if (result.status === "reused") {
          console.info(
            `  reused ${result.kind}:${result.entryId} <- ${result.sourceMediaSlug}:${result.sourceEntryId}`
          );
        } else {
          console.info(
            `  ambiguous ${result.kind}:${result.entryId} -> ${result.candidateMediaSlugs
              .map(
                (mediaSlug: string, index: number) =>
                  `${mediaSlug}:${result.candidateEntryIds[index]}`
              )
              .join(", ")}`
          );
        }
      }

      let currentBundle = bundle;

      if (!options.dryRun && reuseSummary.reused > 0) {
        const refreshed = await parseContentRoot(contentRoot);

        if (!refreshed.ok) {
          throw new Error(
            "Content validation failed after cross-media pronunciation reuse."
          );
        }

        liveBundles = refreshed.data.bundles;
        const refreshedBundle = liveBundles.find(
          (candidate) => candidate.mediaSlug === bundle.mediaSlug
        );

        if (!refreshedBundle) {
          throw new Error(
            `Bundle '${bundle.mediaSlug}' disappeared after reuse.`
          );
        }

        currentBundle = refreshedBundle;
      }

      const summary = options.manual
        ? await fetchForvoPronunciationsForBundleManual({
            bundle: currentBundle,
            dryRun: options.dryRun,
            entryIds: options.entryIds,
            limit: options.limit,
            manual: {
              controlPort: options.controlPort,
              downloadsDir: path.resolve(options.manualDownloadsDir),
              knownMissingPath: path.resolve(options.knownMissingPath),
              openUrls: options.manualOpenUrls,
              openWordAddOnSkip: options.openWordAddOnSkip,
              requestRegistryPath: path.resolve(options.requestRegistryPath),
              retryKnownMissing: options.retryKnownMissing
            },
            refresh: options.refresh,
            wordListSource,
            words: options.words
          })
        : await fetchForvoPronunciationsForBundle({
            browser: {
              browserTimeoutMs: options.browserTimeoutMs,
              headless: options.headless,
              knownMissingPath: path.resolve(options.knownMissingPath),
              keepBrowserOpen: options.keepBrowserOpen,
              profileDir: path.resolve(options.profileDir),
              retryKnownMissing: options.retryKnownMissing
            },
            bundle: currentBundle,
            dryRun: options.dryRun,
            entryIds: options.entryIds,
            limit: options.limit,
            refresh: options.refresh,
            wordListSource,
            words: options.words
          });

      console.info(
        `${bundle.mediaSlug}: ${summary.matched} matched, ${summary.missed} missing`
      );

      for (const unresolved of summary.requestedUnresolved) {
        console.info(`  skipped ${unresolved.raw} (${unresolved.reason})`);
      }

      for (const skipped of summary.knownMissingSkipped ?? []) {
        console.info(
          `  skipped ${skipped.kind}:${skipped.entryId} (known missing on Forvo)`
        );
      }

      for (const result of summary.results) {
        if (result.status === "matched") {
          const speaker = "speaker" in result ? result.speaker : undefined;
          const votes = "votes" in result ? result.votes : undefined;
          const detail =
            typeof votes === "number"
              ? `speaker=${speaker ?? "unknown"} votes=${votes}`
              : `speaker=${speaker ?? "unknown"}`;
          console.info(
            `  matched ${result.kind}:${result.entryId} -> ${detail}`
          );
        } else if (result.status === "skipped_known_missing") {
          console.info(
            `  skipped ${result.kind}:${result.entryId} (marked missing on Forvo)`
          );
        } else {
          console.info(`  miss ${result.kind}:${result.entryId}`);
        }
      }

      if (!options.dryRun) {
        const pendingSummary = await writeBundlePronunciationPendingSummary({
          bundle: currentBundle,
          knownMissingPath: path.resolve(options.knownMissingPath)
        });

        console.info(
          `  pending list updated -> workflow/pronunciation-pending.json (${pendingSummary.pendingCount} entries)`
        );
      }
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    controlPort: 3210,
    contentRoot: "content",
    dryRun: false,
    entryIds: [],
    headless: false,
    keepBrowserOpen: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    manual: false,
    manualDownloadsDir: path.join(os.homedir(), "Downloads"),
    manualOpenUrls: true,
    mediaSlugs: [],
    profileDir: path.join("data", "forvo-profile"),
    openWordAddOnSkip: true,
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
      options.contentRoot = normalizedArgv[index + 1] ?? options.contentRoot;
      index += 1;
      continue;
    }

    if (argument === "--control-port") {
      const parsedPort = Number.parseInt(normalizedArgv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedPort) && parsedPort > 0) {
        options.controlPort = parsedPort;
      }

      index += 1;
      continue;
    }

    if (argument === "--media") {
      const mediaSlug = normalizedArgv[index + 1];

      if (mediaSlug) {
        options.mediaSlugs.push(mediaSlug);
      }

      index += 1;
      continue;
    }

    if (argument === "--limit") {
      const parsedLimit = Number.parseInt(normalizedArgv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedLimit) && parsedLimit >= 0) {
        options.limit = parsedLimit;
      }

      index += 1;
      continue;
    }

    if (argument === "--word") {
      const word = normalizedArgv[index + 1];

      if (word) {
        options.words.push(word);
      }

      index += 1;
      continue;
    }

    if (argument === "--entry") {
      const entryId = normalizedArgv[index + 1];

      if (entryId) {
        options.entryIds.push(entryId);
      }

      index += 1;
      continue;
    }

    if (argument === "--words-file") {
      options.wordListPath = normalizedArgv[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--manual") {
      options.manual = true;
      continue;
    }

    if (argument === "--downloads-dir") {
      options.manualDownloadsDir =
        normalizedArgv[index + 1] ?? options.manualDownloadsDir;
      index += 1;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath =
        normalizedArgv[index + 1] ?? options.knownMissingPath;
      index += 1;
      continue;
    }

    if (argument === "--request-registry-file") {
      options.requestRegistryPath =
        normalizedArgv[index + 1] ?? options.requestRegistryPath;
      index += 1;
      continue;
    }

    if (argument === "--no-open") {
      options.manualOpenUrls = false;
      continue;
    }

    if (argument === "--no-open-word-add-on-skip") {
      options.openWordAddOnSkip = false;
      continue;
    }

    if (argument === "--profile-dir") {
      options.profileDir = normalizedArgv[index + 1] ?? options.profileDir;
      index += 1;
      continue;
    }

    if (argument === "--browser-timeout-ms") {
      const parsedTimeout = Number.parseInt(
        normalizedArgv[index + 1] ?? "",
        10
      );

      if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) {
        options.browserTimeoutMs = parsedTimeout;
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

    if (argument === "--headless") {
      options.headless = true;
      continue;
    }

    if (argument === "--retry-known-missing") {
      options.retryKnownMissing = true;
      continue;
    }

    if (argument === "--keep-browser-open") {
      options.keepBrowserOpen = true;
      continue;
    }
  }

  return options;
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

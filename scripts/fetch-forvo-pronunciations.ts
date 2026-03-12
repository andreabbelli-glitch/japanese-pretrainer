import path from "node:path";
import { readFile } from "node:fs/promises";
import os from "node:os";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import {
  fetchForvoPronunciationsForBundle,
  fetchForvoPronunciationsForBundleManual
} from "../src/lib/forvo-pronunciation-fetch.ts";
import { writeBundlePronunciationPendingSummary } from "../src/lib/pronunciation-workflow.ts";

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
  profileDir: string;
  refresh: boolean;
  retryKnownMissing: boolean;
  wordListPath?: string;
  words: string[];
};

const options = parseCliOptions(process.argv.slice(2));
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
  const bundles = parseResult.data.bundles.filter(
    (bundle) =>
      options.mediaSlugs.length === 0 ||
      options.mediaSlugs.includes(bundle.mediaSlug)
  );

  if (bundles.length === 0) {
    console.error("No media bundles matched the requested filters.");
    process.exitCode = 1;
  } else {
    for (const bundle of bundles) {
      const summary = options.manual
        ? await fetchForvoPronunciationsForBundleManual({
            bundle,
            dryRun: options.dryRun,
            entryIds: options.entryIds,
            limit: options.limit,
            manual: {
              controlPort: options.controlPort,
              downloadsDir: path.resolve(options.manualDownloadsDir),
              knownMissingPath: path.resolve(options.knownMissingPath),
              openUrls: options.manualOpenUrls,
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
            bundle,
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
        console.info(`  skipped ${skipped.kind}:${skipped.entryId} (known missing on Forvo)`);
      }

      for (const result of summary.results) {
        if (result.status === "matched") {
          const speaker = "speaker" in result ? result.speaker : undefined;
          const votes = "votes" in result ? result.votes : undefined;
          const detail =
            typeof votes === "number"
              ? `speaker=${speaker ?? "unknown"} votes=${votes}`
              : `speaker=${speaker ?? "unknown"}`;
          console.info(`  matched ${result.kind}:${result.entryId} -> ${detail}`);
        } else if (result.status === "skipped_known_missing") {
          console.info(`  skipped ${result.kind}:${result.entryId} (marked missing on Forvo)`);
        } else {
          console.info(`  miss ${result.kind}:${result.entryId}`);
        }
      }

      if (!options.dryRun) {
        const pendingSummary = await writeBundlePronunciationPendingSummary({
          bundle,
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
    refresh: false,
    retryKnownMissing: false,
    words: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--content-root") {
      options.contentRoot = argv[index + 1] ?? options.contentRoot;
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

    if (argument === "--media") {
      const mediaSlug = argv[index + 1];

      if (mediaSlug) {
        options.mediaSlugs.push(mediaSlug);
      }

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

    if (argument === "--word") {
      const word = argv[index + 1];

      if (word) {
        options.words.push(word);
      }

      index += 1;
      continue;
    }

    if (argument === "--entry") {
      const entryId = argv[index + 1];

      if (entryId) {
        options.entryIds.push(entryId);
      }

      index += 1;
      continue;
    }

    if (argument === "--words-file") {
      options.wordListPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--manual") {
      options.manual = true;
      continue;
    }

    if (argument === "--downloads-dir") {
      options.manualDownloadsDir =
        argv[index + 1] ?? options.manualDownloadsDir;
      index += 1;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath =
        argv[index + 1] ?? options.knownMissingPath;
      index += 1;
      continue;
    }

    if (argument === "--no-open") {
      options.manualOpenUrls = false;
      continue;
    }

    if (argument === "--profile-dir") {
      options.profileDir = argv[index + 1] ?? options.profileDir;
      index += 1;
      continue;
    }

    if (argument === "--browser-timeout-ms") {
      const parsedTimeout = Number.parseInt(argv[index + 1] ?? "", 10);

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

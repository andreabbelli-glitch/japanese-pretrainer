import path from "node:path";
import { readFile } from "node:fs/promises";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import { fetchPitchAccentsForBundle } from "../src/lib/pitch-accent-fetch.ts";
import type { PronunciationFetchNetworkOptions } from "../src/lib/pronunciation-fetch.ts";

type CliOptions = {
  contentRoot: string;
  dryRun: boolean;
  entryIds: string[];
  entryDelayMs?: number;
  limit?: number;
  mediaSlugs: string[];
  network: PronunciationFetchNetworkOptions;
  refresh: boolean;
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
      const summary = await fetchPitchAccentsForBundle({
        bundle,
        dryRun: options.dryRun,
        entryDelayMs: options.entryDelayMs,
        entryIds: options.entryIds,
        limit: options.limit,
        network: options.network,
        refresh: options.refresh,
        wordListSource,
        words: options.words
      });

      console.info(
        `${bundle.mediaSlug}: ${summary.resolved} resolved, ${summary.missed} misses, ${summary.errors} errors, ${summary.skipped} skipped`
      );

      for (const unresolved of summary.requestedUnresolved) {
        console.info(`  skipped ${unresolved.raw} (${unresolved.reason})`);
      }

      for (const result of summary.results) {
        if (result.status === "resolved") {
          console.info(
            `  resolved ${result.kind}:${result.entryId} -> ${result.pitchAccent} via ${result.source.sourceLabel} (${result.source.pageUrl})`
          );
        } else {
          console.info(
            `  ${result.status} ${result.kind}:${result.entryId}${result.detail ? ` (${result.detail})` : ""}`
          );
        }
      }
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    contentRoot: "content",
    dryRun: false,
    entryIds: [],
    mediaSlugs: [],
    network: {},
    refresh: false,
    words: []
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const argument = normalizedArgv[index];

    if (argument === "--content-root") {
      options.contentRoot = normalizedArgv[index + 1] ?? options.contentRoot;
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

    if (argument === "--entry-delay-ms") {
      const parsedDelay = Number.parseInt(normalizedArgv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        options.entryDelayMs = parsedDelay;
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

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--request-delay-ms") {
      const parsedDelay = Number.parseInt(normalizedArgv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        options.network.requestDelayMs = parsedDelay;
      }

      index += 1;
      continue;
    }

    if (argument === "--request-timeout-ms") {
      const parsedTimeout = Number.parseInt(
        normalizedArgv[index + 1] ?? "",
        10
      );

      if (Number.isFinite(parsedTimeout) && parsedTimeout >= 0) {
        options.network.requestTimeoutMs = parsedTimeout;
      }

      index += 1;
      continue;
    }

    if (argument === "--max-retries") {
      const parsedRetries = Number.parseInt(
        normalizedArgv[index + 1] ?? "",
        10
      );

      if (Number.isFinite(parsedRetries) && parsedRetries >= 0) {
        options.network.maxRetries = parsedRetries;
      }

      index += 1;
      continue;
    }

    if (argument === "--retry-base-delay-ms") {
      const parsedDelay = Number.parseInt(normalizedArgv[index + 1] ?? "", 10);

      if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
        options.network.retryBaseDelayMs = parsedDelay;
      }

      index += 1;
      continue;
    }

    if (argument === "--refresh") {
      options.refresh = true;
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

    const [key, ...valueParts] = argument.split("=");
    return [key!, valueParts.join("=")];
  });
}

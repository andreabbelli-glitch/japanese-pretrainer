import path from "node:path";
import { readFile } from "node:fs/promises";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import { MAX_TIMER_DELAY_MS } from "../src/lib/fetch-throttle.ts";
import { fetchPitchAccentsForBundle } from "../src/lib/pitch-accent-fetch.ts";
import type { PronunciationFetchNetworkOptions } from "../src/lib/pronunciation-shared.ts";

type PitchAccentSourceOption = "wiktionary" | "ojad" | "jiten";

type CliOptions = {
  contentRoot: string;
  dryRun: boolean;
  entryIds: string[];
  entryDelayMs?: number;
  limit?: number;
  mediaSlugs: string[];
  network: PronunciationFetchNetworkOptions;
  refresh: boolean;
  retryMisses: boolean;
  sources: PitchAccentSourceOption[];
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
        retryMisses: options.retryMisses,
        sources: options.sources,
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
    retryMisses: false,
    sources: [],
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

    if (argument === "--media") {
      options.mediaSlugs.push(
        readOptionValue(normalizedArgv, index, "--media")
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

    if (argument === "--entry-delay-ms") {
      options.entryDelayMs = readNonNegativeTimerDelayOption(
        normalizedArgv,
        index,
        "--entry-delay-ms"
      );
      index += 1;
      continue;
    }

    if (argument === "--word") {
      options.words.push(readOptionValue(normalizedArgv, index, "--word"));
      index += 1;
      continue;
    }

    if (argument === "--entry") {
      options.entryIds.push(readOptionValue(normalizedArgv, index, "--entry"));
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

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--request-delay-ms") {
      options.network.requestDelayMs = readNonNegativeTimerDelayOption(
        normalizedArgv,
        index,
        "--request-delay-ms"
      );
      index += 1;
      continue;
    }

    if (argument === "--request-timeout-ms") {
      options.network.requestTimeoutMs = readNonNegativeTimerDelayOption(
        normalizedArgv,
        index,
        "--request-timeout-ms"
      );
      index += 1;
      continue;
    }

    if (argument === "--max-retries") {
      options.network.maxRetries = readNonNegativeIntegerOption(
        normalizedArgv,
        index,
        "--max-retries"
      );
      index += 1;
      continue;
    }

    if (argument === "--retry-base-delay-ms") {
      options.network.retryBaseDelayMs = readNonNegativeTimerDelayOption(
        normalizedArgv,
        index,
        "--retry-base-delay-ms"
      );
      index += 1;
      continue;
    }

    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }

    if (argument === "--retry-misses") {
      options.retryMisses = true;
      continue;
    }

    if (argument === "--source") {
      options.sources.push(
        readPitchAccentSourceOption(
          readOptionValue(normalizedArgv, index, "--source")
        )
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readPitchAccentSourceOption(value: string): PitchAccentSourceOption {
  if (value === "wiktionary" || value === "ojad" || value === "jiten") {
    return value;
  }

  throw new Error("--source must be one of: wiktionary, ojad, jiten.");
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

function readNonNegativeTimerDelayOption(
  argv: string[],
  index: number,
  flag: string
) {
  const parsed = readNonNegativeIntegerOption(argv, index, flag);

  if (parsed > MAX_TIMER_DELAY_MS) {
    throw new Error(`${flag} must be at most ${MAX_TIMER_DELAY_MS} ms.`);
  }

  return parsed;
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

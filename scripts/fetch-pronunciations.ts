import path from "node:path";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import {
  fetchPronunciationsForBundle,
  type PronunciationFetchNetworkOptions
} from "../src/lib/pronunciation-fetch.ts";
import { writeBundlePronunciationPendingSummary } from "../src/lib/pronunciation-workflow.ts";

type CliOptions = {
  contentRoot: string;
  dryRun: boolean;
  limit?: number;
  mediaSlugs: string[];
  network: PronunciationFetchNetworkOptions;
  refresh: boolean;
};

const options = parseCliOptions(process.argv.slice(2));
const contentRoot = path.resolve(options.contentRoot);
const cacheRoot = path.resolve(process.cwd(), "data", "pronunciations-cache");
const parseResult = await parseContentRoot(contentRoot);

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

  for (const bundle of bundles) {
    const summary = await fetchPronunciationsForBundle({
      bundle,
      cacheRoot,
      dryRun: options.dryRun,
      limit: options.limit,
      network: options.network,
      refresh: options.refresh
    });

    console.info(
      `${bundle.mediaSlug}: ${summary.matched} matched, ${summary.missed} missing`
    );

    for (const result of summary.results) {
      if (result.status === "matched") {
        console.info(
          `  matched ${result.kind}:${result.entryId} -> ${result.fileTitle}`
        );
      } else {
        console.info(`  miss ${result.kind}:${result.entryId}`);
      }
    }

    if (!options.dryRun) {
      const pendingSummary = await writeBundlePronunciationPendingSummary({
        bundle,
        knownMissingPath: path.resolve(process.cwd(), "data", "forvo-known-missing.json")
      });

      console.info(
        `  pending list updated -> workflow/pronunciation-pending.json (${pendingSummary.pendingCount} entries)`
      );
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    contentRoot: "content",
    dryRun: false,
    mediaSlugs: [],
    network: {},
    refresh: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--content-root") {
      options.contentRoot = argv[index + 1] ?? options.contentRoot;
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

    if (argument === "--dry-run") {
      options.dryRun = true;
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

    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }
  }

  return options;
}

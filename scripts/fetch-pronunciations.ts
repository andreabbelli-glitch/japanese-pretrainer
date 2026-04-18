import path from "node:path";

import {
  parseContentRoot,
  parseMediaDirectory,
  type NormalizedMediaBundle
} from "../src/lib/content/index.ts";
import {
  createPronunciationReuseContext,
  fetchPronunciationsForBundle,
  loadForvoKnownMissingRegistry,
  loadForvoWordAddRequestRegistry,
  persistForvoWordAddRequestRegistry,
  reconcileForvoWordAddRequestRegistry,
  refreshPronunciationReuseContextBundle,
  reuseCrossMediaPronunciationsForBundle,
  writeBundlePronunciationPendingSummary,
  type PronunciationFetchNetworkOptions
} from "../src/lib/pronunciation.ts";
import { loadValidatedManifest } from "../src/lib/manifest-helpers.ts";
import { buildEntryKey } from "../src/lib/entry-id.ts";
import { collectPronunciationTargets } from "../src/lib/pronunciation-shared.ts";

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
  let liveBundles = parseResult.data.bundles;
  const reuseContext = await createPronunciationReuseContext(liveBundles);
  const knownMissingPath = path.resolve(
    process.cwd(),
    "data",
    "forvo-known-missing.json"
  );
  const knownMissingRegistry =
    await loadForvoKnownMissingRegistry(knownMissingPath);
  const bundles = liveBundles.filter(
    (bundle) =>
      options.mediaSlugs.length === 0 ||
      options.mediaSlugs.includes(bundle.mediaSlug)
  );

  for (const bundle of bundles) {
    const reuseSummary = await reuseCrossMediaPronunciationsForBundle({
      bundle,
      bundles: liveBundles,
      dryRun: options.dryRun,
      reuseContext
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

    const summary = await fetchPronunciationsForBundle({
      bundle,
      cacheRoot,
      dryRun: options.dryRun,
      limit: options.limit,
      network: options.network,
      refresh: options.refresh
    });

    let currentBundle = bundle;

    if (!options.dryRun && (reuseSummary.reused > 0 || summary.matched > 0)) {
      const refreshedState = await refreshBundleState({
        bundle,
        liveBundles,
        reuseContext
      });

      currentBundle = refreshedState.bundle;
      liveBundles = refreshedState.liveBundles;
    }

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
      await syncResolvedForvoRequests(currentBundle);
      const pendingSummary = await writeBundlePronunciationPendingSummary({
        bundle: currentBundle,
        knownMissingPath,
        knownMissingRegistry
      });

      console.info(
        `  pending list updated -> workflow/pronunciation-pending.json (${pendingSummary.pendingCount} entries)`
      );
    }
  }
}

async function refreshBundleState(input: {
  bundle: NormalizedMediaBundle;
  liveBundles: NormalizedMediaBundle[];
  reuseContext: Awaited<ReturnType<typeof createPronunciationReuseContext>>;
}) {
  const refreshed = await parseMediaDirectory(input.bundle.mediaDirectory);

  if (!refreshed.ok) {
    throw new Error(
      `Content validation failed for '${input.bundle.mediaSlug}' after pronunciation updates.`
    );
  }

  const refreshedBundle = refreshed.data;
  await refreshPronunciationReuseContextBundle(
    input.reuseContext,
    refreshedBundle
  );

  return {
    bundle: refreshedBundle,
    liveBundles: input.liveBundles.map((candidate) =>
      candidate.mediaSlug === refreshedBundle.mediaSlug
        ? refreshedBundle
        : candidate
    )
  };
}

async function syncResolvedForvoRequests(bundle: NormalizedMediaBundle) {
  const requestRegistryPath = path.resolve(
    process.cwd(),
    "data",
    "forvo-requested-word-add.json"
  );
  const { entries: manifestEntries } = await loadValidatedManifest(
    bundle.mediaDirectory,
    bundle.mediaSlug
  );
  const requestRegistry = await loadForvoWordAddRequestRegistry(requestRegistryPath);
  const changed = reconcileForvoWordAddRequestRegistry(
    requestRegistry,
    collectPronunciationTargets(bundle).map((entry) => {
      const manifestEntry = manifestEntries.get(buildEntryKey(entry.kind, entry.id));

      return {
        audioSource: manifestEntry?.audioSource,
        audioSrc: manifestEntry?.audioSrc ?? entry.audioSrc,
        entryId: entry.id,
        entryKind: entry.kind,
        mediaSlug: entry.mediaSlug
      };
    })
  );

  if (changed > 0) {
    await persistForvoWordAddRequestRegistry(requestRegistryPath, requestRegistry);
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

    if (argument === "--refresh") {
      options.refresh = true;
      continue;
    }
  }

  return options;
}

import path from "node:path";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import { reusePronunciationsAcrossMedia } from "../src/lib/pronunciation-reuse.ts";
import { writeBundlePronunciationPendingSummary } from "../src/lib/pronunciation-workflow.ts";

type CliOptions = {
  contentRoot: string;
  dryRun: boolean;
  knownMissingPath: string;
  mediaSlugs: string[];
};

const options = parseCliOptions(process.argv.slice(2));
const parseResult = await parseContentRoot(path.resolve(options.contentRoot));

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
    const summary = await reusePronunciationsAcrossMedia({
      allBundles: parseResult.data.bundles,
      bundle,
      dryRun: options.dryRun
    });

    for (const result of summary.results) {
      if (result.status === "reused") {
        console.info(
          `  reused ${result.kind}:${result.entryId} <- ${result.sourceMediaSlug}:${result.sourceEntryId}`
        );
        continue;
      }

      console.info(
        `  ambiguous ${result.kind}:${result.entryId} -> ${result.candidateMediaSlugs
          .map(
            (mediaSlug: string, index: number) =>
              `${mediaSlug}:${result.candidateEntryIds[index]}`
          )
          .join(", ")}`
      );
    }

    if (!options.dryRun) {
      const pendingSummary = await writeBundlePronunciationPendingSummary({
        bundle,
        knownMissingPath: path.resolve(options.knownMissingPath)
      });

      console.info(
        `${bundle.mediaSlug}: reused=${summary.reused} ambiguous=${summary.ambiguous} pending=${pendingSummary.pendingCount}`
      );
    } else {
      console.info(
        `${bundle.mediaSlug}: reused=${summary.reused} ambiguous=${summary.ambiguous}`
      );
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    contentRoot: "content",
    dryRun: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    mediaSlugs: []
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

    if (argument === "--known-missing-file") {
      options.knownMissingPath = argv[index + 1] ?? options.knownMissingPath;
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
  }

  return options;
}

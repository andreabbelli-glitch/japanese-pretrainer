import path from "node:path";

import { parseContentRoot } from "../src/lib/content/validator.ts";
import { writeBundlePronunciationPendingSummary } from "../src/lib/pronunciation-workflow.ts";

const options = parseCliOptions(process.argv.slice(2));
const contentRoot = path.resolve(options.contentRoot);
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
    const summary = await writeBundlePronunciationPendingSummary({
      bundle,
      knownMissingPath: path.resolve(options.knownMissingPath)
    });

    console.info(
      [
        `Media '${summary.mediaSlug}':`,
        `targets=${summary.totalTargets}`,
        `audio=${summary.audioBackedCount}`,
        `known_missing=${summary.knownMissingCount}`,
        `pending=${summary.pendingCount}`
      ].join(" ")
    );

    for (const entry of summary.pending) {
      const readingText = entry.reading ? ` reading=${entry.reading}` : "";
      console.info(
        `  pending ${entry.entryType}:${entry.entryId} label=${entry.label}${readingText}`
      );
    }
  }
}

function parseCliOptions(args: string[]) {
  let contentRoot = path.resolve(process.cwd(), "content");
  let knownMissingPath = path.join("data", "forvo-known-missing.json");
  const mediaSlugs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --content-root.");
      }

      contentRoot = path.resolve(nextValue);
      index += 1;
      continue;
    }

    if (value === "--media-slug") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --media-slug.");
      }

      mediaSlugs.push(nextValue);
      index += 1;
      continue;
    }

    if (value === "--known-missing-file") {
      const nextValue = args[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --known-missing-file.");
      }

      knownMissingPath = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return {
    contentRoot,
    knownMissingPath,
    mediaSlugs: [...new Set(mediaSlugs)]
  };
}

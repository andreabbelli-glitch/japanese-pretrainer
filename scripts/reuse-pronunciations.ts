import path from "node:path";

type CliOptions = {
  contentRoot: string;
  dryRun: boolean;
  knownMissingPath: string;
  mediaSlugs: string[];
};

const options = parseCliOptions(process.argv.slice(2));
const { parseContentRoot } = await import("../src/lib/content/validator.ts");
const {
  createPronunciationReuseContext,
  refreshPronunciationReuseContextBundle,
  reusePronunciationsAcrossMedia,
  writeBundlePronunciationPendingSummary
} = await import("../src/lib/pronunciation.ts");
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
  const reuseContext = await createPronunciationReuseContext(
    parseResult.data.bundles
  );

  for (const bundle of bundles) {
    const summary = await reusePronunciationsAcrossMedia({
      allBundles: parseResult.data.bundles,
      bundle,
      dryRun: options.dryRun,
      reuseContext
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
      if (summary.reused > 0) {
        await refreshPronunciationReuseContextBundle(reuseContext, bundle);
      }

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

    if (argument === "--") {
      continue;
    }

    if (argument === "--content-root") {
      options.contentRoot = readOptionValue(argv, index, "--content-root");
      index += 1;
      continue;
    }

    if (argument === "--media" || argument === "--media-slug") {
      options.mediaSlugs.push(readOptionValue(argv, index, argument));
      index += 1;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath = readOptionValue(
        argv,
        index,
        "--known-missing-file"
      );
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    ...options,
    mediaSlugs: [...new Set(options.mediaSlugs)]
  };
}

function readOptionValue(argv: string[], index: number, optionName: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

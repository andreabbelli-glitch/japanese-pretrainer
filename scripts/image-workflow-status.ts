import { readdir } from "node:fs/promises";
import path from "node:path";

import { summarizeMediaImageWorkflow } from "../src/lib/image-workflow.ts";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const mediaDirectories =
    cliOptions.mediaSlugs.length > 0
      ? cliOptions.mediaSlugs.map((mediaSlug) =>
          path.join(cliOptions.contentRoot, "media", mediaSlug)
        )
      : await listMediaDirectories(cliOptions.contentRoot);

  for (const mediaDirectory of mediaDirectories) {
    const summary = await summarizeMediaImageWorkflow(mediaDirectory);

    console.info(
      [
        `Media '${summary.mediaSlug}':`,
        `requests=${summary.requestsTotal}`,
        `assets=${summary.assetsTotal}`,
        `pending=${summary.pendingRequestIds.length}`,
        `ready=${summary.readyToApplyIds.length}`,
        `applied=${summary.appliedIds.length}`,
        `orphaned=${summary.orphanedAssetIds.length}`
      ].join(" ")
    );

    for (const requestId of summary.pendingRequestIds) {
      console.info(`  pending  ${requestId}`);
    }

    for (const requestId of summary.readyToApplyIds) {
      console.info(`  ready    ${requestId}`);
    }

    for (const requestId of summary.appliedIds) {
      console.info(`  applied  ${requestId}`);
    }

    for (const assetId of summary.orphanedAssetIds) {
      console.info(`  orphaned ${assetId}`);
    }
  }
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

function resolveCliOptions(args: string[]) {
  let contentRoot = path.resolve(process.cwd(), "content");
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

    throw new Error(`Unknown argument: ${value}`);
  }

  return {
    contentRoot,
    mediaSlugs: [...new Set(mediaSlugs)]
  };
}

async function listMediaDirectories(contentRoot: string) {
  const mediaRoot = path.join(contentRoot, "media");
  const entries = await readdir(mediaRoot, {
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(mediaRoot, entry.name));
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return `Image workflow status failed: ${error.message}`;
  }

  return "Image workflow status failed with an unknown error.";
}

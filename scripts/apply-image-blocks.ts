import { readdir } from "node:fs/promises";
import path from "node:path";

import { applyMediaImageBlocks } from "../src/lib/image-workflow.ts";

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const mediaDirectories =
    cliOptions.mediaSlugs.length > 0
      ? cliOptions.mediaSlugs.map((mediaSlug) =>
          path.join(cliOptions.contentRoot, "media", mediaSlug)
        )
      : await listMediaDirectories(cliOptions.contentRoot);

  let appliedCount = 0;
  let skippedCount = 0;
  let orphanedCount = 0;
  let missingLessonCount = 0;
  let missingAssetCount = 0;
  let missingAnchorCount = 0;

  for (const mediaDirectory of mediaDirectories) {
    const result = await applyMediaImageBlocks(
      mediaDirectory,
      cliOptions.dryRun
    );
    const mediaSlug = path.basename(mediaDirectory);

    appliedCount += result.applied.length;
    skippedCount += result.skippedExisting.length;
    orphanedCount += result.orphanedAssets.length;
    missingLessonCount += result.missingLesson.length;
    missingAssetCount += result.missingAsset.length;
    missingAnchorCount += result.missingAnchor.length;

    console.info(
      [
        `Media '${mediaSlug}':`,
        `applied=${result.applied.length}`,
        `skipped=${result.skippedExisting.length}`,
        `orphaned=${result.orphanedAssets.length}`,
        `missing-lessons=${result.missingLesson.length}`,
        `missing-assets=${result.missingAsset.length}`,
        `missing-anchors=${result.missingAnchor.length}`,
        cliOptions.dryRun ? "mode=dry-run" : "mode=write"
      ].join(" ")
    );

    for (const record of result.applied) {
      console.info(`  applied ${record.assetId} -> ${record.lessonFile}`);
    }

    for (const record of result.skippedExisting) {
      console.info(`  skipped ${record.assetId} -> ${record.lessonFile}`);
    }

    for (const assetId of result.orphanedAssets) {
      console.info(`  orphaned ${assetId}`);
    }

    for (const record of result.missingLesson) {
      console.info(
        `  missing-lesson ${record.assetId} -> lesson slug '${record.lessonSlug}'`
      );
    }

    for (const record of result.missingAsset) {
      console.info(`  missing-asset ${record.assetId} -> ${record.src}`);
    }

    for (const record of result.missingAnchor) {
      console.info(
        `  missing-anchor ${record.assetId} -> '${record.anchor}' in ${record.lessonFile}`
      );
    }
  }

  if (
    missingLessonCount > 0 ||
    missingAssetCount > 0 ||
    missingAnchorCount > 0 ||
    orphanedCount > 0
  ) {
    process.exitCode = 1;
  }

  console.info(
    [
      "Image apply summary:",
      `applied=${appliedCount}`,
      `skipped=${skippedCount}`,
      `orphaned=${orphanedCount}`,
      `missing-lessons=${missingLessonCount}`,
      `missing-assets=${missingAssetCount}`,
      `missing-anchors=${missingAnchorCount}`
    ].join(" ")
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

function resolveCliOptions(args: string[]) {
  let contentRoot = path.resolve(process.cwd(), "content");
  const mediaSlugs: string[] = [];
  let dryRun = false;

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

    if (value === "--dry-run") {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return {
    contentRoot,
    dryRun,
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
    return `Apply image blocks failed: ${error.message}`;
  }

  return "Apply image blocks failed with an unknown error.";
}

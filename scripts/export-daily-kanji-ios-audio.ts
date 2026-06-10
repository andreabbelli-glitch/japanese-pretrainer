import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DailyKanjiDataset } from "../src/features/daily-kanji/types.ts";
import { copyDailyKanjiAudioAssets } from "../src/features/daily-kanji/server/audio-packager.ts";

const defaultDatasetPath = path.join(
  process.cwd(),
  "apps",
  "daily-kanji-ios",
  "App",
  "Resources",
  "daily-kanji-cards.json"
);
const defaultOutputPath = path.join(
  process.cwd(),
  "apps",
  "daily-kanji-ios",
  "App",
  "Resources",
  "Audio"
);

try {
  const options = resolveCliOptions(process.argv.slice(2));
  const dataset = await readDataset(options.datasetPath);
  const result = await copyDailyKanjiAudioAssets({
    contentRoot: path.resolve(options.contentRoot),
    dataset,
    outputRoot: path.resolve(options.outputPath)
  });

  if (result.missing.length > 0) {
    for (const missing of result.missing.slice(0, 20)) {
      console.error(
        `Missing Daily Kanji audio for ${missing.cardId}: ${missing.sourcePath}`
      );
    }

    if (result.missing.length > 20) {
      console.error(
        `...and ${result.missing.length - 20} more missing file(s).`
      );
    }

    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Copied ${result.copied} Daily Kanji audio file(s) to ${result.outputRoot}\n`
    );

    if (result.unsupported.length > 0) {
      process.stdout.write(
        `Skipped ${result.unsupported.length} unsupported iOS audio file(s).\n`
      );
    }
  }
} catch (error) {
  console.error(formatError(error));
  process.exitCode = 1;
}

type CliOptions = {
  contentRoot: string;
  datasetPath: string;
  outputPath: string;
};

function resolveCliOptions(args: string[]): CliOptions {
  let contentRoot = path.join(process.cwd(), "content");
  let datasetPath = defaultDatasetPath;
  let outputPath = defaultOutputPath;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      contentRoot = readOptionValue(args, index, "--content-root");
      index += 1;
      continue;
    }

    if (value === "--dataset") {
      datasetPath = readOptionValue(args, index, "--dataset");
      index += 1;
      continue;
    }

    if (value === "--out") {
      outputPath = readOptionValue(args, index, "--out");
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    throw new Error(`Unexpected positional argument: ${value}`);
  }

  return {
    contentRoot,
    datasetPath,
    outputPath
  };
}

async function readDataset(datasetPath: string): Promise<DailyKanjiDataset> {
  const data = await readFile(path.resolve(datasetPath), "utf8");

  return JSON.parse(data) as DailyKanjiDataset;
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "daily-kanji:export-audio failed with an unknown error.";
}

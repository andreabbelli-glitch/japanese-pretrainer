import path from "node:path";

import {
  syncTofuguPronunciationDataset,
  tofuguPronunciationDatasetDefaultDirectory,
  tofuguPronunciationDatasetRepositoryUrl
} from "../src/features/pronunciation/tooling/tofugu-dataset.ts";

type CliOptions = {
  datasetDir: string;
  repositoryUrl: string;
};

try {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await syncTofuguPronunciationDataset({
    datasetDir: path.resolve(options.datasetDir),
    repositoryUrl: options.repositoryUrl
  });

  console.info(`tofugu_dataset=${result.status} path=${result.datasetDir}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseCliOptions(argv: string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    datasetDir: tofuguPronunciationDatasetDefaultDirectory,
    repositoryUrl: tofuguPronunciationDatasetRepositoryUrl
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const argument = normalizedArgv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--dataset-dir") {
      options.datasetDir = readOptionValue(
        normalizedArgv,
        index,
        "--dataset-dir"
      );
      index += 1;
      continue;
    }

    if (argument === "--repo-url") {
      options.repositoryUrl = readOptionValue(
        normalizedArgv,
        index,
        "--repo-url"
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readOptionValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function expandEqualsOptions(argv: string[]) {
  return argv.flatMap((argument) => {
    if (!argument.startsWith("--") || !argument.includes("=")) {
      return [argument];
    }

    const separatorIndex = argument.indexOf("=");

    return [
      argument.slice(0, separatorIndex),
      argument.slice(separatorIndex + 1)
    ];
  });
}

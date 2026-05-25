import path from "node:path";

import { validateGeneratedTofuguPitchMinimalPairsCorpus } from "../src/features/pitch-accent/tooling/validator.ts";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const outDir = path.resolve(
    options.outDir ?? "public/vendor/tofugu-pitch-minimal-pairs"
  );
  const result = await validateGeneratedTofuguPitchMinimalPairsCorpus({
    kuuuubeManifestPath: options.kuuuubeManifestPath
      ? path.resolve(options.kuuuubeManifestPath)
      : undefined,
    outDir
  });

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Tofugu pitch minimal pairs corpus is valid: ${outDir}`);
}

type CliOptions = {
  kuuuubeManifestPath?: string;
  outDir?: string;
};

function parseCliOptions(argv: readonly string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {};

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const argument = normalizedArgv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--kuuuube-manifest") {
      options.kuuuubeManifestPath = readOptionValue(
        normalizedArgv,
        index,
        "--kuuuube-manifest"
      );
      index += 1;
      continue;
    }

    if (argument === "--out-dir") {
      options.outDir = readOptionValue(normalizedArgv, index, "--out-dir");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readOptionValue(argv: readonly string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function expandEqualsOptions(argv: readonly string[]) {
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import path from "node:path";

import {
  generateTofuguPitchMinimalPairsCorpus
} from "../src/features/pitch-accent/tooling/tofugu-generator.ts";
import {
  validateGeneratedTofuguPitchMinimalPairsCorpus
} from "../src/features/pitch-accent/tooling/validator.ts";

type CliOptions = {
  allowNonVendorOutDir: boolean;
  dryRun: boolean;
  jaydarExportPath?: string;
  kanjiumDataPath?: string;
  kuuuubeManifestPath?: string;
  outDir?: string;
  tofuguDatasetDir?: string;
};

try {
  const options = parseCliOptions(process.argv.slice(2));

  if (!options.jaydarExportPath) {
    throw new Error(
      "Missing required --jaydar-export <path>. Generate this JSONL export with Jaydar before building the static Tofugu pitch corpus."
    );
  }

  const result = await generateTofuguPitchMinimalPairsCorpus({
    allowNonVendorOutDir: options.allowNonVendorOutDir,
    dryRun: options.dryRun,
    jaydarExportPath: path.resolve(options.jaydarExportPath),
    kanjiumDataPath: options.kanjiumDataPath,
    kuuuubeManifestPath: options.kuuuubeManifestPath,
    outDir: options.outDir,
    tofuguDatasetDir: options.tofuguDatasetDir
  });

  if (!options.dryRun) {
    const kuuuubeManifestPath = path.resolve(
      options.kuuuubeManifestPath ??
        "public/vendor/minimal-pairs/manifest.json"
    );
    const validation = await validateGeneratedTofuguPitchMinimalPairsCorpus({
      kuuuubeManifestPath,
      outDir: path.resolve(
        options.outDir ?? "public/vendor/tofugu-pitch-minimal-pairs"
      )
    });

    if (!validation.ok) {
      throw new Error(
        `Generated Tofugu pitch corpus failed validation: ${validation.errors.join(
          "; "
        )}`
      );
    }
  }

  console.info(
    [
      `Generated ${result.pairCount} Tofugu pitch minimal pairs`,
      `${result.optionCount} options`,
      `${result.audioFileCount} audio files`,
      options.dryRun ? "(dry run)" : "to public/vendor/tofugu-pitch-minimal-pairs"
    ].join(", ")
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseCliOptions(argv: readonly string[]): CliOptions {
  const normalizedArgv = expandEqualsOptions(argv);
  const options: CliOptions = {
    allowNonVendorOutDir: false,
    dryRun: false
  };

  for (let index = 0; index < normalizedArgv.length; index += 1) {
    const argument = normalizedArgv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--allow-non-vendor-out-dir") {
      options.allowNonVendorOutDir = true;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--jaydar-export") {
      options.jaydarExportPath = readOptionValue(
        normalizedArgv,
        index,
        "--jaydar-export"
      );
      index += 1;
      continue;
    }

    if (argument === "--kanjium-data-path") {
      options.kanjiumDataPath = readOptionValue(
        normalizedArgv,
        index,
        "--kanjium-data-path"
      );
      index += 1;
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

    if (argument === "--tofugu-dataset-dir") {
      options.tofuguDatasetDir = readOptionValue(
        normalizedArgv,
        index,
        "--tofugu-dataset-dir"
      );
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

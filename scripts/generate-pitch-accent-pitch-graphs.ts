import { stat } from "node:fs/promises";
import path from "node:path";

import { generatePitchGraphManifestForCorpus } from "../src/features/pitch-accent/tooling/pitch-graph-generator.ts";

type PitchGraphTarget = {
  readonly manifestPath: string;
  readonly outPath: string;
  readonly required: boolean;
  readonly requiredAudioSrcPrefix: string;
};

const defaultTargets: readonly PitchGraphTarget[] = [
  {
    manifestPath: "public/vendor/minimal-pairs/manifest.json",
    outPath: "public/vendor/minimal-pairs/pitch-graphs.json",
    required: true,
    requiredAudioSrcPrefix: "/vendor/minimal-pairs/audio/"
  },
  {
    manifestPath: "public/vendor/tofugu-pitch-minimal-pairs/manifest.json",
    outPath: "public/vendor/tofugu-pitch-minimal-pairs/pitch-graphs.json",
    required: false,
    requiredAudioSrcPrefix: "/vendor/tofugu-pitch-minimal-pairs/audio/"
  }
];

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  for (const target of defaultTargets) {
    const manifestPath = path.resolve(target.manifestPath);
    const outPath = path.resolve(target.outPath);

    if (!(await shouldGenerateTarget(manifestPath, target.required))) {
      console.info(`Skipping missing optional corpus: ${manifestPath}`);
      continue;
    }

    const result = await generatePitchGraphManifestForCorpus({
      concurrency: options.concurrency,
      graphVersion: options.graphVersion,
      manifestPath,
      outPath,
      requiredAudioSrcPrefix: target.requiredAudioSrcPrefix
    });

    console.info(
      `Generated ${result.audioCount} pitch graphs: ${result.outputPath}`
    );
  }
}

async function shouldGenerateTarget(manifestPath: string, required: boolean) {
  try {
    await stat(manifestPath);
    return true;
  } catch (error) {
    if (!required && isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

function parseCliOptions(argv: readonly string[]) {
  const options = {
    concurrency: 4,
    graphVersion: 1 as 1 | 2
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--concurrency") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --concurrency.");
      }

      options.concurrency = Number.parseInt(value, 10);
      if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
        throw new Error("--concurrency must be a positive integer.");
      }

      index += 1;
      continue;
    }

    if (argument === "--graph-version") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --graph-version.");
      }

      if (value !== "1" && value !== "2") {
        throw new Error("--graph-version must be 1 or 2.");
      }

      options.graphVersion = Number.parseInt(value, 10) as 1 | 2;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function isMissingFileError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

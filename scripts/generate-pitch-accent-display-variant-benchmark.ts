import {
  generatePitchGraphDisplayVariantReport,
  type GeneratePitchGraphDisplayVariantReportInput
} from "../src/features/pitch-accent/tooling/pitch-graph-display-variants.ts";

type MutableDisplayVariantReportInput = {
  -readonly [Key in keyof GeneratePitchGraphDisplayVariantReportInput]: GeneratePitchGraphDisplayVariantReportInput[Key];
};

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await generatePitchGraphDisplayVariantReport(options);

  console.info(
    `Generated ${result.pairCount} pair / ${result.targetCount} audio display variants.`
  );
  console.info(`Audit: ${result.auditPath}`);
  console.info(`HTML: ${result.htmlPath}`);
}

function parseCliOptions(
  argv: readonly string[]
): GeneratePitchGraphDisplayVariantReportInput {
  const options: MutableDisplayVariantReportInput = {
    manifestPath: "public/vendor/minimal-pairs/manifest.json",
    outDir: ".tmp/pitch-graph-display-variants",
    publicDir: "public",
    requiredAudioSrcPrefix: "/vendor/minimal-pairs/audio/"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    switch (argument) {
      case "--concurrency":
        options.concurrency = readPositiveInteger(argv, index, argument);
        index += 1;
        break;
      case "--limit":
        options.limit = readPositiveInteger(argv, index, argument);
        index += 1;
        break;
      case "--manifest":
        options.manifestPath = readValue(argv, index, argument);
        index += 1;
        break;
      case "--out-dir":
        options.outDir = readValue(argv, index, argument);
        index += 1;
        break;
      case "--public-dir":
        options.publicDir = readValue(argv, index, argument);
        index += 1;
        break;
      case "--required-audio-prefix":
        options.requiredAudioSrcPrefix = readValue(argv, index, argument);
        index += 1;
        break;
      case "--sample-rate":
        options.sampleRate = readPositiveInteger(argv, index, argument);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function readValue(argv: readonly string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readPositiveInteger(
  argv: readonly string[],
  index: number,
  flag: string
) {
  const value = Number.parseInt(readValue(argv, index, flag), 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

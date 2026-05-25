import { generatePitchGraphBakeoffReportForCorpus } from "../src/features/pitch-accent/tooling/pitch-graph-bakeoff.ts";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const result = await generatePitchGraphBakeoffReportForCorpus(options);

  console.info(`Generated ${result.targetCount} bake-off targets.`);
  console.info(`Audit: ${result.auditPath}`);
  console.info(`HTML: ${result.htmlPath}`);
}

function parseCliOptions(argv: readonly string[]) {
  const options: {
    allowKotuApi: boolean;
    enableExternalExtractors: boolean;
    kotuApiBaseUrl: string;
    kotuApiDelayMs: number;
    kotuApiScanLimit: number;
    kotuApiSeed: number;
    kotuBaselineCachePath?: string;
    limit: number;
    manifestPath: string;
    outDir: string;
    pairIds: string[];
    publicDir: string;
    requiredAudioSrcPrefix: string;
    sampleRate: number;
  } = {
    allowKotuApi: false,
    enableExternalExtractors: true,
    kotuApiBaseUrl: "https://api.kotu.io/v2",
    kotuApiDelayMs: 250,
    kotuApiScanLimit: 1_000,
    kotuApiSeed: 2_012_583_632,
    limit: 30,
    manifestPath: "public/vendor/minimal-pairs/manifest.json",
    outDir: ".tmp/pitch-graph-bakeoff",
    pairIds: [],
    publicDir: "public",
    requiredAudioSrcPrefix: "/vendor/minimal-pairs/audio/",
    sampleRate: 16_000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    switch (argument) {
      case "--allow-kotu-api":
        options.allowKotuApi = true;
        break;
      case "--kotu-api-base-url":
        options.kotuApiBaseUrl = readValue(argv, index, argument);
        index += 1;
        break;
      case "--kotu-api-delay-ms":
        options.kotuApiDelayMs = readNonNegativeInteger(argv, index, argument);
        index += 1;
        break;
      case "--kotu-api-scan-limit":
        options.kotuApiScanLimit = readPositiveInteger(argv, index, argument);
        index += 1;
        break;
      case "--kotu-api-seed":
        options.kotuApiSeed = readNonNegativeInteger(argv, index, argument);
        index += 1;
        break;
      case "--kotu-cache":
        options.kotuBaselineCachePath = readValue(argv, index, argument);
        index += 1;
        break;
      case "--limit":
        options.limit = readPositiveInteger(argv, index, argument);
        index += 1;
        break;
      case "--no-external-extractors":
        options.enableExternalExtractors = false;
        break;
      case "--manifest":
        options.manifestPath = readValue(argv, index, argument);
        index += 1;
        break;
      case "--out-dir":
        options.outDir = readValue(argv, index, argument);
        index += 1;
        break;
      case "--pair-id":
        options.pairIds.push(readValue(argv, index, argument));
        index += 1;
        break;
      case "--public-dir":
        options.publicDir = readValue(argv, index, argument);
        index += 1;
        break;
      case "--required-audio-src-prefix":
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

  return {
    ...options,
    pairIds: options.pairIds.length > 0 ? options.pairIds : undefined
  };
}

function readValue(argv: readonly string[], index: number, flag: string) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function readNonNegativeInteger(
  argv: readonly string[],
  index: number,
  flag: string
) {
  const value = Number.parseInt(readValue(argv, index, flag), 10);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
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

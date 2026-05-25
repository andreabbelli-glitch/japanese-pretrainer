import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  computePitchBenchmarkMetrics,
  renderPitchBenchmarkReportHtml,
  type PitchBenchmarkReportSample,
  type PitchBenchmarkSeries
} from "../src/features/pitch-accent/tooling/pitch-graph-benchmark.ts";

type ExternalPitchExtractorOutput = {
  readonly durationMs: number;
  readonly errors?: Readonly<Record<string, string>>;
  readonly extractors: Readonly<
    Record<
      string,
      | {
          readonly rawValues: readonly number[];
          readonly sampleIntervalMs?: number;
          readonly timestampsMs?: readonly number[];
        }
      | undefined
    >
  >;
  readonly sampleIntervalMs: number;
};

type PtdbTugSampleDefinition = {
  readonly gender: "FEMALE" | "MALE";
  readonly speaker: string;
  readonly utterance: string;
};

const execFileAsync = promisify(execFile);
const ptdbTugBaseUrl =
  "https://www2.spsc.tugraz.at/databases/PTDB-TUG/SPEECH%20DATA";
const referenceSampleIntervalMs = 10;

const defaultSamples: readonly PtdbTugSampleDefinition[] = [
  { gender: "FEMALE", speaker: "F01", utterance: "si548" },
  { gender: "FEMALE", speaker: "F02", utterance: "sa2" },
  { gender: "FEMALE", speaker: "F03", utterance: "si831" },
  { gender: "MALE", speaker: "M01", utterance: "si453" },
  { gender: "MALE", speaker: "M02", utterance: "sa1" }
];

const extractorDefinitions = [
  {
    key: "worldHarvest",
    label: "WORLD Harvest raw",
    summary: "WORLD Harvest + StoneMask, raw voiced frames compared to PTDB F0."
  },
  {
    key: "praatRaw",
    label: "Praat raw",
    summary: "Parselmouth Praat to_pitch at 10ms, raw voiced frames."
  },
  {
    key: "onseiPraat",
    label: "Onsei Praat smooth",
    summary:
      "Onsei-style Parselmouth to_pitch(5ms), kill_octave_jumps(), smooth()."
  },
  {
    key: "pyinRaw",
    label: "pYIN raw",
    summary: "librosa.pyin at the benchmark hop size."
  },
  {
    key: "swiftF0Raw",
    label: "SwiftF0 raw",
    summary: "SwiftF0 model pitch_hz output without voicing mask."
  },
  {
    key: "swiftF0Normalized",
    label: "SwiftF0 voiced-gated",
    summary: "SwiftF0 confidence > 0.9 and speech range 65-400 Hz."
  },
  {
    key: "swiftF0Smoothed",
    label: "SwiftF0 voiced-gated smoothed",
    summary:
      "SwiftF0 voiced-gated trace plus short-gap interpolation and smoothing; longer unvoiced spans stay as gaps."
  }
] as const;

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const outDir = path.resolve(options.outDir);
  const audioDir = path.join(outDir, "audio");
  const samples = defaultSamples.slice(0, options.limit);
  const reportSamples: PitchBenchmarkReportSample[] = [];

  await mkdir(audioDir, { recursive: true });

  for (const sample of samples) {
    const sampleId = `${sample.speaker}_${sample.utterance}`;
    const micPath = path.join(audioDir, `mic_${sampleId}.wav`);
    const refPath = path.join(audioDir, `ref_${sampleId}.f0`);

    await downloadIfNeeded(buildPtdbTugUrl(sample, "MIC"), micPath);
    await downloadIfNeeded(buildPtdbTugUrl(sample, "REF"), refPath);

    const reference = await readPtdbTugReferenceF0(refPath);
    const externalOutput = await extractPitchGraphs(micPath);

    reportSamples.push({
      audioHref: path.relative(outDir, micPath),
      durationMs: externalOutput.durationMs,
      extractors: extractorDefinitions.map((definition) => {
        const output = externalOutput.extractors[definition.key];

        if (!output) {
          return {
            metrics: null,
            series: {
              label: definition.label,
              sampleIntervalMs: externalOutput.sampleIntervalMs,
              values: []
            },
            status: "unavailable" as const,
            summary:
              externalOutput.errors?.[definition.key] ??
              `${definition.label} did not produce output.`
          };
        }

        const series: PitchBenchmarkSeries = {
          label: definition.label,
          sampleIntervalMs:
            output.sampleIntervalMs ?? externalOutput.sampleIntervalMs,
          timestampsMs: output.timestampsMs,
          values: output.rawValues
        };

        return {
          metrics: computePitchBenchmarkMetrics({
            candidate: series,
            reference
          }),
          series,
          status: "available" as const,
          summary: definition.summary
        };
      }),
      gender: sample.gender,
      reference,
      speaker: sample.speaker,
      utterance: sample.utterance
    });
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    reference: {
      dataset: "PTDB-TUG",
      source: "https://www2.spsc.tugraz.at/databases/PTDB-TUG/SPEECH%20DATA/",
      sampleIntervalMs: referenceSampleIntervalMs
    },
    samples: reportSamples
  };
  const auditPath = path.join(outDir, "audit.json");
  const htmlPath = path.join(outDir, "report.html");

  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(
    htmlPath,
    renderPitchBenchmarkReportHtml({
      generatedAt: audit.generatedAt,
      samples: reportSamples
    })
  );

  console.info(`Generated ${reportSamples.length} PTDB-TUG benchmark samples.`);
  console.info(`Audit: ${auditPath}`);
  console.info(`HTML: ${htmlPath}`);
}

function parseCliOptions(argv: readonly string[]) {
  const options = {
    limit: 5,
    outDir: ".tmp/ptdb-tug-pitch-benchmark"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--") {
      continue;
    }

    switch (argument) {
      case "--limit":
        options.limit = Math.min(
          defaultSamples.length,
          readPositiveInteger(argv, index, argument)
        );
        index += 1;
        break;
      case "--out-dir":
        options.outDir = readValue(argv, index, argument);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function downloadIfNeeded(url: string, outPath: string) {
  try {
    await readFile(outPath);
    return;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  await writeFile(outPath, Buffer.from(await response.arrayBuffer()));
}

function buildPtdbTugUrl(
  sample: PtdbTugSampleDefinition,
  source: "MIC" | "REF"
) {
  const prefix = source === "MIC" ? "mic" : "ref";
  const extension = source === "MIC" ? "wav" : "f0";

  return `${ptdbTugBaseUrl}/${sample.gender}/${source}/${sample.speaker}/${prefix}_${sample.speaker}_${sample.utterance}.${extension}`;
}

async function readPtdbTugReferenceF0(
  refPath: string
): Promise<PitchBenchmarkSeries> {
  const source = await readFile(refPath, "utf8");
  const rows = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    label: "Validated PTDB-TUG F0",
    sampleIntervalMs: referenceSampleIntervalMs,
    timestampsMs: rows.map((_, index) => index * referenceSampleIntervalMs),
    values: rows.map((line) => {
      const [f0, voicingDecision] = line.split(/\s+/u);
      const value = Number.parseFloat(f0 ?? "0");
      const voiced = Number.parseFloat(voicingDecision ?? "0");

      return Number.isFinite(value) && value > 0 && voiced > 0.5
        ? Math.round(value * 10) / 10
        : 0;
    })
  };
}

async function extractPitchGraphs(
  audioPath: string
): Promise<ExternalPitchExtractorOutput> {
  const { stdout } = await execFileAsync(
    "uv",
    [
      "run",
      "--python",
      "3.12",
      "--with",
      "numpy",
      "--with",
      "scipy",
      "--with",
      "librosa",
      "--with",
      "pyworld",
      "--with",
      "praat-parselmouth",
      "--with",
      "swift-f0[audio]",
      "--with",
      "setuptools<80",
      "python",
      path.join(process.cwd(), "scripts", "extract-pitch-graph-bakeoff.py"),
      "--audio",
      audioPath,
      "--sample-rate",
      "16000",
      "--hop-ms",
      String(referenceSampleIntervalMs)
    ],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024
    }
  );

  return JSON.parse(stdout) as ExternalPitchExtractorOutput;
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

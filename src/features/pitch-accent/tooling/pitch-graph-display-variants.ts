import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  buildExpectedAccentMoraLevels,
  type PitchAccentMinimalPair,
  type PitchAccentMinimalPairsCorpus,
  type PitchAccentPairOption
} from "../model/index.ts";
import {
  mapWithConcurrency,
  readPitchAccentCorpusManifest,
  resolvePublicAudioPath
} from "./pitch-graph-generator.ts";

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

type DisplayVariantKind =
  | "base"
  | "continuous"
  | "ideas1to5"
  | "overlay"
  | "theoryShaped";

export type GeneratePitchGraphDisplayVariantReportInput = {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly manifestPath: string;
  readonly outDir: string;
  readonly publicDir?: string;
  readonly requiredAudioSrcPrefix?: string;
  readonly sampleRate?: number;
};

export type GeneratePitchGraphDisplayVariantReportResult = {
  readonly auditPath: string;
  readonly htmlPath: string;
  readonly pairCount: number;
  readonly targetCount: number;
};

export type PedagogicalPitchDisplayResult = {
  readonly bridgedGapMaxMs: number;
  readonly continuousDomain: DisplayPitchDomain;
  readonly continuousValues: readonly number[];
  readonly domain: DisplayPitchDomain;
  readonly medianHz: number;
  readonly smoothingWindowMs: number;
  readonly values: readonly (number | null)[];
};

export type TheoryShapedPitchDisplayResult = {
  readonly acousticResidualScale: number;
  readonly domain: DisplayPitchDomain;
  readonly theoryWeight: number;
  readonly values: readonly number[];
};

type DisplayVariantPair = {
  readonly id: string;
  readonly kana: string;
  readonly patternKeys: readonly string[];
  readonly targets: readonly DisplayVariantTarget[];
};

type DisplayVariantTarget = {
  readonly audioHref: string;
  readonly audioSrc: string;
  readonly columns: readonly DisplayVariantColumn[];
  readonly durationMs: number;
  readonly option: PitchAccentPairOption;
};

type DisplayVariantColumn = {
  readonly domain: DisplayPitchDomain | null;
  readonly kind: DisplayVariantKind;
  readonly sampleIntervalMs: number;
  readonly summary: string;
  readonly timestampsMs?: readonly number[];
  readonly title: string;
  readonly unit: "Hz" | "cents";
  readonly values: readonly (number | null)[];
};

type DisplayPitchDomain = {
  readonly max: number;
  readonly min: number;
  readonly ticks: readonly number[];
};

const defaultSampleRate = 16_000;
const displayVariantLabels = {
  base: "SwiftF0 voiced-gated smoothed",
  continuous: "1-5 continuous interpolation",
  ideas1to5: "1-5 display curve",
  overlay: "1-5 + expected overlay",
  theoryShaped: "theory-shaped continuous + playhead"
} as const satisfies Record<DisplayVariantKind, string>;
const execFileAsync = promisify(execFile);
const coveredPitchAccents = [0, 1, 2, 3, 4] as const;

export async function generatePitchGraphDisplayVariantReport(
  input: GeneratePitchGraphDisplayVariantReportInput
): Promise<GeneratePitchGraphDisplayVariantReportResult> {
  const publicDir = path.resolve(input.publicDir ?? "public");
  const outDir = path.resolve(input.outDir);
  const corpus = await readPitchAccentCorpusManifest(input.manifestPath, {
    requiredAudioSrcPrefix: input.requiredAudioSrcPrefix
  });
  const pairs = selectDisplayVariantPairs(corpus, input.limit ?? 10);
  const targets = pairs.flatMap((pair) =>
    pair.options.map((option) => ({ option, pair }))
  );
  const renderedTargets = await mapWithConcurrency(
    targets,
    input.concurrency ?? 3,
    async ({ option, pair }) => {
      const audioPath = resolvePublicAudioPath(publicDir, option.audioSrc);
      const extractorOutput = await extractSwiftF0(audioPath, {
        sampleRate: input.sampleRate ?? defaultSampleRate
      });
      const swiftOutput = extractorOutput.extractors.swiftF0Smoothed;

      if (!swiftOutput) {
        throw new Error(
          `SwiftF0 smoothed output missing for ${option.audioSrc}: ${
            extractorOutput.errors?.swiftF0Smoothed ?? "unknown error"
          }`
        );
      }

      return {
        audioHref: buildReportAudioHref({
          audioSrc: option.audioSrc,
          outDir,
          publicDir
        }),
        audioSrc: option.audioSrc,
        columns: buildDisplayVariantColumns({
          durationMs: extractorOutput.durationMs,
          option,
          rawValues: swiftOutput.rawValues,
          sampleIntervalMs:
            swiftOutput.sampleIntervalMs ?? extractorOutput.sampleIntervalMs,
          timestampsMs: swiftOutput.timestampsMs
        }),
        durationMs: extractorOutput.durationMs,
        option,
        pairId: pair.id
      };
    }
  );
  const targetsByPairId = new Map<string, DisplayVariantTarget[]>();

  for (const target of renderedTargets) {
    const group = targetsByPairId.get(target.pairId) ?? [];
    group.push(target);
    targetsByPairId.set(target.pairId, group);
  }

  const reportPairs: DisplayVariantPair[] = pairs.map((pair) => ({
    id: pair.id,
    kana: pair.kana,
    patternKeys: collectPairPitchAccents(pair).map(
      (pitchAccent) => `pitch${pitchAccent}`
    ),
    targets: targetsByPairId.get(pair.id) ?? []
  }));
  const audit = {
    generatedAt: new Date().toISOString(),
    pairCount: reportPairs.length,
    pairs: reportPairs,
    source: {
      manifestPath: input.manifestPath,
      repository: corpus.source.repository
    },
    targetCount: renderedTargets.length
  };
  const auditPath = path.join(outDir, "audit.json");
  const htmlPath = path.join(outDir, "report.html");

  await mkdir(outDir, { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(
    htmlPath,
    renderDisplayVariantReportHtml({
      generatedAt: audit.generatedAt,
      pairs: reportPairs
    })
  );

  return {
    auditPath,
    htmlPath,
    pairCount: reportPairs.length,
    targetCount: renderedTargets.length
  };
}

export function selectDisplayVariantPairs(
  corpus: PitchAccentMinimalPairsCorpus,
  limit: number
): readonly PitchAccentMinimalPair[] {
  const normalizedLimit = Math.max(10, Math.floor(limit));
  const remainingCoverage = new Map<number, number>(
    coveredPitchAccents.map((pitchAccent) => [pitchAccent, 2])
  );
  const selected = new Map<string, PitchAccentMinimalPair>();

  while (
    selected.size < normalizedLimit ||
    coveredPitchAccents.some(
      (pitchAccent) => (remainingCoverage.get(pitchAccent) ?? 0) > 0
    )
  ) {
    let bestPair: PitchAccentMinimalPair | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const pair of corpus.pairs) {
      if (selected.has(pair.id)) {
        continue;
      }

      const score = scoreDisplayVariantPair(pair, remainingCoverage);

      if (score > bestScore) {
        bestPair = pair;
        bestScore = score;
      }
    }

    if (!bestPair) {
      break;
    }

    selected.set(bestPair.id, bestPair);
    for (const pitchAccent of collectPairPitchAccents(bestPair)) {
      remainingCoverage.set(
        pitchAccent,
        Math.max(0, (remainingCoverage.get(pitchAccent) ?? 0) - 1)
      );
    }
  }

  return [...selected.values()];
}

export function buildPedagogicalPitchDisplay(input: {
  readonly rawValues: readonly number[];
  readonly sampleIntervalMs: number;
}): PedagogicalPitchDisplayResult {
  const sampleIntervalMs = Math.max(1, Math.round(input.sampleIntervalMs));
  const bridgedGapMaxMs = 80;
  const smoothingWindowMs = 56;
  const rawHzValues = input.rawValues.map((value) =>
    Number.isFinite(value) && value > 0 ? roundNumber(value, 1) : null
  );
  const bridgedHzValues = interpolateShortNullGaps(
    rawHzValues,
    Math.max(1, Math.round(bridgedGapMaxMs / sampleIntervalMs))
  );
  const medianHz = quantile(bridgedHzValues.filter(isFiniteNumber), 0.5);

  if (!Number.isFinite(medianHz) || medianHz <= 0) {
    return {
      bridgedGapMaxMs,
      continuousDomain: { max: 100, min: -100, ticks: [100, 0, -100] },
      continuousValues: rawHzValues.map(() => 0),
      domain: { max: 100, min: -100, ticks: [100, 0, -100] },
      medianHz: 0,
      smoothingWindowMs,
      values: rawHzValues.map(() => null)
    };
  }

  const centsValues = bridgedHzValues.map((value) =>
    isFiniteNumber(value)
      ? roundNumber(1200 * Math.log2(value / medianHz), 1)
      : null
  );
  const initialDomain = buildCentsDomain(centsValues);
  const clampedValues = centsValues.map((value) =>
    isFiniteNumber(value)
      ? roundNumber(clampNumber(value, initialDomain.min, initialDomain.max), 1)
      : null
  );
  const smoothingRadius = Math.max(
    1,
    Math.round(smoothingWindowMs / sampleIntervalMs / 2)
  );
  const values = smoothContiguousSegments(clampedValues, smoothingRadius);
  const continuousValues = smoothContinuousValues(
    interpolateAllNullGaps(clampedValues),
    smoothingRadius
  );
  const domain = buildCentsDomain(values);
  const continuousDomain = buildCentsDomain(continuousValues);

  return {
    bridgedGapMaxMs,
    continuousDomain,
    continuousValues,
    domain,
    medianHz: roundNumber(medianHz, 1),
    smoothingWindowMs,
    values
  };
}

export function buildTheoryShapedContinuousPitchDisplay(input: {
  readonly continuousValues: readonly number[];
  readonly moraCount: number;
  readonly pitchAccent: number;
}): TheoryShapedPitchDisplayResult {
  const theoryWeight = 0.72;
  const acousticResidualScale = 0.28;
  const theoreticalValues = buildTheoreticalContinuousValues({
    moraCount: input.moraCount,
    pitchAccent: input.pitchAccent,
    sampleCount: input.continuousValues.length
  });
  const acousticValues = normalizeAcousticResidual(input.continuousValues);
  const values = theoreticalValues.map((theoreticalValue, index) =>
    roundNumber(
      theoreticalValue * theoryWeight +
        (acousticValues[index] ?? 0) * acousticResidualScale,
      1
    )
  );

  return {
    acousticResidualScale,
    domain: buildDomain(-190, 190, 0),
    theoryWeight,
    values
  };
}

function scoreDisplayVariantPair(
  pair: PitchAccentMinimalPair,
  remainingCoverage: ReadonlyMap<number, number>
) {
  const pitchAccents = collectPairPitchAccents(pair);
  let score = pair.optionCount;

  for (const pitchAccent of pitchAccents) {
    score += (remainingCoverage.get(pitchAccent) ?? 0) * 10;

    if (pitchAccent === 4) {
      score += 3;
    } else if (pitchAccent === 3) {
      score += 2;
    }
  }

  if (pair.hasDevoiced) {
    score -= 2;
  }

  return score;
}

function collectPairPitchAccents(pair: PitchAccentMinimalPair) {
  return [
    ...new Set(
      pair.options
        .map((option) => option.pitchAccent)
        .filter((pitchAccent) =>
          (coveredPitchAccents as readonly number[]).includes(pitchAccent)
        )
    )
  ];
}

function buildDisplayVariantColumns(input: {
  readonly durationMs: number;
  readonly option: PitchAccentPairOption;
  readonly rawValues: readonly number[];
  readonly sampleIntervalMs: number;
  readonly timestampsMs?: readonly number[];
}): readonly DisplayVariantColumn[] {
  const baseValues = input.rawValues.map((value) =>
    Number.isFinite(value) && value > 0 ? roundNumber(value, 1) : null
  );
  const display = buildPedagogicalPitchDisplay({
    rawValues: input.rawValues,
    sampleIntervalMs: input.sampleIntervalMs
  });
  const theoryShapedDisplay = buildTheoryShapedContinuousPitchDisplay({
    continuousValues: display.continuousValues,
    moraCount: input.option.moraCount,
    pitchAccent: input.option.pitchAccent
  });

  return [
    {
      domain: buildHzDomain(baseValues),
      kind: "base",
      sampleIntervalMs: input.sampleIntervalMs,
      summary:
        "Extractor output: SwiftF0 voiced-gated smoothed, in Hz, with unvoiced gaps preserved.",
      timestampsMs: input.timestampsMs,
      title: displayVariantLabels.base,
      unit: "Hz",
      values: baseValues
    },
    {
      domain: display.domain,
      kind: "ideas1to5",
      sampleIntervalMs: input.sampleIntervalMs,
      summary: `Micro-gap bridge <= ${display.bridgedGapMaxMs}ms, log scale relative to median ${display.medianHz}Hz, robust axis, then ${display.smoothingWindowMs}ms smoothing.`,
      timestampsMs: input.timestampsMs,
      title: displayVariantLabels.ideas1to5,
      unit: "cents",
      values: display.values
    },
    {
      domain: display.domain,
      kind: "overlay",
      sampleIntervalMs: input.sampleIntervalMs,
      summary:
        "Same display curve plus a theoretical mora-level pitch accent overlay.",
      timestampsMs: input.timestampsMs,
      title: displayVariantLabels.overlay,
      unit: "cents",
      values: display.values
    },
    {
      domain: display.continuousDomain,
      kind: "continuous",
      sampleIntervalMs: input.sampleIntervalMs,
      summary:
        "Same display transform, but every gap is linearly interpolated in cents; leading/trailing gaps hold the nearest voiced value.",
      timestampsMs: input.timestampsMs,
      title: displayVariantLabels.continuous,
      unit: "cents",
      values: display.continuousValues
    },
    {
      domain: theoryShapedDisplay.domain,
      kind: "theoryShaped",
      sampleIntervalMs: input.sampleIntervalMs,
      summary: `Continuous curve re-scaled toward the theoretical accent skeleton: ${Math.round(
        theoryShapedDisplay.theoryWeight * 100
      )}% theory, ${Math.round(
        theoryShapedDisplay.acousticResidualScale * 100
      )}% acoustic residual, fixed didactic axis.`,
      timestampsMs: input.timestampsMs,
      title: displayVariantLabels.theoryShaped,
      unit: "cents",
      values: theoryShapedDisplay.values
    }
  ];
}

async function extractSwiftF0(
  audioPath: string,
  input: { readonly sampleRate: number }
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
      String(input.sampleRate),
      "--only-swift-f0"
    ],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    }
  );

  return JSON.parse(stdout) as ExternalPitchExtractorOutput;
}

function interpolateShortNullGaps(
  values: readonly (number | null)[],
  maxGapFrames: number
) {
  const output = values.slice();
  let index = 0;

  while (index < output.length) {
    if (isFiniteNumber(output[index])) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < output.length && !isFiniteNumber(output[index])) {
      index += 1;
    }

    const end = index;
    const gapLength = end - start;
    const previous = output[start - 1];
    const next = output[end];

    if (
      gapLength <= maxGapFrames &&
      isFiniteNumber(previous) &&
      isFiniteNumber(next)
    ) {
      for (let gapIndex = start; gapIndex < end; gapIndex += 1) {
        const progress = (gapIndex - start + 1) / (gapLength + 1);
        output[gapIndex] = roundNumber(
          previous + (next - previous) * progress,
          1
        );
      }
    }
  }

  return output;
}

function interpolateAllNullGaps(values: readonly (number | null)[]) {
  const output = values.slice();
  const voicedIndexes = output
    .map((value, index) => (isFiniteNumber(value) ? index : -1))
    .filter((index) => index >= 0);

  if (voicedIndexes.length === 0) {
    return output.map(() => 0);
  }

  const firstVoicedIndex = voicedIndexes[0]!;
  const lastVoicedIndex = voicedIndexes[voicedIndexes.length - 1]!;

  for (let index = 0; index < firstVoicedIndex; index += 1) {
    output[index] = output[firstVoicedIndex]!;
  }
  for (let index = lastVoicedIndex + 1; index < output.length; index += 1) {
    output[index] = output[lastVoicedIndex]!;
  }

  let index = firstVoicedIndex;
  while (index <= lastVoicedIndex) {
    if (isFiniteNumber(output[index])) {
      index += 1;
      continue;
    }

    const start = index;
    while (index <= lastVoicedIndex && !isFiniteNumber(output[index])) {
      index += 1;
    }

    const end = index;
    const previous = output[start - 1];
    const next = output[end];

    if (isFiniteNumber(previous) && isFiniteNumber(next)) {
      const gapLength = end - start;

      for (let gapIndex = start; gapIndex < end; gapIndex += 1) {
        const progress = (gapIndex - start + 1) / (gapLength + 1);
        output[gapIndex] = roundNumber(
          previous + (next - previous) * progress,
          1
        );
      }
    }
  }

  return output.map((value) => (isFiniteNumber(value) ? value : 0));
}

function buildTheoreticalContinuousValues(input: {
  readonly moraCount: number;
  readonly pitchAccent: number;
  readonly sampleCount: number;
}) {
  const levels = buildExpectedAccentMoraLevels({
    moraCount: input.moraCount,
    pitchAccent: input.pitchAccent
  });

  if (levels.length === 0 || input.sampleCount <= 0) {
    return Array.from({ length: Math.max(0, input.sampleCount) }, () => 0);
  }

  const low = -125;
  const high = 125;
  const rawValues = Array.from({ length: input.sampleCount }, (_, index) => {
    const moraIndex = Math.min(
      levels.length - 1,
      Math.floor((index / Math.max(input.sampleCount, 1)) * levels.length)
    );

    return levels[moraIndex] === 1 ? high : low;
  });

  return smoothContinuousValues(
    rawValues,
    Math.max(1, Math.round(input.sampleCount / Math.max(levels.length * 8, 1)))
  );
}

function normalizeAcousticResidual(values: readonly number[]) {
  if (values.length === 0) {
    return [];
  }

  const low = quantile(values, 0.08);
  const high = quantile(values, 0.92);
  const center = quantile(values, 0.5);
  const range = Math.max(high - low, 80);

  return values.map((value) =>
    roundNumber(clampNumber(((value - center) / range) * 150, -90, 90), 1)
  );
}

function smoothContiguousSegments(
  values: readonly (number | null)[],
  radius: number
) {
  const output = values.slice();
  let index = 0;

  while (index < values.length) {
    if (!isFiniteNumber(values[index])) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < values.length && isFiniteNumber(values[index])) {
      index += 1;
    }

    const segment = values.slice(start, index) as number[];
    const smoothed = segment.map((_, segmentIndex) => {
      let total = 0;
      let count = 0;

      for (
        let candidateIndex = Math.max(0, segmentIndex - radius);
        candidateIndex <= Math.min(segment.length - 1, segmentIndex + radius);
        candidateIndex += 1
      ) {
        total += segment[candidateIndex]!;
        count += 1;
      }

      return roundNumber(total / count, 1);
    });

    for (
      let segmentIndex = 0;
      segmentIndex < smoothed.length;
      segmentIndex += 1
    ) {
      output[start + segmentIndex] = smoothed[segmentIndex]!;
    }
  }

  return output;
}

function smoothContinuousValues(values: readonly number[], radius: number) {
  return values.map((_, index) => {
    let total = 0;
    let count = 0;

    for (
      let candidateIndex = Math.max(0, index - radius);
      candidateIndex <= Math.min(values.length - 1, index + radius);
      candidateIndex += 1
    ) {
      total += values[candidateIndex]!;
      count += 1;
    }

    return roundNumber(total / count, 1);
  });
}

function buildHzDomain(values: readonly (number | null)[]) {
  const finiteValues = values.filter(isFiniteNumber);

  if (finiteValues.length === 0) {
    return null;
  }

  const low = quantile(finiteValues, 0.06);
  const high = quantile(finiteValues, 0.94);
  const range = Math.max(high - low, 1);
  const min = Math.max(40, low - Math.max(12, range * 0.25));
  const max = high + Math.max(12, range * 0.25);

  return buildDomain(min, max, 1);
}

function buildCentsDomain(values: readonly (number | null)[]) {
  const finiteValues = values.filter(isFiniteNumber);

  if (finiteValues.length === 0) {
    return buildDomain(-100, 100, 0);
  }

  const low = quantile(finiteValues, 0.1);
  const high = quantile(finiteValues, 0.9);
  const range = Math.max(high - low, 120);
  const center = (low + high) / 2;
  const halfRange = Math.max(140, range * 0.65);
  const min = Math.min(-40, center - halfRange);
  const max = Math.max(40, center + halfRange);

  return buildDomain(min, max, 0);
}

function buildDomain(min: number, max: number, precision: number) {
  const safeMin = Number.isFinite(min) ? min : -100;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 200;
  const middle = (safeMin + safeMax) / 2;

  return {
    max: roundNumber(safeMax, precision),
    min: roundNumber(safeMin, precision),
    ticks: [
      roundNumber(safeMax, precision),
      roundNumber(middle, precision),
      roundNumber(safeMin, precision)
    ]
  };
}

function renderDisplayVariantReportHtml(input: {
  readonly generatedAt: string;
  readonly pairs: readonly DisplayVariantPair[];
}) {
  const targetCount = input.pairs.reduce(
    (total, pair) => total + pair.targets.length,
    0
  );
  const coverage = summarizePatternCoverage(input.pairs);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SwiftF0 Display Variant Benchmark</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      padding: 24px;
      background: #191b1f;
      color: #f6efe6;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1, h2, h3, h4, p { margin: 0; }
    h1 { font-size: 28px; line-height: 1.15; }
    .lead { margin-top: 8px; max-width: 980px; color: #b6aea4; line-height: 1.5; }
    .pair {
      margin-top: 26px;
      padding: 22px;
      border: 1px solid rgba(255, 250, 242, 0.16);
      border-radius: 10px;
      background: #222426;
    }
    .pair > h2 { font-size: 22px; }
    .pair-meta { margin-top: 6px; color: #b6aea4; }
    .target {
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 250, 242, 0.12);
    }
    .target h3 { font-size: 18px; }
    .target-meta { margin-top: 5px; color: #b6aea4; font-size: 13px; }
    audio {
      width: min(100%, 520px);
      margin-top: 12px;
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 500px), 1fr));
      gap: 18px;
      margin-top: 16px;
    }
    .column {
      min-width: 0;
      padding: 16px;
      border: 1px solid rgba(255, 250, 242, 0.14);
      border-radius: 8px;
      background: #1b1d1f;
    }
    .column h4 {
      font-size: 14px;
      line-height: 1.3;
    }
    .status {
      margin-top: 8px;
      color: #b6aea4;
      font-size: 13px;
      line-height: 1.45;
    }
    svg {
      width: 100%;
      height: auto;
      margin-top: 10px;
      overflow: visible;
    }
    .grid-line {
      stroke: rgba(255, 250, 242, 0.14);
      stroke-dasharray: 4 6;
    }
    .mora-guide {
      stroke: rgba(255, 250, 242, 0.12);
      stroke-dasharray: 3 7;
    }
    .axis {
      fill: rgba(255, 250, 242, 0.58);
      font-size: 10px;
      text-anchor: middle;
    }
    .pitch {
      fill: none;
      stroke: #d19848;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3;
    }
    .overlay {
      fill: none;
      stroke: #7dc45a;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2.4;
      stroke-dasharray: 8 6;
    }
    .playhead {
      stroke: #ff6868;
      stroke-linecap: round;
      stroke-width: 2.8;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 9px;
      color: #b6aea4;
      font-size: 13px;
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 50%;
      vertical-align: -1px;
    }
    .pitch-swatch { background: #d19848; }
    .overlay-swatch { background: #7dc45a; }
  </style>
</head>
<body>
  <h1>SwiftF0 Display Variant Benchmark</h1>
  <p class="lead">Confronto didattico su ${input.pairs.length} pair (${targetCount} audio): base SwiftF0 voiced-gated smoothed, display 1-5, display + overlay teorico, display continuo interpolato, display continuo theory-shaped con playhead.</p>
  <p class="lead">Copertura pitch selezionata: ${escapeHtml(coverage)}. Generato: ${escapeHtml(input.generatedAt)}.</p>
  ${input.pairs.map(renderDisplayVariantPairHtml).join("\n")}
  ${renderPlayheadScript()}
</body>
</html>
`;
}

function renderDisplayVariantPairHtml(pair: DisplayVariantPair) {
  return `<section class="pair">
  <h2>${escapeHtml(pair.kana)}</h2>
  <p class="pair-meta">pair ${escapeHtml(pair.id)} · accents ${escapeHtml(pair.patternKeys.join(", "))}</p>
  ${pair.targets.map((target) => renderDisplayVariantTargetHtml(pair, target)).join("\n")}
</section>`;
}

function renderDisplayVariantTargetHtml(
  pair: DisplayVariantPair,
  target: DisplayVariantTarget
) {
  return `<article class="target">
  <h3>${escapeHtml(target.option.rawPronunciation)} pitch ${target.option.pitchAccent}</h3>
  <p class="target-meta">${escapeHtml(target.option.id)} · morae ${target.option.moraCount} · ${escapeHtml(target.audioSrc)} · ${target.durationMs}ms</p>
  <audio controls preload="metadata" data-pitch-audio-key="${escapeHtml(target.option.id)}" src="${escapeHtml(target.audioHref)}"></audio>
  <div class="grid">
    ${target.columns
      .map((column) => renderDisplayVariantColumnHtml(pair, target, column))
      .join("\n")}
  </div>
</article>`;
}

function renderDisplayVariantColumnHtml(
  pair: DisplayVariantPair,
  target: DisplayVariantTarget,
  column: DisplayVariantColumn
) {
  return `<article class="column">
  <h4>${escapeHtml(column.title)}</h4>
  ${renderDisplayVariantSvg(pair, target, column)}
  ${renderDisplayVariantLegend(column)}
  <p class="status">${escapeHtml(column.summary)}</p>
</article>`;
}

function renderDisplayVariantSvg(
  pair: DisplayVariantPair,
  target: DisplayVariantTarget,
  column: DisplayVariantColumn
) {
  if (!column.domain) {
    return `<p class="status">Pitch graph non disponibile.</p>`;
  }

  const domain = column.domain;
  const bounds = {
    bottom: 214,
    left: 60,
    right: 612,
    top: 18
  };
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const durationMs = Math.max(target.durationMs, getSeriesDurationMs(column));
  const range = Math.max(domain.max - domain.min, 1);
  const valueToY = (value: number) =>
    bounds.bottom - ((value - domain.min) / range) * height;
  const progressToX = (progress: number) =>
    bounds.left + clampNumber(progress, 0, 1) * width;
  const pitchPaths = seriesToSvgPaths({
    bounds,
    durationMs,
    series: column,
    valueToY
  });
  const overlayPath =
    column.kind === "overlay"
      ? renderExpectedOverlayPath({
          bounds,
          moraCount: target.option.moraCount,
          pitchAccent: target.option.pitchAccent,
          progressToX
        })
      : "";
  const playhead =
    column.kind === "theoryShaped"
      ? renderPlayhead({
          bounds,
          key: target.option.id
        })
      : "";

  return `<svg viewBox="0 0 640 252" role="img" aria-label="${escapeHtml(
    pair.kana
  )} ${escapeHtml(target.option.rawPronunciation)} ${escapeHtml(column.title)}">
  ${domain.ticks
    .map((tick) => {
      const y = roundNumber(valueToY(tick), 2);

      return `<line class="grid-line" x1="${bounds.left}" x2="${bounds.right}" y1="${y}" y2="${y}" />`;
    })
    .join("\n")}
  ${renderMoraGuides({ bounds, moraCount: target.option.moraCount, progressToX })}
  ${domain.ticks
    .map(
      (tick) =>
        `<text class="axis" x="${bounds.left - 22}" y="${roundNumber(
          valueToY(tick) + 4,
          2
        )}">${formatAxisTick(tick, column.unit)}</text>`
    )
    .join("\n")}
  ${pitchPaths.map((path) => `<path class="pitch" d="${path}" />`).join("\n")}
  ${overlayPath}
  ${playhead}
</svg>`;
}

function renderDisplayVariantLegend(column: DisplayVariantColumn) {
  const items = [`<span><span class="swatch pitch-swatch"></span>F0</span>`];

  if (column.kind === "overlay") {
    items.push(
      `<span><span class="swatch overlay-swatch"></span>expected</span>`
    );
  }

  return `<div class="legend">${items.join("\n")}</div>`;
}

function renderMoraGuides(input: {
  readonly bounds: { readonly bottom: number; readonly top: number };
  readonly moraCount: number;
  readonly progressToX: (progress: number) => number;
}) {
  if (input.moraCount <= 1) {
    return "";
  }

  return Array.from({ length: input.moraCount - 1 }, (_, index) => {
    const progress = (index + 1) / input.moraCount;
    const x = roundNumber(input.progressToX(progress), 2);

    return `<line class="mora-guide" x1="${x}" x2="${x}" y1="${input.bounds.top}" y2="${input.bounds.bottom}" />`;
  }).join("\n");
}

function renderExpectedOverlayPath(input: {
  readonly bounds: { readonly bottom: number; readonly top: number };
  readonly moraCount: number;
  readonly pitchAccent: number;
  readonly progressToX: (progress: number) => number;
}) {
  const levels = buildExpectedAccentMoraLevels({
    moraCount: input.moraCount,
    pitchAccent: input.pitchAccent
  });

  if (levels.length === 0) {
    return "";
  }

  const highY =
    input.bounds.top + (input.bounds.bottom - input.bounds.top) * 0.18;
  const lowY =
    input.bounds.top + (input.bounds.bottom - input.bounds.top) * 0.62;
  let path = "";

  levels.forEach((level, index) => {
    const x1 = roundNumber(input.progressToX(index / levels.length), 2);
    const x2 = roundNumber(input.progressToX((index + 1) / levels.length), 2);
    const y = roundNumber(level === 1 ? highY : lowY, 2);
    const nextLevel = levels[index + 1];

    path = path ? `${path} L ${x1} ${y}` : `M ${x1} ${y}`;
    path = `${path} L ${x2} ${y}`;

    if (nextLevel !== undefined && nextLevel !== level) {
      path = `${path} L ${x2} ${roundNumber(nextLevel === 1 ? highY : lowY, 2)}`;
    }
  });

  return `<path class="overlay" d="${path}" />`;
}

function renderPlayhead(input: {
  readonly bounds: {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  };
  readonly key: string;
}) {
  return `<line class="playhead" data-playhead-key="${escapeHtml(input.key)}" data-left="${input.bounds.left}" data-right="${input.bounds.right}" x1="${input.bounds.left}" x2="${input.bounds.left}" y1="${input.bounds.top}" y2="${input.bounds.bottom}" />`;
}

function renderPlayheadScript() {
  return `<script>
(() => {
  const frameByAudio = new WeakMap();
  const clamp = (value) => Math.min(1, Math.max(0, value));
  const getPlayheads = (audio) => {
    const key = audio.getAttribute("data-pitch-audio-key");
    return Array.from(document.querySelectorAll(".playhead")).filter((line) => line.getAttribute("data-playhead-key") === key);
  };
  const updatePlayheads = (audio) => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const progress = duration > 0 ? clamp(audio.currentTime / duration) : 0;
    for (const line of getPlayheads(audio)) {
      const left = Number.parseFloat(line.getAttribute("data-left") || "60");
      const right = Number.parseFloat(line.getAttribute("data-right") || "612");
      const x = left + (right - left) * progress;
      line.setAttribute("x1", x.toFixed(2));
      line.setAttribute("x2", x.toFixed(2));
    }
  };
  const startLoop = (audio) => {
    const previousFrame = frameByAudio.get(audio);
    if (previousFrame) window.cancelAnimationFrame(previousFrame);
    const tick = () => {
      updatePlayheads(audio);
      if (!audio.paused && !audio.ended) {
        frameByAudio.set(audio, window.requestAnimationFrame(tick));
      }
    };
    frameByAudio.set(audio, window.requestAnimationFrame(tick));
  };
  for (const audio of document.querySelectorAll("audio[data-pitch-audio-key]")) {
    audio.addEventListener("loadedmetadata", () => updatePlayheads(audio));
    audio.addEventListener("timeupdate", () => updatePlayheads(audio));
    audio.addEventListener("seeked", () => updatePlayheads(audio));
    audio.addEventListener("play", () => startLoop(audio));
    audio.addEventListener("pause", () => updatePlayheads(audio));
    audio.addEventListener("ended", () => updatePlayheads(audio));
    updatePlayheads(audio);
  }
})();
</script>`;
}

function seriesToSvgPaths(input: {
  readonly bounds: { readonly left: number; readonly right: number };
  readonly durationMs: number;
  readonly series: Pick<
    DisplayVariantColumn,
    "sampleIntervalMs" | "timestampsMs" | "values"
  >;
  readonly valueToY: (value: number) => number;
}) {
  const paths: string[] = [];
  let currentPath = "";

  input.series.values.forEach((value, index) => {
    if (!isFiniteNumber(value)) {
      if (currentPath) {
        paths.push(currentPath);
        currentPath = "";
      }
      return;
    }

    const timeMs = getSeriesTimeMs(input.series, index);
    const x = roundNumber(
      input.bounds.left +
        (timeMs / Math.max(input.durationMs, 1)) *
          (input.bounds.right - input.bounds.left),
      2
    );
    const y = roundNumber(input.valueToY(value), 2);
    currentPath = currentPath ? `${currentPath} L ${x} ${y}` : `M ${x} ${y}`;
  });

  if (currentPath) {
    paths.push(currentPath);
  }

  return paths;
}

function getSeriesTimeMs(
  series: Pick<
    DisplayVariantColumn,
    "sampleIntervalMs" | "timestampsMs" | "values"
  >,
  index: number
) {
  return series.timestampsMs?.length === series.values.length
    ? (series.timestampsMs[index] ?? index * series.sampleIntervalMs)
    : index * series.sampleIntervalMs;
}

function getSeriesDurationMs(
  series: Pick<
    DisplayVariantColumn,
    "sampleIntervalMs" | "timestampsMs" | "values"
  >
) {
  if (series.timestampsMs?.length !== series.values.length) {
    return series.values.length * series.sampleIntervalMs;
  }

  const lastTimestamp =
    series.timestampsMs[series.timestampsMs.length - 1] ?? 0;

  return lastTimestamp + series.sampleIntervalMs;
}

function summarizePatternCoverage(pairs: readonly DisplayVariantPair[]) {
  const coverage = new Map<number, number>();

  for (const pair of pairs) {
    for (const target of pair.targets) {
      coverage.set(
        target.option.pitchAccent,
        (coverage.get(target.option.pitchAccent) ?? 0) + 1
      );
    }
  }

  return coveredPitchAccents
    .map(
      (pitchAccent) => `pitch${pitchAccent}: ${coverage.get(pitchAccent) ?? 0}`
    )
    .join(" · ");
}

function buildReportAudioHref(input: {
  readonly audioSrc: string;
  readonly outDir: string;
  readonly publicDir: string;
}) {
  const audioPath = path.join(input.publicDir, input.audioSrc.slice(1));
  const relativePath = path.relative(input.outDir, audioPath);

  return relativePath.split(path.sep).join("/");
}

function formatAxisTick(value: number, unit: "Hz" | "cents") {
  return unit === "Hz" ? value.toFixed(1) : `${Math.round(value)}`;
}

function quantile(values: readonly number[], q: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * clampNumber(q, 0, 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower] ?? 0;
  }

  const progress = index - lower;

  return (
    (sorted[lower] ?? 0) * (1 - progress) + (sorted[upper] ?? 0) * progress
  );
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundNumber(value: number, fractionDigits: number) {
  return Number.parseFloat(value.toFixed(fractionDigits));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

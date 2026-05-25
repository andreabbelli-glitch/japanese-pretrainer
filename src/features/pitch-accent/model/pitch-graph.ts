import type {
  PitchAccentAudioPitchGraph,
  PitchAccentExpectedAccentOverlay,
  PitchAccentPitchGraphExtractor,
  PitchAccentPitchGraphManifest
} from "../types";

export type PitchGraphV2BuildInput = {
  readonly durationMs: number;
  readonly extractor: PitchAccentPitchGraphExtractor;
  readonly moraCount?: number;
  readonly pitchAccent?: number;
  readonly rawValues: readonly (number | null)[];
  readonly sampleIntervalMs: number;
  readonly strategy?: "local-improved" | "local-kotu-like";
};

export type PitchGraphDisplayDomain = {
  readonly maxYValue: number;
  readonly minYValue: number;
  readonly ticks: readonly number[];
};

export type PitchGraphEstimateOptions = {
  readonly clarityThreshold?: number;
  readonly hopMs?: number;
  readonly maxFrequencyHz?: number;
  readonly minFrequencyHz?: number;
  readonly silenceThreshold?: number;
  readonly windowMs?: number;
};

const defaultPitchGraphEstimateOptions = {
  clarityThreshold: 0.52,
  hopMs: 10,
  maxFrequencyHz: 450,
  minFrequencyHz: 70,
  silenceThreshold: 0.008,
  windowMs: 40
} as const;

const pitchGraphV2Extractors = [
  "autocorrelation-v1",
  "kotu-api",
  "praat",
  "pyin",
  "world-harvest"
] as const satisfies readonly PitchAccentPitchGraphExtractor[];

export function estimatePitchGraphFromPcm(
  samples: Float32Array,
  sampleRate: number,
  options: PitchGraphEstimateOptions = {}
): PitchAccentAudioPitchGraph {
  const normalizedOptions = {
    ...defaultPitchGraphEstimateOptions,
    ...options
  };
  const windowLength = Math.max(
    1,
    Math.round((normalizedOptions.windowMs / 1000) * sampleRate)
  );
  const hopLength = Math.max(
    1,
    Math.round((normalizedOptions.hopMs / 1000) * sampleRate)
  );
  const values: (number | null)[] = [];

  if (samples.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return {
      durationMs: 0,
      sampleIntervalMs: normalizedOptions.hopMs,
      values
    };
  }

  const maxStart = Math.max(0, samples.length - windowLength);

  for (let start = 0; start <= maxStart; start += hopLength) {
    const frame = samples.subarray(
      start,
      Math.min(start + windowLength, samples.length)
    );
    values.push(estimateFramePitch(frame, sampleRate, normalizedOptions));
  }

  if (values.length === 0) {
    values.push(null);
  }

  return {
    durationMs: Math.round((samples.length / sampleRate) * 1000),
    sampleIntervalMs: normalizedOptions.hopMs,
    values: smoothPitchValues(values)
  };
}

export function buildPitchGraphV2FromRawValues(
  input: PitchGraphV2BuildInput
): PitchAccentAudioPitchGraph {
  const rawValues = normalizeRawPitchValues(input.rawValues);
  const strategy = input.strategy ?? "local-improved";
  const values = buildDisplayPitchValues({
    rawValues,
    sampleIntervalMs: input.sampleIntervalMs,
    strategy
  });
  const expectedAccentOverlay =
    input.moraCount !== undefined && input.pitchAccent !== undefined
      ? buildExpectedPitchAccentOverlay({
          durationMs: input.durationMs,
          moraCount: input.moraCount,
          pitchAccent: input.pitchAccent,
          sampleCount: rawValues.length,
          sampleIntervalMs: input.sampleIntervalMs
        })
      : undefined;

  return {
    durationMs: Math.max(0, Math.round(input.durationMs)),
    expectedAccentOverlay,
    extractor: input.extractor,
    qualityScore: computePitchGraphQualityScore(rawValues),
    rawValues,
    renderStrategy: strategy,
    sampleIntervalMs: Math.max(1, Math.round(input.sampleIntervalMs)),
    values,
    version: 2
  };
}

export function buildExpectedAccentMoraLevels(input: {
  readonly moraCount: number;
  readonly pitchAccent: number;
}): readonly (0 | 1)[] {
  const moraCount = Math.max(0, Math.floor(input.moraCount));
  const pitchAccent = clampNumber(Math.floor(input.pitchAccent), 0, moraCount);

  return Array.from({ length: moraCount }, (_, index): 0 | 1 => {
    const moraNumber = index + 1;

    if (pitchAccent === 0) {
      return moraNumber === 1 ? 0 : 1;
    }
    if (pitchAccent === 1) {
      return moraNumber === 1 ? 1 : 0;
    }

    return moraNumber > 1 && moraNumber <= pitchAccent ? 1 : 0;
  });
}

export function buildExpectedPitchAccentOverlay(input: {
  readonly durationMs: number;
  readonly moraCount: number;
  readonly pitchAccent: number;
  readonly sampleCount?: number;
  readonly sampleIntervalMs: number;
}): PitchAccentExpectedAccentOverlay {
  const moraLevels = buildExpectedAccentMoraLevels(input);
  const sampleCount =
    input.sampleCount ??
    Math.max(1, Math.round(input.durationMs / input.sampleIntervalMs));

  return {
    sampleIntervalMs: Math.max(1, Math.round(input.sampleIntervalMs)),
    values: Array.from({ length: sampleCount }, (_, index): 0 | 1 | null => {
      if (moraLevels.length === 0) {
        return null;
      }

      const moraIndex = Math.min(
        moraLevels.length - 1,
        Math.floor((index / Math.max(sampleCount, 1)) * moraLevels.length)
      );

      return moraLevels[moraIndex] ?? null;
    })
  };
}

export function computePitchGraphDisplayDomain(
  graph: PitchAccentAudioPitchGraph | null
): PitchGraphDisplayDomain | null {
  const values = graph?.values.filter(isFinitePitchValue) ?? [];

  if (values.length === 0) {
    return null;
  }

  const low = quantile(values, graph?.version === 2 ? 0.04 : 0);
  const high = quantile(values, graph?.version === 2 ? 0.96 : 1);
  const minPitch = Math.min(Math.min(...values), low);
  const maxPitch = Math.max(Math.max(...values), high);
  const pitchRange = Math.max(maxPitch - minPitch, 1);
  const padding = Math.max(
    10,
    pitchRange * (graph?.version === 2 ? 0.14 : 0.16)
  );
  const minYValue = Math.max(0, minPitch - padding);
  const maxYValue = maxPitch + padding;
  const middleYValue = (minYValue + maxYValue) / 2;

  return {
    maxYValue,
    minYValue,
    ticks: [maxYValue, middleYValue, minYValue]
  };
}

export function validatePitchAccentPitchGraphManifest(
  manifest: PitchAccentPitchGraphManifest
) {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return {
      errors: ["Pitch graph manifest must be an object."],
      ok: false
    };
  }

  if (manifest.version !== 1 && manifest.version !== 2) {
    errors.push("Pitch graph manifest version must be 1 or 2.");
  }

  if (!manifest.graphs || typeof manifest.graphs !== "object") {
    errors.push("Pitch graph manifest must include graphs.");
  } else {
    for (const [audioSrc, graph] of Object.entries(manifest.graphs)) {
      if (!isSafePitchGraphAudioSource(audioSrc)) {
        errors.push(`${audioSrc} has an unsafe pitch graph audio source.`);
      }
      if (!graph || typeof graph !== "object") {
        errors.push(`${audioSrc} pitch graph must be an object.`);
        continue;
      }
      if (!Number.isInteger(graph.durationMs) || graph.durationMs < 0) {
        errors.push(`${audioSrc} has an invalid pitch graph duration.`);
      }
      if (
        !Number.isInteger(graph.sampleIntervalMs) ||
        graph.sampleIntervalMs <= 0
      ) {
        errors.push(`${audioSrc} has an invalid pitch graph sample interval.`);
      }
      if (!Array.isArray(graph.values)) {
        errors.push(`${audioSrc} must include pitch graph values.`);
        continue;
      }

      validatePitchValueArray(errors, audioSrc, graph.values, "pitch graph");

      if (isPitchGraphV2ManifestEntry(manifest.version, graph)) {
        validatePitchGraphV2Entry(errors, audioSrc, graph);
      }
    }
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

function buildDisplayPitchValues(input: {
  readonly rawValues: readonly (number | null)[];
  readonly sampleIntervalMs: number;
  readonly strategy: "local-improved" | "local-kotu-like";
}) {
  const voicedValues = input.rawValues.filter(isVoicedPitchValue);

  if (input.rawValues.length === 0) {
    return [];
  }
  if (voicedValues.length === 0) {
    return input.rawValues.map(() => null);
  }

  const profile = buildDisplayPitchProfile(voicedValues);
  const displayValues =
    input.strategy === "local-kotu-like"
      ? buildKotuLikeDisplayValues(input.rawValues, profile)
      : buildImprovedDisplayValues(
          input.rawValues,
          input.sampleIntervalMs,
          profile
        );

  return smoothDisplayPitchValues(
    displayValues,
    profile,
    input.strategy === "local-kotu-like" ? 1 : 2
  );
}

function buildKotuLikeDisplayValues(
  rawValues: readonly (number | null)[],
  profile: DisplayPitchProfile
) {
  return rawValues.map((value) =>
    isVoicedPitchValue(value)
      ? clampPitchToProfile(value, profile)
      : profile.baseline
  );
}

function buildImprovedDisplayValues(
  rawValues: readonly (number | null)[],
  sampleIntervalMs: number,
  profile: DisplayPitchProfile
) {
  const maxBridgeFrames = Math.max(1, Math.round(120 / sampleIntervalMs));
  const decayFrames = Math.max(1, Math.round(90 / sampleIntervalMs));

  return rawValues.map((value, index) => {
    if (isVoicedPitchValue(value)) {
      return clampPitchToProfile(value, profile);
    }

    const previous = findNearestVoiced(rawValues, index, -1);
    const next = findNearestVoiced(rawValues, index, 1);

    if (previous && next && next.index - previous.index <= maxBridgeFrames) {
      const progress = (index - previous.index) / (next.index - previous.index);

      return roundPitch(
        interpolate(
          clampPitchToProfile(previous.value, profile),
          clampPitchToProfile(next.value, profile),
          progress
        )
      );
    }

    const nearest =
      previous && next
        ? index - previous.index <= next.index - index
          ? previous
          : next
        : (previous ?? next);

    if (!nearest) {
      return profile.baseline;
    }

    const distance = Math.abs(index - nearest.index);
    const progress = easeOutCubic(clampNumber(distance / decayFrames, 0, 1));

    return roundPitch(
      interpolate(
        clampPitchToProfile(nearest.value, profile),
        profile.baseline,
        progress
      )
    );
  });
}

function smoothDisplayPitchValues(
  values: readonly (number | null)[],
  profile: DisplayPitchProfile,
  radius: number
) {
  return values.map((value, index) => {
    if (!isFinitePitchValue(value)) {
      return null;
    }

    let total = 0;
    let count = 0;

    for (
      let candidateIndex = Math.max(0, index - radius);
      candidateIndex <= Math.min(values.length - 1, index + radius);
      candidateIndex += 1
    ) {
      const candidate = values[candidateIndex];

      if (isFinitePitchValue(candidate)) {
        total += candidate;
        count += 1;
      }
    }

    return roundPitch(
      clampNumber(total / Math.max(count, 1), profile.baseline, profile.max)
    );
  });
}

type DisplayPitchProfile = {
  readonly baseline: number;
  readonly max: number;
  readonly min: number;
};

function buildDisplayPitchProfile(
  voicedValues: readonly number[]
): DisplayPitchProfile {
  const low = quantile(voicedValues, 0.08);
  const high = quantile(voicedValues, 0.92);
  const range = Math.max(high - low, 1);
  const baseline = Math.max(20, low - Math.max(30, range * 0.6));

  return {
    baseline: roundPitch(baseline),
    max: roundPitch(high + Math.max(36, range * 0.85)),
    min: roundPitch(Math.max(0, low - Math.max(24, range * 0.55)))
  };
}

function clampPitchToProfile(value: number, profile: DisplayPitchProfile) {
  return roundPitch(clampNumber(value, profile.min, profile.max));
}

function findNearestVoiced(
  values: readonly (number | null)[],
  startIndex: number,
  direction: -1 | 1
) {
  for (
    let index = startIndex + direction;
    index >= 0 && index < values.length;
    index += direction
  ) {
    const value = values[index];

    if (isVoicedPitchValue(value)) {
      return {
        index,
        value
      };
    }
  }

  return null;
}

function computePitchGraphQualityScore(values: readonly (number | null)[]) {
  if (values.length === 0) {
    return 0;
  }

  const voicedValues = values.filter(isVoicedPitchValue);

  if (voicedValues.length === 0) {
    return 0;
  }

  const coverage = voicedValues.length / values.length;
  const jumps = voicedValues
    .slice(1)
    .map((value, index) => Math.abs(value - voicedValues[index]!));
  const averageJump =
    jumps.length > 0
      ? jumps.reduce((total, value) => total + value, 0) / jumps.length
      : 0;
  const range = Math.max(
    Math.max(...voicedValues) - Math.min(...voicedValues),
    1
  );
  const smoothness =
    1 - clampNumber(averageJump / Math.max(45, range * 0.9), 0, 1);

  return Number.parseFloat(
    clampNumber(coverage * 0.72 + smoothness * 0.28, 0, 1).toFixed(2)
  );
}

function normalizeRawPitchValues(values: readonly (number | null)[]) {
  return values.map((value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? roundPitch(value)
      : null
  );
}

function isPitchGraphV2ManifestEntry(
  manifestVersion: 1 | 2,
  graph: PitchAccentAudioPitchGraph
) {
  return (
    manifestVersion === 2 ||
    graph.version === 2 ||
    graph.extractor !== undefined ||
    graph.rawValues !== undefined ||
    graph.qualityScore !== undefined
  );
}

function validatePitchGraphV2Entry(
  errors: string[],
  audioSrc: string,
  graph: PitchAccentAudioPitchGraph
) {
  if (graph.version !== 2) {
    errors.push(`${audioSrc} V2 pitch graph must include version 2.`);
  }
  if (
    !graph.extractor ||
    !(pitchGraphV2Extractors as readonly string[]).includes(graph.extractor)
  ) {
    errors.push(`${audioSrc} has an invalid pitch graph extractor.`);
  }
  if (!Array.isArray(graph.rawValues)) {
    errors.push(`${audioSrc} must include V2 raw pitch graph values.`);
  } else {
    validatePitchValueArray(
      errors,
      audioSrc,
      graph.rawValues,
      "raw pitch graph"
    );
    if (graph.rawValues.length !== graph.values.length) {
      errors.push(`${audioSrc} V2 pitch graph raw/value lengths differ.`);
    }
  }
  if (
    typeof graph.qualityScore !== "number" ||
    !Number.isFinite(graph.qualityScore) ||
    graph.qualityScore < 0 ||
    graph.qualityScore > 1
  ) {
    errors.push(`${audioSrc} has an invalid pitch graph quality score.`);
  }
  if (graph.expectedAccentOverlay) {
    validatePitchGraphOverlay(errors, audioSrc, graph.expectedAccentOverlay);
  }
}

function validatePitchGraphOverlay(
  errors: string[],
  audioSrc: string,
  overlay: PitchAccentExpectedAccentOverlay
) {
  if (
    !Number.isInteger(overlay.sampleIntervalMs) ||
    overlay.sampleIntervalMs <= 0
  ) {
    errors.push(`${audioSrc} has an invalid expected accent overlay interval.`);
  }
  if (!Array.isArray(overlay.values)) {
    errors.push(`${audioSrc} must include expected accent overlay values.`);
    return;
  }

  for (const value of overlay.values) {
    if (value !== null && value !== 0 && value !== 1) {
      errors.push(
        `${audioSrc} includes an invalid expected accent overlay value.`
      );
      break;
    }
  }
}

function validatePitchValueArray(
  errors: string[],
  audioSrc: string,
  values: readonly (number | null)[],
  label: string
) {
  for (const value of values) {
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    ) {
      errors.push(`${audioSrc} includes an invalid ${label} value.`);
      break;
    }
  }
}

function estimateFramePitch(
  frame: Float32Array,
  sampleRate: number,
  options: Required<PitchGraphEstimateOptions>
) {
  if (rootMeanSquare(frame) < options.silenceThreshold) {
    return null;
  }

  const minLag = Math.max(1, Math.floor(sampleRate / options.maxFrequencyHz));
  const maxLag = Math.min(
    frame.length - 2,
    Math.ceil(sampleRate / options.minFrequencyHz)
  );
  let bestLag = 0;
  let bestCorrelation = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;

    for (let index = 0; index < frame.length - lag; index += 1) {
      const left = frame[index] ?? 0;
      const right = frame[index + lag] ?? 0;
      correlation += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }

    const normalizedCorrelation =
      correlation / Math.sqrt(Math.max(leftEnergy * rightEnergy, 1e-12));

    if (normalizedCorrelation > bestCorrelation) {
      bestCorrelation = normalizedCorrelation;
      bestLag = lag;
    }
  }

  if (bestCorrelation < options.clarityThreshold || bestLag <= 0) {
    return null;
  }

  return roundPitch(sampleRate / bestLag);
}

function rootMeanSquare(frame: Float32Array) {
  let sum = 0;

  for (const sample of frame) {
    sum += sample * sample;
  }

  return Math.sqrt(sum / Math.max(frame.length, 1));
}

function smoothPitchValues(values: readonly (number | null)[]) {
  return values.map((value, index) => {
    if (value === null) {
      return null;
    }

    const neighbors = [values[index - 1], value, values[index + 1]].filter(
      (candidate): candidate is number =>
        typeof candidate === "number" && Number.isFinite(candidate)
    );
    if (neighbors.length < 2) {
      return value;
    }

    return roundPitch(
      neighbors.reduce((total, candidate) => total + candidate, 0) /
        neighbors.length
    );
  });
}

function isFinitePitchValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVoicedPitchValue(value: number | null | undefined): value is number {
  return isFinitePitchValue(value) && value > 0;
}

function quantile(values: readonly number[], percentile: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const normalizedPercentile = clampNumber(percentile, 0, 1);
  const position = (sorted.length - 1) * normalizedPercentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex] ?? sorted[0] ?? 0;
  const upper = sorted[upperIndex] ?? lower;

  return interpolate(lower, upper, position - lowerIndex);
}

function interpolate(left: number, right: number, progress: number) {
  return left + (right - left) * clampNumber(progress, 0, 1);
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPitch(value: number) {
  return Number.parseFloat(value.toFixed(1));
}

function isSafePitchGraphAudioSource(audioSrc: string) {
  return (
    (audioSrc.startsWith("/vendor/minimal-pairs/audio/") ||
      audioSrc.startsWith("/vendor/tofugu-pitch-minimal-pairs/audio/")) &&
    !audioSrc.includes("..")
  );
}

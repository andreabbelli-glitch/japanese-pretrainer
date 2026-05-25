import type {
  PitchAccentAudioPitchGraph,
  PitchAccentPitchGraphManifest
} from "../types";

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
    const frame = samples.subarray(start, Math.min(start + windowLength, samples.length));
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

  if (manifest.version !== 1) {
    errors.push("Pitch graph manifest version must be 1.");
  }

  if (!manifest.graphs || typeof manifest.graphs !== "object") {
    errors.push("Pitch graph manifest must include graphs.");
  } else {
    for (const [audioSrc, graph] of Object.entries(manifest.graphs)) {
      if (!isSafePitchGraphAudioSource(audioSrc)) {
        errors.push(`${audioSrc} has an unsafe pitch graph audio source.`);
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

      for (const value of graph.values) {
        if (
          value !== null &&
          (typeof value !== "number" || !Number.isFinite(value) || value < 0)
        ) {
          errors.push(`${audioSrc} includes an invalid pitch graph value.`);
          break;
        }
      }
    }
  }

  return {
    errors,
    ok: errors.length === 0
  };
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

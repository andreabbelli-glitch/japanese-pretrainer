import { describe, expect, it } from "vitest";

import {
  estimatePitchGraphFromPcm,
  validatePitchAccentPitchGraphManifest,
  type PitchAccentPitchGraphManifest
} from "@/features/pitch-accent/model";

describe("pitch accent audio pitch graphs", () => {
  it("extracts a stable pitch trace from a voiced PCM sample", () => {
    const sampleRate = 16_000;
    const samples = buildSineWave({
      durationSeconds: 0.6,
      frequencyHz: 200,
      sampleRate
    });

    const graph = estimatePitchGraphFromPcm(samples, sampleRate, {
      hopMs: 10,
      maxFrequencyHz: 350,
      minFrequencyHz: 80,
      windowMs: 40
    });

    const voicedValues = graph.values.filter(
      (value): value is number => typeof value === "number"
    );
    const average =
      voicedValues.reduce((total, value) => total + value, 0) /
      voicedValues.length;

    expect(graph.durationMs).toBe(600);
    expect(graph.sampleIntervalMs).toBe(10);
    expect(voicedValues.length).toBeGreaterThan(30);
    expect(average).toBeGreaterThan(190);
    expect(average).toBeLessThan(210);
  });

  it("returns null frames instead of fake pitch for silence", () => {
    const graph = estimatePitchGraphFromPcm(new Float32Array(16_000), 16_000);

    expect(graph.values.length).toBeGreaterThan(0);
    expect(graph.values.every((value) => value === null)).toBe(true);
  });

  it("validates static pitch graph manifests by audio source", () => {
    const manifest: PitchAccentPitchGraphManifest = {
      graphs: {
        "/vendor/minimal-pairs/audio/pair-a/0.aac": {
          durationMs: 420,
          sampleIntervalMs: 10,
          values: [120, 125, null, 132]
        }
      },
      version: 1
    };

    expect(validatePitchAccentPitchGraphManifest(manifest)).toEqual({
      errors: [],
      ok: true
    });
    expect(
      validatePitchAccentPitchGraphManifest({
        ...manifest,
        graphs: {
          "../escape": manifest.graphs[
            "/vendor/minimal-pairs/audio/pair-a/0.aac"
          ]!
        }
      }).errors
    ).toContain("../escape has an unsafe pitch graph audio source.");
  });
});

function buildSineWave(input: {
  readonly durationSeconds: number;
  readonly frequencyHz: number;
  readonly sampleRate: number;
}) {
  const length = Math.round(input.durationSeconds * input.sampleRate);
  const samples = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    samples[index] =
      Math.sin((index / input.sampleRate) * input.frequencyHz * Math.PI * 2) *
      0.35;
  }

  return samples;
}

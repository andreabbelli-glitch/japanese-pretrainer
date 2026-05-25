import { describe, expect, it } from "vitest";

import {
  buildExpectedAccentMoraLevels,
  buildPitchGraphV2FromRawValues,
  computePitchGraphDisplayDomain,
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
          "../escape":
            manifest.graphs["/vendor/minimal-pairs/audio/pair-a/0.aac"]!
        }
      }).errors
    ).toContain("../escape has an unsafe pitch graph audio source.");
  });

  it("builds a V2 display graph without treating unvoiced frames as real zero hertz", () => {
    const graph = buildPitchGraphV2FromRawValues({
      durationMs: 70,
      extractor: "autocorrelation-v1",
      moraCount: 3,
      pitchAccent: 1,
      rawValues: [0, 180, 190, null, 0, 170, 0],
      sampleIntervalMs: 10,
      strategy: "local-improved"
    });
    const values = graph.values.filter(
      (value): value is number => typeof value === "number"
    );

    expect(graph.version).toBe(2);
    expect(graph.rawValues).toEqual([0, 180, 190, null, 0, 170, 0]);
    expect(values).toHaveLength(7);
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(
      values
        .slice(1)
        .every((value, index) => Math.abs(value - values[index]!) < 120)
    ).toBe(true);
    expect(graph.qualityScore).toBeGreaterThan(0);
    expect(graph.qualityScore).toBeLessThanOrEqual(1);
    expect(graph.expectedAccentOverlay?.values).toHaveLength(7);
  });

  it("validates V2 manifests with raw audit values and quality metadata", () => {
    const graph = buildPitchGraphV2FromRawValues({
      durationMs: 40,
      extractor: "autocorrelation-v1",
      rawValues: [0, 210, 205, 0],
      sampleIntervalMs: 10,
      strategy: "local-kotu-like"
    });
    const manifest: PitchAccentPitchGraphManifest = {
      graphs: {
        "/vendor/minimal-pairs/audio/pair-a/0.aac": graph
      },
      version: 2
    };

    expect(validatePitchAccentPitchGraphManifest(manifest)).toEqual({
      errors: [],
      ok: true
    });
    expect(
      validatePitchAccentPitchGraphManifest({
        ...manifest,
        graphs: {
          "/vendor/minimal-pairs/audio/pair-a/0.aac": {
            ...graph,
            qualityScore: 1.4
          }
        }
      }).errors
    ).toContain(
      "/vendor/minimal-pairs/audio/pair-a/0.aac has an invalid pitch graph quality score."
    );
  });

  it("keeps the theoretical accent overlay separate from measured pitch values", () => {
    expect(
      buildExpectedAccentMoraLevels({ moraCount: 3, pitchAccent: 0 })
    ).toEqual([0, 1, 1]);
    expect(
      buildExpectedAccentMoraLevels({ moraCount: 3, pitchAccent: 1 })
    ).toEqual([1, 0, 0]);
    expect(
      buildExpectedAccentMoraLevels({ moraCount: 3, pitchAccent: 2 })
    ).toEqual([0, 1, 0]);

    const graph = buildPitchGraphV2FromRawValues({
      durationMs: 30,
      extractor: "autocorrelation-v1",
      moraCount: 3,
      pitchAccent: 2,
      rawValues: [120, 130, 110],
      sampleIntervalMs: 10,
      strategy: "local-improved"
    });

    expect(graph.values).not.toEqual(graph.expectedAccentOverlay?.values);
  });

  it("computes a robust display domain for compressed-baseline V2 curves", () => {
    const graph = buildPitchGraphV2FromRawValues({
      durationMs: 50,
      extractor: "autocorrelation-v1",
      rawValues: [0, 180, 182, 179, 0],
      sampleIntervalMs: 10,
      strategy: "local-improved"
    });
    const domain = computePitchGraphDisplayDomain(graph);

    expect(domain).not.toBeNull();
    expect(domain!.minYValue).toBeGreaterThan(0);
    expect(domain!.maxYValue).toBeGreaterThan(domain!.minYValue);
    expect(domain!.ticks).toHaveLength(3);
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

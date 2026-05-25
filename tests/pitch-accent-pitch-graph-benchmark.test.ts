import { describe, expect, it } from "vitest";

import {
  computePitchBenchmarkMetrics,
  renderPitchBenchmarkReportHtml,
  type PitchBenchmarkReportSample
} from "@/features/pitch-accent/tooling";

describe("pitch accent PTDB-TUG pitch benchmark", () => {
  it("scores pitch similarity against a voiced reference contour", () => {
    const exact = computePitchBenchmarkMetrics({
      candidate: {
        label: "exact",
        sampleIntervalMs: 10,
        values: [0, 100, 110, 120, 0]
      },
      reference: {
        label: "reference",
        sampleIntervalMs: 10,
        values: [0, 100, 110, 120, 0]
      }
    });
    const wrongVoicing = computePitchBenchmarkMetrics({
      candidate: {
        label: "wrong",
        sampleIntervalMs: 10,
        values: [100, 0, 0, 240, 100]
      },
      reference: {
        label: "reference",
        sampleIntervalMs: 10,
        values: [0, 100, 110, 120, 0]
      }
    });

    expect(exact).toMatchObject({
      grossPitchErrorRate: 0,
      maeCents: 0,
      matchedVoicedFrameCount: 3,
      octaveErrorRate: 0,
      referenceVoicedFrameCount: 3,
      rmseCents: 0,
      similarityScore: 100,
      voicingF1: 1
    });
    expect(wrongVoicing.similarityScore).toBeLessThan(exact.similarityScore);
    expect(wrongVoicing.voicingF1).toBeLessThan(1);
    expect(wrongVoicing.octaveErrorRate).toBe(1);
  });

  it("renders a reference-first benchmark report with extractor rankings", () => {
    const reference = {
      label: "Validated PTDB-TUG F0",
      sampleIntervalMs: 10,
      values: [0, 180, 190, 200, 0]
    };
    const sample: PitchBenchmarkReportSample = {
      audioHref: "audio.wav",
      durationMs: 50,
      extractors: [
        {
          metrics: computePitchBenchmarkMetrics({
            candidate: {
              label: "SwiftF0 smoothed",
              sampleIntervalMs: 10,
              values: [0, 181, 189, 199, 0]
            },
            reference
          }),
          series: {
            label: "SwiftF0 smoothed",
            sampleIntervalMs: 10,
            values: [0, 181, 189, 199, 0]
          },
          status: "available"
        }
      ],
      gender: "FEMALE",
      reference,
      speaker: "F01",
      utterance: "si548"
    };

    const html = renderPitchBenchmarkReportHtml({
      generatedAt: "2026-05-26T00:00:00.000Z",
      samples: [sample]
    });

    expect(html).toContain("PTDB-TUG F0 Benchmark");
    expect(html).toContain("Validated PTDB-TUG F0");
    expect(html).toContain("SwiftF0 smoothed");
    expect(html).toContain("Similarity");
    expect(html).toContain("validated F0");
  });
});

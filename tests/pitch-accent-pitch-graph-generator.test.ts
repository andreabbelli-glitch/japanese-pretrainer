import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generatePitchGraphManifestForCorpus } from "@/features/pitch-accent/tooling";

describe("pitch accent pitch graph generator", () => {
  it("generates a static graph manifest from fixture audio", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-graph-gen-"));
    const publicDir = path.join(tempDir, "public");
    const audioPath = path.join(
      publicDir,
      "vendor",
      "minimal-pairs",
      "audio",
      "pair-a",
      "0.wav"
    );
    const manifestPath = path.join(tempDir, "manifest.json");
    const outPath = path.join(tempDir, "pitch-graphs.json");

    await mkdir(path.dirname(audioPath), { recursive: true });
    await writeFile(
      audioPath,
      buildWavSineWave({
        durationSeconds: 0.2,
        frequencyHz: 180,
        sampleRate: 16_000
      })
    );
    await writeFile(
      manifestPath,
      JSON.stringify({
        pairs: [
          {
            hasDevoiced: false,
            id: "pair-a",
            kana: "あき",
            optionCount: 2,
            options: [
              {
                accentedMora: 1,
                audioMime: "audio/wav",
                audioSrc: "/vendor/minimal-pairs/audio/pair-a/0.wav",
                id: "pair-a:0",
                moraCount: 2,
                pitchAccent: 1,
                rawPronunciation: "アキ",
                silencedMoras: []
              },
              {
                accentedMora: 0,
                audioMime: "audio/wav",
                audioSrc: "/vendor/minimal-pairs/audio/pair-a/0.wav",
                id: "pair-a:1",
                moraCount: 2,
                pitchAccent: 0,
                rawPronunciation: "アキ",
                silencedMoras: []
              }
            ],
            patternKeys: ["pitch1", "pitch0"]
          }
        ],
        source: {
          importedAt: "2026-05-25T00:00:00.000Z",
          license: "fixture",
          repository: "fixture",
          revision: "fixture"
        },
        version: 1
      })
    );

    await expect(
      generatePitchGraphManifestForCorpus({
        concurrency: 1,
        manifestPath,
        outPath,
        publicDir,
        requiredAudioSrcPrefix: "/vendor/minimal-pairs/audio/"
      })
    ).resolves.toMatchObject({
      audioCount: 1,
      outputPath: outPath
    });

    const manifest = JSON.parse(await readFile(outPath, "utf8")) as {
      readonly graphs: Record<
        string,
        { readonly values: readonly (number | null)[] }
      >;
    };
    const values =
      manifest.graphs["/vendor/minimal-pairs/audio/pair-a/0.wav"]?.values ??
      [];

    expect(values.some((value) => typeof value === "number")).toBe(true);
  });
});

function buildWavSineWave(input: {
  readonly durationSeconds: number;
  readonly frequencyHz: number;
  readonly sampleRate: number;
}) {
  const sampleCount = Math.round(input.durationSeconds * input.sampleRate);
  const dataLength = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(input.sampleRate, 24);
  buffer.writeUInt32LE(input.sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(
      Math.sin(
        (index / input.sampleRate) * input.frequencyHz * Math.PI * 2
      ) * 0x3fff
    );
    buffer.writeInt16LE(sample, 44 + index * 2);
  }

  return buffer;
}

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  readPitchAccentMinimalPairCorpusSpecs
} from "@/features/pitch-accent/server/corpus";

describe("pitch accent corpus loader", () => {
  it("merges Kuuuube and optional Tofugu static corpora with separate audio prefixes", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-corpus-"));
    const kuuuubeManifest = path.join(tempDir, "kuuuube", "manifest.json");
    const tofuguManifest = path.join(tempDir, "tofugu", "manifest.json");

    try {
      await mkdir(path.dirname(kuuuubeManifest), { recursive: true });
      await mkdir(path.dirname(tofuguManifest), { recursive: true });
      await writeFile(
        kuuuubeManifest,
        JSON.stringify(
          buildFixtureCorpus({
            audioPrefix: "/vendor/minimal-pairs/audio/",
            id: "kuuuube-pair",
            kana: "かい"
          })
        )
      );
      await writeFile(
        tofuguManifest,
        JSON.stringify(
          buildFixtureCorpus({
            audioPrefix: "/vendor/tofugu-pitch-minimal-pairs/audio/",
            id: "tofugu-pair",
            kana: "はし"
          })
        )
      );

      const corpus = await readPitchAccentMinimalPairCorpusSpecs([
        {
          allowedAudioSrcPrefixes: ["/vendor/minimal-pairs/audio/"],
          manifestPath: kuuuubeManifest,
          required: true
        },
        {
          allowedAudioSrcPrefixes: [
            "/vendor/tofugu-pitch-minimal-pairs/audio/"
          ],
          manifestPath: tofuguManifest,
          required: false
        },
        {
          allowedAudioSrcPrefixes: ["/vendor/missing/audio/"],
          manifestPath: path.join(tempDir, "missing", "manifest.json"),
          required: false
        }
      ]);

      expect(corpus.pairs.map((pair) => pair.id)).toEqual([
        "kuuuube-pair",
        "tofugu-pair"
      ]);
      expect(corpus.source.repository).toBe("merged-static-corpora");
      expect(corpus.source.revision).toBe("fixture+fixture");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function buildFixtureCorpus(input: {
  readonly audioPrefix: string;
  readonly id: string;
  readonly kana: string;
}) {
  return {
    pairs: [
      {
        hasDevoiced: false,
        id: input.id,
        kana: input.kana,
        optionCount: 2,
        options: [0, 1].map((pitch) => ({
          accentedMora: pitch,
          audioSrc: `${input.audioPrefix}${input.id}/${pitch}.mp3`,
          id: `${input.id}:${pitch}`,
          moraCount: 2,
          pitchAccent: pitch,
          rawPronunciation: input.kana,
          silencedMoras: []
        })),
        patternKeys: ["pitch0", "pitch1"]
      }
    ],
    source: {
      importedAt: "2026-05-25T00:00:00.000Z",
      license: "fixture",
      repository: "fixture",
      revision: "fixture"
    },
    version: 1
  };
}

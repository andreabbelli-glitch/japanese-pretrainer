import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import {
  generateTofuguPitchMinimalPairsCorpus,
  validateGeneratedTofuguPitchMinimalPairsCorpus
} from "@/features/pitch-accent/tooling";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..");

describe("Tofugu pitch accent minimal-pairs generator", () => {
  it("generates only Jaydar-confirmed Tofugu contrasts not already covered by Kuuuube", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-tofugu-pitch-"));
    const tofuguRoot = path.join(tempDir, "tofugu");
    const outDir = path.join(tempDir, "vendor", "tofugu-pitch-minimal-pairs");
    const kanjiumPath = path.join(tempDir, "kanjium-accents.txt");
    const jaydarExportPath = path.join(tempDir, "jaydar.jsonl");
    const kuuuubeManifestPath = path.join(tempDir, "kuuuube-manifest.json");

    try {
      await createTofuguAudioFixture(tofuguRoot);
      await writeFile(
        kanjiumPath,
        [
          "橋\tはし\t2",
          "端\tはし\t0",
          "箸\tはし\t1",
          "会\tかい\t1",
          "甲斐\tかい\t0",
          "無し\tなし\t0",
          "梨\tなし\t1",
          "無順\tむじゅん\t0",
          "矛盾\tむじゅん\t2"
        ].join("\n")
      );
      await writeFile(
        jaydarExportPath,
        [
          JSON.stringify({
            homophones: [
              { jaydarPitchAccents: [2], reading: "はし", surface: "橋" },
              { jaydarPitchAccents: [0], reading: "はし", surface: "端" },
              { jaydarPitchAccents: [1], reading: "はし", surface: "箸" }
            ],
            reading: "はし"
          }),
          JSON.stringify({
            homophones: [
              { jaydarPitchAccents: [1], reading: "かい", surface: "会" },
              { jaydarPitchAccents: [0], reading: "かい", surface: "甲斐" }
            ],
            reading: "かい"
          }),
          JSON.stringify({
            homophones: [
              { jaydarPitchAccents: [1], reading: "むじゅん", surface: "矛盾" },
              { jaydarPitchAccents: [0], reading: "むじゅん", surface: "無順" }
            ],
            reading: "むじゅん"
          }),
          JSON.stringify({
            homophones: [
              { jaydarPitchAccents: [1], reading: "なし", surface: "梨" }
            ],
            reading: "なし"
          })
        ].join("\n")
      );
      await writeFile(
        kuuuubeManifestPath,
        JSON.stringify(
          buildKuuuubeCoverageManifest([
            { kana: "はし", pitches: [0, 1] },
            { kana: "かい", pitches: [0, 1] }
          ])
        )
      );

      const result = await generateTofuguPitchMinimalPairsCorpus({
        allowNonVendorOutDir: true,
        importedAt: "2026-05-25T12:00:00.000Z",
        jaydarExportPath,
        kanjiumDataPath: kanjiumPath,
        kuuuubeManifestPath,
        outDir,
        tofuguDatasetDir: tofuguRoot
      });
      const manifest = JSON.parse(
        await readFile(path.join(outDir, "manifest.json"), "utf8")
      );
      const audit = JSON.parse(
        await readFile(path.join(outDir, "audit.json"), "utf8")
      );

      expect(result).toMatchObject({
        audioFileCount: 4,
        pairCount: 2,
        optionCount: 4
      });
      expect(manifest.pairs).toHaveLength(2);
      expect(
        manifest.pairs.map(
          (pair: {
            kana: string;
            options: Array<{ pitchAccent: number; surface: string }>;
          }) => ({
            kana: pair.kana,
            pitches: pair.options.map((option) => option.pitchAccent).sort()
          })
        )
      ).toEqual([
        { kana: "はし", pitches: [0, 2] },
        { kana: "はし", pitches: [1, 2] }
      ]);
      expect(manifest.pairs[0].options[0]).toMatchObject({
        audioMime: "audio/mpeg",
        audioSrc: expect.stringMatching(
          /^\/vendor\/tofugu-pitch-minimal-pairs\/audio\/tofugu_/
        ),
        pitchAccentSource: "Kanjium",
        reading: "はし"
      });
      expect(audit.summary).toMatchObject({
        covered_by_kuuuube: 2,
        jaydar_kanjium_pitch_mismatch: 1,
        not_confirmed_by_jaydar: 1
      });
      expect(Object.values(audit.source)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^\/|^[A-Za-z]:\\/u)])
      );
      await expect(
        stat(
          path.join(
            outDir,
            manifest.pairs[0].options[0].audioSrc.replace(
              "/vendor/tofugu-pitch-minimal-pairs/",
              ""
            )
          )
        )
      ).resolves.toBeTruthy();
      await expect(
        readFile(path.join(outDir, "NOTICE.md"), "utf8")
      ).resolves.toContain("Tofugu and WaniKani");
      await expect(
        validateGeneratedTofuguPitchMinimalPairsCorpus({
          kuuuubeManifestPath,
          outDir
        })
      ).resolves.toEqual({ errors: [], ok: true });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when the Jaydar export does not cover a candidate Tofugu reading", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-tofugu-pitch-"));
    const tofuguRoot = path.join(tempDir, "tofugu");
    const kanjiumPath = path.join(tempDir, "kanjium-accents.txt");
    const jaydarExportPath = path.join(tempDir, "jaydar.jsonl");
    const kuuuubeManifestPath = path.join(tempDir, "kuuuube-manifest.json");

    try {
      await createTofuguAudioFile(tofuguRoot, "橋【はし】.mp3");
      await createTofuguAudioFile(tofuguRoot, "箸【はし】.mp3");
      await writeFile(kanjiumPath, "橋\tはし\t2\n箸\tはし\t1\n");
      await writeFile(jaydarExportPath, "");
      await writeFile(
        kuuuubeManifestPath,
        JSON.stringify(buildKuuuubeCoverageManifest([]))
      );

      await expect(
        generateTofuguPitchMinimalPairsCorpus({
          jaydarExportPath,
          kanjiumDataPath: kanjiumPath,
          kuuuubeManifestPath,
          outDir: path.join(tempDir, "out"),
          tofuguDatasetDir: tofuguRoot
        })
      ).rejects.toThrow("Jaydar export is missing readings: はし");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps generated ids stable when source order changes and merges duplicate Jaydar entries", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-tofugu-pitch-"));
    const tofuguRoot = path.join(tempDir, "tofugu");
    const kanjiumPath = path.join(tempDir, "kanjium-accents.txt");
    const kuuuubeManifestPath = path.join(tempDir, "kuuuube-manifest.json");
    const firstJaydarExport = path.join(tempDir, "jaydar-a.jsonl");
    const secondJaydarExport = path.join(tempDir, "jaydar-b.jsonl");

    try {
      await createTofuguAudioFile(tofuguRoot, "橋【はし】.mp3");
      await createTofuguAudioFile(tofuguRoot, "箸【はし】.mp3");
      await createTofuguAudioFile(tofuguRoot, "端【はし】.mp3");
      await writeFile(kanjiumPath, "橋\tはし\t2\n箸\tはし\t1\n端\tはし\t0\n");
      await writeFile(
        kuuuubeManifestPath,
        JSON.stringify(
          buildKuuuubeCoverageManifest([{ kana: "はし", pitches: [0, 1] }])
        )
      );
      await writeFile(
        firstJaydarExport,
        [
          JSON.stringify({
            homophones: [
              { jaydarPitchAccents: [2], reading: "はし", surface: "橋" },
              { jaydarPitchAccents: [0], reading: "はし", surface: "端" },
              { jaydarPitchAccents: [1], reading: "はし", surface: "箸" }
            ],
            reading: "はし"
          })
        ].join("\n")
      );
      await writeFile(
        secondJaydarExport,
        [
          JSON.stringify({
            homophones: [
              { jaydarPitchAccents: [1], reading: "はし", surface: "箸" },
              { jaydarPitchAccents: [0], reading: "はし", surface: "端" },
              { jaydarPitchAccents: [9], reading: "はし", surface: "橋" },
              { jaydarPitchAccents: [2], reading: "はし", surface: "橋" }
            ],
            reading: "はし"
          })
        ].join("\n")
      );

      const firstOut = path.join(tempDir, "out-a");
      const secondOut = path.join(tempDir, "out-b");
      await generateTofuguPitchMinimalPairsCorpus({
        allowNonVendorOutDir: true,
        jaydarExportPath: firstJaydarExport,
        kanjiumDataPath: kanjiumPath,
        kuuuubeManifestPath,
        outDir: firstOut,
        tofuguDatasetDir: tofuguRoot
      });
      await generateTofuguPitchMinimalPairsCorpus({
        allowNonVendorOutDir: true,
        jaydarExportPath: secondJaydarExport,
        kanjiumDataPath: kanjiumPath,
        kuuuubeManifestPath,
        outDir: secondOut,
        tofuguDatasetDir: tofuguRoot
      });

      const firstManifest = JSON.parse(
        await readFile(path.join(firstOut, "manifest.json"), "utf8")
      );
      const secondManifest = JSON.parse(
        await readFile(path.join(secondOut, "manifest.json"), "utf8")
      );

      expect(
        firstManifest.pairs.map((pair: { id: string }) => pair.id)
      ).toEqual(secondManifest.pairs.map((pair: { id: string }) => pair.id));
      expect(
        firstManifest.pairs.flatMap(
          (pair: { options: Array<{ id: string }> }) =>
            pair.options.map((option) => option.id)
        )
      ).toEqual(
        secondManifest.pairs.flatMap(
          (pair: { options: Array<{ id: string }> }) =>
            pair.options.map((option) => option.id)
        )
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails the CLI before generation when no Jaydar export is provided", async () => {
    await expect(
      execFileAsync("node", [
        "--experimental-strip-types",
        path.join(repoRoot, "scripts", "generate-tofugu-pitch-minimal-pairs.ts")
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing required --jaydar-export")
    });
  });
});

async function createTofuguAudioFixture(tofuguRoot: string) {
  await createTofuguAudioFile(tofuguRoot, "橋【はし】.mp3");
  await createTofuguAudioFile(tofuguRoot, "端【はし】.mp3");
  await createTofuguAudioFile(tofuguRoot, "箸【はし】.mp3");
  await createTofuguAudioFile(tofuguRoot, "会【かい】.mp3");
  await createTofuguAudioFile(tofuguRoot, "甲斐【かい】.mp3");
  await createTofuguAudioFile(tofuguRoot, "無し【なし】.mp3");
  await createTofuguAudioFile(tofuguRoot, "梨【なし】.mp3");
  await createTofuguAudioFile(tofuguRoot, "無順【むじゅん】.mp3");
  await createTofuguAudioFile(tofuguRoot, "矛盾【むじゅん】.mp3");
}

async function createTofuguAudioFile(tofuguRoot: string, fileName: string) {
  const audioDir = path.join(tofuguRoot, "lib", "mp3");

  await mkdir(audioDir, { recursive: true });
  await writeFile(path.join(audioDir, fileName), buildMp3FixtureBytes());
}

function buildMp3FixtureBytes() {
  return Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x0f, 0xf0, 0x00]);
}

function buildKuuuubeCoverageManifest(
  entries: Array<{ kana: string; pitches: [number, number] | number[] }>
) {
  return {
    pairs: entries.map((entry, index) => ({
      hasDevoiced: false,
      id: `pair-${index}`,
      kana: entry.kana,
      optionCount: entry.pitches.length,
      options: entry.pitches.map((pitch, optionIndex) => ({
        accentedMora: pitch,
        audioSrc: `/vendor/minimal-pairs/audio/pair-${index}/${optionIndex}.aac`,
        id: `pair-${index}:${optionIndex}`,
        moraCount: 3,
        pitchAccent: pitch,
        rawPronunciation: entry.kana,
        silencedMoras: []
      })),
      patternKeys: ["pitch0", "pitch1"]
    })),
    source: {
      importedAt: "2026-05-25T00:00:00.000Z",
      license: "GPL-3.0-only",
      repository: "fixture",
      revision: "fixture"
    },
    version: 1
  };
}

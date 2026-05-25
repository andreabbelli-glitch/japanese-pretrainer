import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  readPitchAccentPitchGraphManifest,
  readPitchAccentPitchGraphManifests
} from "@/features/pitch-accent/server/corpus";

describe("pitch accent pitch graph loader", () => {
  it("merges optional vendor pitch graph manifests by audio source", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-graphs-"));
    const firstPath = path.join(tempDir, "minimal-pairs", "pitch-graphs.json");
    const secondPath = path.join(
      tempDir,
      "tofugu-pitch-minimal-pairs",
      "pitch-graphs.json"
    );

    await mkdir(path.dirname(firstPath), { recursive: true });
    await mkdir(path.dirname(secondPath), { recursive: true });
    await writeFile(
      firstPath,
      JSON.stringify({
        graphs: {
          "/vendor/minimal-pairs/audio/pair-a/0.aac": {
            durationMs: 400,
            sampleIntervalMs: 10,
            values: [120, 125]
          }
        },
        version: 1
      })
    );
    await writeFile(
      secondPath,
      JSON.stringify({
        graphs: {
          "/vendor/tofugu-pitch-minimal-pairs/audio/pair-b/0.mp3": {
            durationMs: 520,
            sampleIntervalMs: 10,
            values: [180, null, 172]
          }
        },
        version: 1
      })
    );

    await expect(readPitchAccentPitchGraphManifest(firstPath)).resolves.toEqual(
      expect.objectContaining({
        graphs: expect.objectContaining({
          "/vendor/minimal-pairs/audio/pair-a/0.aac": expect.objectContaining({
            durationMs: 400
          })
        })
      })
    );
    await expect(
      readPitchAccentPitchGraphManifests([
        { manifestPath: firstPath, required: true },
        { manifestPath: secondPath, required: false }
      ])
    ).resolves.toEqual({
      "/vendor/minimal-pairs/audio/pair-a/0.aac": {
        durationMs: 400,
        sampleIntervalMs: 10,
        values: [120, 125]
      },
      "/vendor/tofugu-pitch-minimal-pairs/audio/pair-b/0.mp3": {
        durationMs: 520,
        sampleIntervalMs: 10,
        values: [180, null, 172]
      }
    });
  });
});

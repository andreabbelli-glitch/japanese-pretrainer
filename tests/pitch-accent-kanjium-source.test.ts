import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePitchAccentForEntry } from "@/features/pitch-accent/tooling/fetch";

describe("Kanjium pitch accent source", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses annotated accent lists before disambiguation", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-kanjium-annotated-")
    );
    const kanjiumDataPath = path.join(tempDir, "kanjium-accents.txt");
    await writeFile(
      kanjiumDataPath,
      "只今\tただいま\t(名)2,(感)4,0\n"
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("api.jiten.moe/api/vocabulary/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                readingIndex: 0,
                rubyText: "只今[ただいま]",
                text: "只今",
                wordId: 1000
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (url.includes("api.jiten.moe/api/vocabulary/1000/0/info")) {
        return new Response(
          JSON.stringify({
            mainReading: {
              readingIndex: 0,
              text: "只今[ただいま]"
            },
            pitchAccents: [4]
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await resolvePitchAccentForEntry({
        entry: {
          aliases: [],
          id: "term-tadaima",
          kind: "term",
          label: "只今",
          mediaDirectory: "/tmp/fixture",
          mediaSlug: "fixture",
          reading: "ただいま"
        },
        kanjiumDataPath,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        },
        sources: ["kanjium", "jiten"]
      });

      expect(result).toMatchObject({
        pitchAccent: 4,
        source: {
          sourceLabel: "Kanjium + Jiten"
        },
        status: "resolved"
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

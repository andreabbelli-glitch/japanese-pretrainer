import { describe, expect, it } from "vitest";

import type { PitchAccentPairOption } from "@/features/pitch-accent/model";
import {
  fetchKotuPitchBaselineCacheForOptions,
  fetchKotuRawPitchBaseline
} from "@/features/pitch-accent/tooling";

describe("pitch accent Kotu baseline tooling", () => {
  it("uses the documented v2 API base when fetching raw pitch", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (url) => {
      requestedUrls.push(String(url));

      return new Response(JSON.stringify([0, 121.42, 132.77]), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    };

    const entry = await fetchKotuRawPitchBaseline({
      fetchImpl,
      pronunciationId: "pronunciation-a"
    });

    expect(requestedUrls).toEqual([
      "https://api.kotu.io/v2/languages/ja/analysis/audio/pronunciations/pronunciation-a/raw-pitch"
    ]);
    expect(entry.rawPitchValues).toEqual([0, 121.4, 132.8]);
  });

  it("scans minimal-pair questions and caches matching Kotu raw-pitch traces", async () => {
    const requestedUrls: string[] = [];
    const requestedBodies: unknown[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      requestedUrls.push(String(url));

      if (init?.method === "POST") {
        requestedBodies.push(JSON.parse(String(init.body)));

        return new Response(
          JSON.stringify({
            lookahead: {
              prompt: {
                standard: {
                  audioChoice: {
                    options: [
                      {
                        phrases: [{ rawPronunciation: "ナラス" }],
                        pitchAccent: 2,
                        pronunciationID: "lookahead-pronunciation"
                      }
                    ]
                  }
                }
              }
            },
            prompt: {
              standard: {
                audioChoice: {
                  options: [
                    {
                      phrases: [{ rawPronunciation: "スル" }],
                      pitchAccent: 1,
                      pronunciationID: "matched-pronunciation"
                    },
                    {
                      phrases: [{ rawPronunciation: "スル" }],
                      pitchAccent: 0,
                      pronunciationID: "wrong-accent-pronunciation"
                    }
                  ]
                }
              }
            }
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200
          }
        );
      }

      return new Response(JSON.stringify([0, 150.12, 160.89]), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    };

    const result = await fetchKotuPitchBaselineCacheForOptions({
      cache: { entries: [], version: 1 },
      delayMs: 0,
      fetchImpl,
      options: [buildOption({ pitchAccent: 1, rawPronunciation: "スル" })],
      scanLimit: 5,
      seed: 123
    });

    expect(result).toMatchObject({
      fetchedCount: 1,
      matchedCount: 1,
      scannedQuestionCount: 1
    });
    expect(result.cache.entries).toHaveLength(1);
    expect(result.cache.entries[0]).toMatchObject({
      kotuPronunciationId: "matched-pronunciation",
      pitchAccent: 1,
      rawPitchValues: [0, 150.1, 160.9],
      rawPronunciation: "スル",
      sourceUrl:
        "https://api.kotu.io/v2/languages/ja/analysis/audio/pronunciations/matched-pronunciation/raw-pitch"
    });
    expect(requestedUrls).toEqual([
      "https://api.kotu.io/v2/languages/ja/tests/pitchAccent/perception/minimalPairs/v1/questions/next",
      "https://api.kotu.io/v2/languages/ja/analysis/audio/pronunciations/matched-pronunciation/raw-pitch"
    ]);
    expect(requestedBodies).toMatchObject([
      {
        config: {
          index: 0,
          seed: 123
        }
      }
    ]);
  });
});

function buildOption(
  input: Pick<PitchAccentPairOption, "pitchAccent" | "rawPronunciation">
): PitchAccentPairOption {
  return {
    accentedMora: input.pitchAccent,
    audioSrc: "/vendor/minimal-pairs/audio/test/0.wav",
    id: `test:${input.pitchAccent}`,
    moraCount: 2,
    pitchAccent: input.pitchAccent,
    rawPronunciation: input.rawPronunciation,
    silencedMoras: []
  };
}

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractPitchAccentCandidatesFromOjadHtml,
  extractPitchAccentFromWiktionaryWikitext,
  fetchPitchAccentsForBundle,
  resolvePitchAccentForEntry
} from "@/lib/pitch-accent-fetch";

const sampleOjadHtml = `
<table>
  <tr id="word_1238">
    <td class="midashi">
      <div class="midashi_wrapper">
        <p class="midashi_word">食べる・食べます</p>
      </div>
    </td>
    <td class="katsuyo katsuyo_jisho_js">
      <div class="katsuyo_proc">
        <p>
          <span class="katsuyo_accent"><span class="accented_word"><span class="mola_-3"><span class="inner"><span class="char">た</span></span></span><span class=" accent_top mola_-2"><span class="inner"><span class="char">べ</span></span></span><span class="mola_-1"><span class="inner"><span class="char">る</span></span></span></span></span>
        </p>
      </div>
    </td>
  </tr>
</table>
`;

describe("pitch accent fetch helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts a single pitch accent from Wiktionary ja-pron templates", () => {
    const source = `
==Japanese==
===Pronunciation===
* {{ja-pron|しんか|acc=1|acc_ref=NHK}}
`;

    expect(
      extractPitchAccentFromWiktionaryWikitext(source, {
        aliases: [],
        label: "進化",
        reading: "しんか"
      })
    ).toEqual([1]);
  });

  it("extracts OJAD candidates from the dictionary-form column", () => {
    expect(extractPitchAccentCandidatesFromOjadHtml(sampleOjadHtml)).toEqual([
      {
        pitchAccent: 2,
        reading: "たべる",
        title: "食べる・食べます"
      }
    ]);
  });

  it("resolves from Wiktionary before trying later sources", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: "進化",
                  revisions: [
                    {
                      slots: {
                        main: {
                          content:
                            "==Japanese==\n===Pronunciation===\n* {{ja-pron|しんか|acc=1|acc_ref=NHK}}\n"
                        }
                      }
                    }
                  ]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      return new Response(sampleOjadHtml, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePitchAccentForEntry({
      entry: {
        aliases: [],
        id: "term-shinka",
        kind: "term",
        label: "進化",
        mediaDirectory: "/tmp/fixture",
        mediaSlug: "fixture",
        reading: "しんか"
      },
      network: {
        requestDelayMs: 0
      }
    });

    expect(result).toMatchObject({
      pitchAccent: 1,
      source: {
        pageUrl: "https://en.wiktionary.org/wiki/%E9%80%B2%E5%8C%96",
        sourceLabel: "Wiktionary"
      },
      status: "resolved"
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to OJAD when Wiktionary does not resolve", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: "食べる",
                  revisions: [
                    {
                      slots: {
                        main: {
                          content: "==Japanese==\n===Pronunciation===\n"
                        }
                      }
                    }
                  ]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      return new Response(sampleOjadHtml, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePitchAccentForEntry({
      entry: {
        aliases: [],
        id: "term-taberu",
        kind: "term",
        label: "食べる",
        mediaDirectory: "/tmp/fixture",
        mediaSlug: "fixture",
        reading: "たべる"
      },
      network: {
        requestDelayMs: 0
      }
    });

    expect(result).toMatchObject({
      pitchAccent: 2,
      source: {
        sourceLabel: "OJAD"
      },
      status: "resolved"
    });
  });

  it("treats OJAD 404 alternatives as misses instead of source errors", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: "時",
                  revisions: [
                    {
                      slots: {
                        main: {
                          content: "==Japanese==\n===Pronunciation===\n"
                        }
                      }
                    }
                  ]
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePitchAccentForEntry({
      entry: {
        aliases: [],
        id: "grammar-toki",
        kind: "grammar",
        label: "時",
        mediaDirectory: "/tmp/fixture",
        mediaSlug: "fixture",
        reading: "とき / たとき"
      },
      network: {
        requestDelayMs: 0
      }
    });

    expect(result).toEqual({
      entryId: "grammar-toki",
      kind: "grammar",
      status: "miss"
    });
  });

  it("writes pronunciations.json with pitch accent source metadata", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-manifest-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          query: {
            pages: [
              {
                title: "進化",
                revisions: [
                  {
                    slots: {
                      main: {
                        content:
                          "==Japanese==\n===Pronunciation===\n* {{ja-pron|しんか|acc=1|acc_ref=NHK}}\n"
                      }
                    }
                  }
                ]
              }
            ]
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await fetchPitchAccentsForBundle({
        bundle: {
          cardFiles: [],
          cards: [],
          grammarPatterns: [],
          lessons: [],
          media: null,
          mediaDirectory,
          mediaSlug: "fixture",
          references: [],
          terms: [
            {
              aliases: [],
              id: "term-shinka",
              kind: "term",
              lemma: "進化",
              meaningIt: "evoluzione",
              pitchAccent: undefined,
              reading: "しんか",
              romaji: "shinka",
              source: {
                documentKind: "cards",
                filePath: "fixture.md",
                sequence: 0
              }
            }
          ]
        },
        network: {
          requestDelayMs: 0
        }
      });

      const manifest = JSON.parse(
        await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      );

      expect(manifest.entries).toEqual([
        {
          entry_id: "term-shinka",
          entry_type: "term",
          pitch_accent: 1,
          pitch_accent_page_url:
            "https://en.wiktionary.org/wiki/%E9%80%B2%E5%8C%96",
          pitch_accent_source: "Wiktionary"
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

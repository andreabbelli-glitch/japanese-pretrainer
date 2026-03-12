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

  it("confirms a pitch accent only when Wiktionary and OJAD agree", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-accent-"));
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  revisions: [
                    {
                      slots: {
                        main: {
                          content:
                            "==Japanese==\n===Pronunciation===\n* {{ja-pron|たべる|acc=2|acc_ref=NHK}}\n"
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

      if (url.includes("gavo.t.u-tokyo.ac.jp")) {
        return new Response(sampleOjadHtml, { status: 200 });
      }

      return new Response("not found", { status: 404, statusText: "Not Found" });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await resolvePitchAccentForEntry({
        cacheRoot: tempDir,
        entry: {
          aliases: [],
          audio: {
            audioSrc: "assets/audio/term/term-taberu/term-taberu.ogg"
          },
          id: "term-taberu",
          kind: "term",
          label: "食べる",
          mediaDirectory: tempDir,
          mediaSlug: "fixture",
          pitchAccent: undefined,
          reading: "たべる"
        }
      });

      expect(result).toMatchObject({
        pitchAccent: 2,
        status: "confirmed"
      });
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("writes pronunciations.json only for confirmed entries", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-manifest-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  revisions: [
                    {
                      slots: {
                        main: {
                          content:
                            "==Japanese==\n===Pronunciation===\n* {{ja-pron|たべる|acc=2|acc_ref=NHK}}\n"
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
              audio: {
                audioAttribution: "Fixture Speaker",
                audioSource: "fixture",
                audioSrc: "assets/audio/term/term-taberu/term-taberu.ogg"
              },
              id: "term-taberu",
              kind: "term",
              lemma: "食べる",
              meaningIt: "mangiare",
              pitchAccent: undefined,
              reading: "たべる",
              romaji: "taberu",
              source: {
                documentKind: "cards",
                filePath: "fixture.md",
                sequence: 0
              }
            }
          ]
        },
        cacheRoot: path.join(tempDir, "cache")
      });

      const manifest = JSON.parse(
        await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      );

      expect(manifest.entries).toEqual([
        {
          audio_attribution: "Fixture Speaker",
          audio_page_url: undefined,
          audio_license: undefined,
          audio_source: "fixture",
          audio_speaker: undefined,
          audio_src: "assets/audio/term/term-taberu/term-taberu.ogg",
          entry_id: "term-taberu",
          entry_type: "term",
          pitch_accent: 2
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("writes pitch accent even when the entry has no audio metadata", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-no-audio-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
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

      return new Response(
        `
        <table>
          <tr id="word_7361">
            <td class="midashi">
              <div class="midashi_wrapper">
                <p class="midashi_word">進化</p>
              </div>
            </td>
            <td class="katsuyo katsuyo_jisho_js">
              <div class="katsuyo_proc">
                <p>
                  <span class="katsuyo_accent"><span class="accented_word"><span class=" accent_top mola_-3"><span class="inner"><span class="char">し</span></span></span><span class="mola_-2"><span class="inner"><span class="char">ん</span></span></span><span class="mola_-1"><span class="inner"><span class="char">か</span></span></span></span></span>
                </p>
              </div>
            </td>
          </tr>
        </table>
        `,
        { status: 200 }
      );
    });
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
        cacheRoot: path.join(tempDir, "cache")
      });

      const manifest = JSON.parse(
        await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      );

      expect(manifest.entries).toEqual([
        {
          entry_id: "term-shinka",
          entry_type: "term",
          pitch_accent: 1
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

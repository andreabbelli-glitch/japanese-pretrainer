import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractPitchAccentCandidatesFromOjadHtml,
  extractPitchAccentFromWiktionaryWikitext,
  fetchPitchAccentsForBundle,
  parsePitchAccentWordList,
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

  it("parses pitch accent word lists from tab-separated rows and JSON arrays", () => {
    expect(
      parsePitchAccentWordList(
        [
          "# comment",
          "食べる",
          "設定\tせってい",
          "未解決\tみかいけつ\tterm-mikai",
          "grammar-toki"
        ].join("\n")
      )
    ).toEqual([
      {
        raw: "食べる",
        word: "食べる"
      },
      {
        raw: "設定\tせってい",
        reading: "せってい",
        word: "設定"
      },
      {
        entryId: "term-mikai",
        raw: "未解決\tみかいけつ\tterm-mikai",
        reading: "みかいけつ",
        word: "未解決"
      },
      {
        entryId: "grammar-toki",
        raw: "grammar-toki"
      }
    ]);

    expect(
      parsePitchAccentWordList(
        JSON.stringify([
          "進化",
          {
            entry_id: "term-shinka",
            reading: "しんか",
            word: "進化"
          }
        ])
      )
    ).toEqual([
      {
        raw: "進化",
        word: "進化"
      },
      {
        entryId: "term-shinka",
        raw: '{"entry_id":"term-shinka","reading":"しんか","word":"進化"}',
        reading: "しんか",
        word: "進化"
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

      return new Response("Not Found", {
        status: 404,
        statusText: "Not Found"
      });
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
    const fetchMock = vi.fn(
      async () =>
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
          pitch_accent_source: "Wiktionary",
          pitch_accent_status: "resolved"
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("fetches only requested words from a bundle-scoped word array", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-words-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const fetchMock = vi.fn(async (url: string) => {
      if (
        url.includes("wiktionary") &&
        url.includes(encodeURIComponent("進化"))
      ) {
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

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const summary = await fetchPitchAccentsForBundle({
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
            },
            {
              aliases: [],
              id: "term-mishiyou",
              kind: "term",
              lemma: "未使用",
              meaningIt: "non usato",
              pitchAccent: undefined,
              reading: "みしよう",
              romaji: "mishiyou",
              source: {
                documentKind: "cards",
                filePath: "fixture.md",
                sequence: 1
              }
            }
          ]
        },
        network: {
          requestDelayMs: 0
        },
        words: ["進化"]
      });

      expect(summary.results).toHaveLength(1);
      expect(summary.results[0]).toMatchObject({
        entryId: "term-shinka",
        status: "resolved"
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

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
          pitch_accent_source: "Wiktionary",
          pitch_accent_status: "resolved"
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("reports unmatched requested words without querying pitch accent sources", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-unmatched-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const summary = await fetchPitchAccentsForBundle({
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
        },
        words: ["未登録"]
      });

      expect(summary.results).toEqual([]);
      expect(summary.requestedUnresolved).toEqual([
        {
          raw: "未登録",
          reason: "no glossary match for '未登録'"
        }
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("persists misses and retries only source errors on later runs", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-status-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const bundle = {
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
          id: "term-mikai",
          kind: "term" as const,
          lemma: "未解決",
          meaningIt: "irrisolto",
          pitchAccent: undefined,
          reading: "みかいけつ",
          romaji: "mikaiketsu",
          source: {
            documentKind: "cards" as const,
            filePath: "fixture.md",
            sequence: 0
          }
        },
        {
          aliases: [],
          id: "term-shougai",
          kind: "term" as const,
          lemma: "障害",
          meaningIt: "errore",
          pitchAccent: undefined,
          reading: "しょうがい",
          romaji: "shougai",
          source: {
            documentKind: "cards" as const,
            filePath: "fixture.md",
            sequence: 1
          }
        }
      ]
    };

    const firstFetchMock = vi.fn(async (url: string) => {
      if (
        url.includes("wiktionary") &&
        url.includes(encodeURIComponent("未解決"))
      ) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: "未解決",
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

      if (
        url.includes("wiktionary") &&
        url.includes(encodeURIComponent("みかいけつ"))
      ) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  missing: true,
                  title: "みかいけつ"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (
        url.includes("ojad") &&
        url.includes(encodeURIComponent("みかいけつ"))
      ) {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found"
        });
      }

      if (
        (url.includes("wiktionary") &&
          url.includes(encodeURIComponent("障害"))) ||
        (url.includes("wiktionary") &&
          url.includes(encodeURIComponent("しょうがい"))) ||
        (url.includes("ojad") && url.includes(encodeURIComponent("しょうがい")))
      ) {
        return new Response("Server Error", {
          status: 500,
          statusText: "Server Error"
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", firstFetchMock);

    try {
      await fetchPitchAccentsForBundle({
        bundle,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        }
      });

      const firstManifest = JSON.parse(
        await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      );

      expect(firstManifest.entries).toEqual([
        {
          entry_id: "term-mikai",
          entry_type: "term",
          pitch_accent_status: "miss"
        },
        {
          entry_id: "term-shougai",
          entry_type: "term",
          pitch_accent_status: "source_error"
        }
      ]);

      const secondFetchMock = vi.fn(async (url: string) => {
        if (url.includes(encodeURIComponent("障害"))) {
          return new Response(
            JSON.stringify({
              query: {
                pages: [
                  {
                    title: "障害",
                    revisions: [
                      {
                        slots: {
                          main: {
                            content:
                              "==Japanese==\n===Pronunciation===\n* {{ja-pron|しょうがい|acc=2|acc_ref=NHK}}\n"
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

        throw new Error(`Unexpected URL: ${url}`);
      });
      vi.stubGlobal("fetch", secondFetchMock);

      await fetchPitchAccentsForBundle({
        bundle,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        }
      });

      const requestedUrls = secondFetchMock.mock.calls.map(([url]) =>
        String(url)
      );

      expect(
        requestedUrls.some(
          (url) =>
            url.includes(encodeURIComponent("未解決")) ||
            url.includes(encodeURIComponent("みかいけつ"))
        )
      ).toBe(false);

      const secondManifest = JSON.parse(
        await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      );

      expect(secondManifest.entries).toEqual([
        {
          entry_id: "term-mikai",
          entry_type: "term",
          pitch_accent_status: "miss"
        },
        {
          entry_id: "term-shougai",
          entry_type: "term",
          pitch_accent: 2,
          pitch_accent_page_url:
            "https://en.wiktionary.org/wiki/%E9%9A%9C%E5%AE%B3",
          pitch_accent_source: "Wiktionary",
          pitch_accent_status: "resolved"
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

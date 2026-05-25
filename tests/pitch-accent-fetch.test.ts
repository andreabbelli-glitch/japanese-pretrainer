import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractPitchAccentCandidatesFromOjadHtml,
  extractPitchAccentFromWiktionaryWikitext,
  fetchPitchAccentsForBundle,
  parsePitchAccentWordList,
  resolvePitchAccentForEntry
} from "@/lib/pitch-accent-fetch";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const validContentRoot = path.resolve(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

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

  it("rejects unknown CLI flags before running the pitch accent workflow", async () => {
    await expect(
      runPitchAccentCli(
        "--content-root",
        validContentRoot,
        "--dry-run",
        "--limit=0",
        "--bogus"
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Unknown argument: --bogus")
    });
  }, 60_000);

  it("rejects missing numeric CLI option values before running the pitch accent workflow", async () => {
    await expect(
      runPitchAccentCli(
        "--content-root",
        validContentRoot,
        "--media",
        "__missing__",
        "--limit",
        "--dry-run"
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --limit.")
    });
  }, 60_000);

  it("rejects unsafe numeric CLI options before running the pitch accent workflow", async () => {
    await expect(
      runPitchAccentCli(
        "--content-root",
        validContentRoot,
        "--dry-run",
        "--max-retries=9007199254740993"
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--max-retries must be a safe non-negative integer."
      )
    });
  }, 60_000);

  it.each([
    "--entry-delay-ms",
    "--request-delay-ms",
    "--request-timeout-ms",
    "--retry-base-delay-ms"
  ])(
    "rejects %s values above Node's maximum timer delay before running the pitch accent workflow",
    async (flag) => {
      await expect(
        runPitchAccentCli(
          "--content-root",
          validContentRoot,
          "--dry-run",
          "--limit=0",
          `${flag}=2147483648`
        )
      ).rejects.toMatchObject({
        stderr: expect.stringContaining(
          `${flag} must be at most 2147483647 ms.`
        )
      });
    },
    60_000
  );

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

  it("resolves a unique Kanjium match before network sources", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanjium-"));
    const kanjiumDataPath = path.join(tempDir, "kanjium-accents.txt");
    await writeFile(
      kanjiumDataPath,
      ["二人\tふたり\t3", "取り戻す\tとりもどす\t4,0"].join("\n")
    );
    const fetchMock = vi.fn(async () => {
      throw new Error("Network sources should not be queried.");
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await resolvePitchAccentForEntry({
        entry: {
          aliases: [],
          id: "term-futari",
          kind: "term",
          label: "二人",
          mediaDirectory: "/tmp/fixture",
          mediaSlug: "fixture",
          reading: "ふたり"
        },
        kanjiumDataPath,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        },
        sources: ["kanjium", "jiten"]
      });

      expect(result).toMatchObject({
        pitchAccent: 3,
        source: {
          pageUrl:
            "https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt",
          sourceLabel: "Kanjium"
        },
        status: "resolved"
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("uses Jiten to disambiguate a multi-accent Kanjium match", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanjium-jiten-"));
    const kanjiumDataPath = path.join(tempDir, "kanjium-accents.txt");
    await writeFile(kanjiumDataPath, "取り戻す\tとりもどす\t4,0\n");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("api.jiten.moe/api/vocabulary/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                wordId: 1713890,
                readingIndex: 0,
                text: "取り戻す",
                rubyText: "取[と]り戻[もど]す"
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (url.includes("api.jiten.moe/api/vocabulary/1713890/0/info")) {
        return new Response(
          JSON.stringify({
            mainReading: {
              text: "取[と]り戻[もど]す",
              readingIndex: 0
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
          id: "term-torimodosu",
          kind: "term",
          label: "取り戻す",
          mediaDirectory: "/tmp/fixture",
          mediaSlug: "fixture",
          reading: "とりもどす"
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

  it("reports fuzzy Kanjium candidates as review_required without writing a miss", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanjium-review-"));
    const mediaDirectory = path.join(tempDir, "media", "fixture");
    const kanjiumDataPath = path.join(tempDir, "kanjium-accents.txt");
    await writeFile(kanjiumDataPath, "切り替える\tきりかえる\t4,3,0\n");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("api.jiten.moe")) {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found"
        });
      }

      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  missing: true,
                  title: "切りかえる"
                }
              ]
            }
          }),
          { status: 200 }
        );
      }

      if (url.includes("ojad")) {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found"
        });
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
              id: "term-kirikaeru",
              kind: "term",
              lemma: "切りかえる",
              meaningIt: "cambiare",
              pitchAccent: undefined,
              reading: "きりかえる",
              romaji: "kirikaeru",
              source: {
                documentKind: "cards",
                filePath: "fixture.md",
                sequence: 0
              }
            }
          ]
        },
        kanjiumDataPath,
        network: {
          requestDelayMs: 0
        },
        sources: ["kanjium"]
      });

      expect(summary.reviewRequired).toBe(1);
      expect(summary.missed).toBe(0);
      expect(summary.results[0]).toMatchObject({
        candidates: [
          {
            matchType: "fuzzy",
            pitchAccents: [4, 3, 0],
            reading: "きりかえる",
            sourceLabel: "Kanjium",
            surface: "切り替える"
          }
        ],
        entryId: "term-kirikaeru",
        status: "review_required"
      });

      await expect(
        readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      ).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("reads pitch accents from a minimal Shirabe dictionary fixture", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-shirabe-"));
    const shirabeAppPath = path.join(tempDir, "Shirabe Jisho.app");
    const dictPath = path.join(shirabeAppPath, "Wrapper", "jisho.app", "dict");
    await mkdir(path.dirname(dictPath), { recursive: true });
    await writeFile(dictPath, buildMinimalShirabeDictFixture());
    const fetchMock = vi.fn(async () => {
      throw new Error("Network sources should not be queried.");
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await resolvePitchAccentForEntry({
        entry: {
          aliases: [],
          id: "term-futari",
          kind: "term",
          label: "二人",
          mediaDirectory: "/tmp/fixture",
          mediaSlug: "fixture",
          reading: "ふたり"
        },
        network: {
          requestDelayMs: 0
        },
        shirabeAppPath,
        sources: ["shirabe"]
      });

      expect(result).toMatchObject({
        pitchAccent: 3,
        source: {
          sourceLabel: "Shirabe Jisho"
        },
        status: "resolved"
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
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
      },
      sources: ["wiktionary", "ojad", "jiten"]
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
      },
      sources: ["wiktionary", "ojad"]
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
      },
      sources: ["wiktionary", "ojad"]
    });

    expect(result).toEqual({
      entryId: "grammar-toki",
      kind: "grammar",
      status: "miss"
    });
  });

  it("falls back to Jiten when Wiktionary and OJAD do not resolve", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: "覚悟",
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

      if (url.includes("ojad")) {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found"
        });
      }

      if (url.includes("api.jiten.moe/api/vocabulary/search")) {
        return new Response(
          JSON.stringify({
            query: "覚悟",
            queryType: "japanese",
            results: [
              {
                wordId: 1206080,
                readingIndex: 0,
                text: "覚悟",
                rubyText: "覚[かく]悟[ご]",
                partsOfSpeech: ["n", "vs", "vt"],
                meanings: ["readiness"],
                frequencyRank: 725
              }
            ],
            dictionaryResults: [],
            hasMore: false
          }),
          { status: 200 }
        );
      }

      if (url.includes("api.jiten.moe/api/vocabulary/1206080/0/info")) {
        return new Response(
          JSON.stringify({
            wordId: 1206080,
            mainReading: {
              text: "覚[かく]悟[ご]",
              readingIndex: 0
            },
            alternativeReadings: [],
            pitchAccents: [1]
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePitchAccentForEntry({
      entry: {
        aliases: [],
        id: "term-kakugo",
        kind: "term",
        label: "覚悟",
        mediaDirectory: "/tmp/fixture",
        mediaSlug: "fixture",
        reading: "かくご"
      },
      network: {
        requestDelayMs: 0
      },
      sources: ["wiktionary", "ojad", "jiten"]
    });

    expect(result).toMatchObject({
      pitchAccent: 1,
      source: {
        pageUrl: "https://jiten.moe/vocabulary/1206080/0",
        sourceLabel: "Jiten"
      },
      status: "resolved"
    });
  });

  it("can restrict lookups to Jiten only", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary") || url.includes("ojad")) {
        throw new Error(`Unexpected non-Jiten URL: ${url}`);
      }

      if (url.includes("api.jiten.moe/api/vocabulary/search")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                wordId: 1206080,
                readingIndex: 0,
                text: "覚悟",
                rubyText: "覚[かく]悟[ご]"
              }
            ]
          }),
          { status: 200 }
        );
      }

      if (url.includes("api.jiten.moe/api/vocabulary/1206080/0/info")) {
        return new Response(
          JSON.stringify({
            mainReading: {
              text: "覚[かく]悟[ご]",
              readingIndex: 0
            },
            pitchAccents: [1]
          }),
          { status: 200 }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolvePitchAccentForEntry({
      entry: {
        aliases: [],
        id: "term-kakugo",
        kind: "term",
        label: "覚悟",
        mediaDirectory: "/tmp/fixture",
        mediaSlug: "fixture",
        reading: "かくご"
      },
      network: {
        requestDelayMs: 0
      },
      sources: ["jiten"]
    });

    expect(result).toMatchObject({
      pitchAccent: 1,
      source: {
        sourceLabel: "Jiten"
      },
      status: "resolved"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown pitch accent source filters before running the workflow", async () => {
    await expect(
      runPitchAccentCli(
        "--content-root",
        validContentRoot,
        "--dry-run",
        "--limit=0",
        "--source",
        "invalid"
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "--source must be one of: kanjium, shirabe, jiten, wiktionary, ojad."
      )
    });
  }, 60_000);

  it("accepts offline source filters and a Shirabe app path in the CLI", async () => {
    const result = await runPitchAccentCli(
      "--content-root",
      validContentRoot,
      "--dry-run",
      "--limit=0",
      "--source",
      "kanjium",
      "--source",
      "shirabe",
      "--shirabe-app-path",
      "/tmp/missing-shirabe.app"
    );

    expect(result.stdout).toContain(
      "0 resolved, 0 misses, 0 errors, 0 review required"
    );
  }, 60_000);

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
        },
        sources: ["wiktionary"]
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
        sources: ["wiktionary"],
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
        url.includes("api.jiten.moe") &&
        (url.includes(encodeURIComponent("未解決")) ||
          url.includes(encodeURIComponent("みかいけつ")))
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
        },
        sources: ["wiktionary", "ojad", "jiten"]
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
        },
        sources: ["wiktionary", "ojad", "jiten"]
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

  it("retries persisted misses only when retryMisses is enabled", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-pitch-retry-miss-"));
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
          id: "term-kakugo",
          kind: "term" as const,
          lemma: "覚悟",
          meaningIt: "prontezza",
          pitchAccent: undefined,
          reading: "かくご",
          romaji: "kakugo",
          source: {
            documentKind: "cards" as const,
            filePath: "fixture.md",
            sequence: 0
          }
        }
      ]
    };

    const missFetchMock = vi.fn(async (url: string) => {
      if (url.includes("wiktionary")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  title: "覚悟",
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

      if (url.includes("ojad") || url.includes("api.jiten.moe")) {
        return new Response("Not Found", {
          status: 404,
          statusText: "Not Found"
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", missFetchMock);

    try {
      await fetchPitchAccentsForBundle({
        bundle,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        },
        sources: ["wiktionary", "ojad", "jiten"]
      });

      const skippedFetchMock = vi.fn(
        async () => new Response("{}", { status: 200 })
      );
      vi.stubGlobal("fetch", skippedFetchMock);

      const skippedSummary = await fetchPitchAccentsForBundle({
        bundle,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        },
        sources: ["wiktionary", "ojad", "jiten"]
      });

      expect(skippedSummary.results).toEqual([]);
      expect(skippedFetchMock).not.toHaveBeenCalled();

      const jitenFetchMock = vi.fn(async (url: string) => {
        if (url.includes("wiktionary")) {
          return new Response(
            JSON.stringify({
              query: {
                pages: [
                  {
                    title: "覚悟",
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

        if (url.includes("ojad")) {
          return new Response("Not Found", {
            status: 404,
            statusText: "Not Found"
          });
        }

        if (url.includes("api.jiten.moe/api/vocabulary/search")) {
          return new Response(
            JSON.stringify({
              query: "覚悟",
              queryType: "japanese",
              results: [
                {
                  wordId: 1206080,
                  readingIndex: 0,
                  text: "覚悟",
                  rubyText: "覚[かく]悟[ご]",
                  partsOfSpeech: ["n", "vs", "vt"],
                  meanings: ["readiness"],
                  frequencyRank: 725
                }
              ],
              dictionaryResults: [],
              hasMore: false
            }),
            { status: 200 }
          );
        }

        if (url.includes("api.jiten.moe/api/vocabulary/1206080/0/info")) {
          return new Response(
            JSON.stringify({
              wordId: 1206080,
              mainReading: {
                text: "覚[かく]悟[ご]",
                readingIndex: 0
              },
              alternativeReadings: [],
              pitchAccents: [1]
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unexpected URL: ${url}`);
      });
      vi.stubGlobal("fetch", jitenFetchMock);

      const retriedSummary = await fetchPitchAccentsForBundle({
        bundle,
        network: {
          maxRetries: 0,
          requestDelayMs: 0
        },
        retryMisses: true,
        sources: ["wiktionary", "ojad", "jiten"]
      });

      expect(retriedSummary.results).toHaveLength(1);
      expect(retriedSummary.results[0]).toMatchObject({
        entryId: "term-kakugo",
        pitchAccent: 1,
        status: "resolved"
      });

      const manifest = JSON.parse(
        await readFile(path.join(mediaDirectory, "pronunciations.json"), "utf8")
      );

      expect(manifest.entries).toEqual([
        {
          entry_id: "term-kakugo",
          entry_type: "term",
          pitch_accent: 1,
          pitch_accent_page_url: "https://jiten.moe/vocabulary/1206080/0",
          pitch_accent_source: "Jiten",
          pitch_accent_status: "resolved"
        }
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

function runPitchAccentCli(...args: string[]) {
  return execFileAsync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.join(repoRoot, "scripts", "fetch-pitch-accents.ts"),
      ...args
    ],
    {
      cwd: repoRoot
    }
  );
}

function buildMinimalShirabeDictFixture() {
  return Buffer.concat([
    Buffer.from([0x00, 0x07, 0x4e, 0x26, 0x18, 0x00]),
    buildShirabeUtf16Field(0x01, "二人"),
    buildShirabeUtf16Field(0x01, "２人"),
    buildShirabeUtf16Field(0x02, "ふたり"),
    Buffer.from([0x09, 0x03]),
    buildShirabeUtf16Field(0x02, "ににん"),
    Buffer.from([0x09, 0x02, 0x05])
  ]);
}

function buildShirabeUtf16Field(tag: number, value: string) {
  const text = Buffer.from(value, "utf16le");
  const header = Buffer.alloc(4);
  header[0] = tag;
  header[1] = 0x80;
  header.writeUInt16LE(text.length, 2);
  return Buffer.concat([header, text]);
}

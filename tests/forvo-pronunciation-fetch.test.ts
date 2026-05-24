import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  assertForvoManualRunCanStart,
  buildForvoSearchQueries,
  buildForvoWordUrls,
  parseForvoCandidateText,
  parseForvoWordList,
  scoreForvoCandidate,
  selectBestForvoCandidate
} from "@/lib/forvo-pronunciation-fetch";

const execFileAsync = promisify(execFile);
const fetchForvoScriptPath = path.join(
  process.cwd(),
  "scripts",
  "fetch-forvo-pronunciations.ts"
);
const validContentRoot = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "valid",
  "content"
);

describe("forvo pronunciation helpers", () => {
  it("parses plain-text or TSV word lists", () => {
    expect(
      parseForvoWordList(
        [
          "# comment",
          "食べる",
          "設定\tせってい",
          "ている\tている\tgrammar-teiru",
          "term-taberu"
        ].join("\n")
      )
    ).toEqual([
      { raw: "食べる", word: "食べる" },
      { raw: "設定\tせってい", reading: "せってい", word: "設定" },
      {
        entryId: "grammar-teiru",
        raw: "ている\tている\tgrammar-teiru",
        reading: "ている",
        word: "ている"
      },
      { entryId: "term-taberu", raw: "term-taberu" }
    ]);
  });

  it("parses candidate metadata from the Forvo row text", () => {
    expect(
      parseForvoCandidateText(
        "Pronunciation by o_mizu (Female from Japan) 8 votes Good Bad Accent: Tokyo Download MP3"
      )
    ).toEqual({
      accent: "Tokyo",
      speaker: "o_mizu",
      speakerCountry: "Japan",
      speakerGender: "Female",
      text: "Pronunciation by o_mizu (Female from Japan) 8 votes Good Bad Accent: Tokyo Download MP3",
      votes: 8
    });
  });

  it("normalizes furigana markup before building Forvo search URLs", () => {
    expect(
      buildForvoWordUrls({
        aliases: [],
        id: "grammar-tabenagara",
        kind: "grammar",
        label: "{{食|た}}べながら",
        mediaDirectory: "/tmp/media",
        mediaSlug: "sample",
        reading: "たべながら"
      })
    ).toEqual([
      "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%81%AA%E3%81%8C%E3%82%89/#ja",
      "https://forvo.com/word/%E3%81%9F%E3%81%B9%E3%81%AA%E3%81%8C%E3%82%89/#ja"
    ]);
  });

  it("derives only Japanese lookup text from grammar patterns", () => {
    const base = {
      aliases: [],
      id: "grammar-sample",
      kind: "grammar" as const,
      mediaDirectory: "/tmp/media",
      mediaSlug: "sample"
    };

    expect(
      buildForvoSearchQueries({
        ...base,
        label: "radice verbale + に行く／に来る"
      })
    ).toEqual(["に行く", "に来る"]);
    expect(
      buildForvoSearchQueries({
        ...base,
        label: "消える vs 消す"
      })
    ).toEqual(["消える", "消す"]);
    expect(
      buildForvoSearchQueries({
        ...base,
        label: "domanda negativa"
      })
    ).toEqual([]);
  });

  it("prefers readings for mixed Latin and Japanese labels", () => {
    const base = {
      aliases: [],
      kind: "term" as const,
      mediaDirectory: "/tmp/media",
      mediaSlug: "sample"
    };

    expect(
      buildForvoSearchQueries({
        ...base,
        id: "term-d2-field",
        label: "D2フィールド",
        reading: "ディーツーフィールド"
      })
    ).toEqual(["ディーツーフィールド"]);
    expect(
      buildForvoSearchQueries({
        ...base,
        id: "term-dm-point",
        label: "DMポイント",
        reading: "ディーエムポイント"
      })
    ).toEqual(["ディーエムポイント"]);
    expect(
      buildForvoSearchQueries({
        ...base,
        id: "term-g-neo-creature",
        label: "G-NEOクリーチャー",
        reading: "ジーネオクリーチャー"
      })
    ).toEqual(["ジーネオクリーチャー"]);
  });

  it("prefers the most likely native and highly rated candidate", () => {
    const candidates = [
      {
        candidateIndex: 0,
        pageUrl: "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja",
        sectionIndex: 0,
        speaker: "o_mizu",
        speakerCountry: "Japan",
        speakerGender: "Female",
        text: "Pronunciation by o_mizu (Female from Japan)",
        votes: 8
      },
      {
        candidateIndex: 1,
        pageUrl: "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja",
        sectionIndex: 1,
        speaker: "learner123",
        speakerCountry: "Italy",
        speakerGender: "Male",
        text: "Pronunciation by learner123 (Male from Italy)",
        votes: 10
      }
    ];

    expect(scoreForvoCandidate(candidates[0]!)).toBeGreaterThan(
      scoreForvoCandidate(candidates[1]!)
    );
    expect(selectBestForvoCandidate(candidates)?.speaker).toBe("o_mizu");
  });

  it("prefers configured Forvo speakers before falling back to vote count", () => {
    const candidates = [
      {
        candidateIndex: 0,
        pageUrl: "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja",
        sectionIndex: 0,
        speaker: "o_mizu",
        speakerCountry: "Japan",
        speakerGender: "Female",
        text: "Pronunciation by o_mizu (Female from Japan)",
        votes: 99
      },
      {
        candidateIndex: 1,
        pageUrl: "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja",
        sectionIndex: 1,
        speaker: "mezashi",
        speakerCountry: "Japan",
        speakerGender: "Female",
        text: "Pronunciation by mezashi (Female from Japan)",
        votes: 0
      },
      {
        candidateIndex: 2,
        pageUrl: "https://forvo.com/word/%E9%A3%9F%E3%81%B9%E3%82%8B/#ja",
        sectionIndex: 2,
        speaker: "strawberrybrown",
        speakerCountry: "Japan",
        speakerGender: "Female",
        text: "Pronunciation by strawberrybrown (Female from Japan)",
        votes: 0
      }
    ];

    expect(selectBestForvoCandidate(candidates)?.speaker).toBe(
      "strawberrybrown"
    );
    expect(selectBestForvoCandidate(candidates.slice(0, 2))?.speaker).toBe(
      "mezashi"
    );
  });

  it("rejects manual Forvo runs without an interactive TTY", () => {
    expect(() =>
      assertForvoManualRunCanStart({
        openWordAddOnSkip: true,
        stdinIsTTY: false,
        stdoutIsTTY: true
      })
    ).toThrow(/interactive TTY/iu);

    expect(() =>
      assertForvoManualRunCanStart({
        openWordAddOnSkip: true,
        stdinIsTTY: true,
        stdoutIsTTY: false
      })
    ).toThrow(/interactive TTY/iu);

    expect(() =>
      assertForvoManualRunCanStart({
        openWordAddOnSkip: true,
        stdinIsTTY: true,
        stdoutIsTTY: true
      })
    ).not.toThrow();
  });

  it("keeps the Forvo word-add prefill enabled for skipped entries", () => {
    expect(() =>
      assertForvoManualRunCanStart({
        openWordAddOnSkip: false,
        stdinIsTTY: true,
        stdoutIsTTY: true
      })
    ).toThrow(/word-add request prefill/iu);
  });

  it("fails the manual CLI before content work when no TTY is attached", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          fetchForvoScriptPath,
          "--manual",
          "--dry-run",
          "--content-root",
          validContentRoot,
          "--limit",
          "0"
        ],
        { cwd: process.cwd() }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("interactive TTY")
    });
  }, 60_000);

  it("rejects unknown manual CLI flags before starting the workflow", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          fetchForvoScriptPath,
          "--bogus",
          "--manual",
          "--dry-run",
          "--content-root",
          validContentRoot,
          "--limit",
          "0"
        ],
        { cwd: process.cwd() }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Unknown argument: --bogus")
    });
  }, 60_000);

  it("rejects missing CLI option values before treating later flags as request data", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          fetchForvoScriptPath,
          "--content-root",
          validContentRoot,
          "--word",
          "--manual",
          "--dry-run",
          "--limit",
          "0"
        ],
        { cwd: process.cwd() }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("Missing value for --word.")
    });
  }, 60_000);

  it.each([
    ["--control-port", "0", "positive integer"],
    ["--control-port", "9007199254740993", "safe positive integer"],
    ["--limit", "two", "non-negative integer"],
    ["--limit", "9007199254740993", "safe non-negative integer"],
    ["--browser-timeout-ms", "1s", "positive integer"],
    ["--browser-timeout-ms", "2147483648", "at most 2147483647 ms"]
  ])(
    "rejects invalid %s values before starting the workflow",
    async (flag, value, expectedMessage) => {
      await expect(
        execFileAsync(
          process.execPath,
          [
            "--experimental-strip-types",
            fetchForvoScriptPath,
            "--content-root",
            validContentRoot,
            flag,
            value,
            "--dry-run"
          ],
          { cwd: process.cwd() }
        )
      ).rejects.toMatchObject({
        stderr: expect.stringContaining(
          expectedMessage.startsWith("at most")
            ? `${flag} must be ${expectedMessage}.`
            : `${flag} must be a ${expectedMessage}.`
        )
      });
    },
    60_000
  );

  it("fails the CLI when the word-add prefill is disabled", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          fetchForvoScriptPath,
          "--no-open-word-add-on-skip",
          "--dry-run",
          "--content-root",
          validContentRoot,
          "--limit",
          "0"
        ],
        { cwd: process.cwd() }
      )
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("word-add request prefill")
    });
  }, 60_000);
});

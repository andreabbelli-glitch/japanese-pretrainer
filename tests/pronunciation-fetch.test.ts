import { describe, expect, it } from "vitest";

import {
  extractCommonsFileTitlesFromWiktionaryWikitext,
  extractSpokenTextFromCommonsTitle,
  normalizePronunciationText,
  parseRetryAfterMs,
  scorePronunciationCandidate,
  selectBestPronunciationCandidate,
  type PronunciationCandidate,
  type PronunciationTargetEntry
} from "@/lib/pronunciation-fetch";

describe("pronunciation fetch helpers", () => {
  const target: PronunciationTargetEntry = {
    aliases: ["taberu", "たべる"],
    id: "term-taberu",
    kind: "term",
    label: "食べる",
    mediaDirectory: "/tmp/frieren",
    mediaSlug: "frieren",
    reading: "たべる"
  };

  it("normalizes query strings and extracts Japanese spoken text from Commons file titles", () => {
    expect(normalizePronunciationText("～ ている / てる")).toBe("ているてる");
    expect(
      extractSpokenTextFromCommonsTitle(
        "File:LL-Q188 (jpn)-Speaker Name-食べる.ogg"
      )
    ).toBe("食べる");
    expect(extractSpokenTextFromCommonsTitle("File:Ja-ている.mp3")).toBe(
      "ている"
    );
  });

  it("parses Commons file titles from Wiktionary wikitext", () => {
    const source = `
{{audio|ja|Ja-ている.mp3|Audio}}
{{ja-pron|せってい|acc=0|a=Ja-settei-setting.ogg}}
[[File:LL-Q188 (jpn)-Speaker-食べる.ogg|thumb]]
`;

    expect(
      extractCommonsFileTitlesFromWiktionaryWikitext(source).sort()
    ).toEqual([
      "File:Ja-settei-setting.ogg",
      "File:Ja-ている.mp3",
      "File:LL-Q188 (jpn)-Speaker-食べる.ogg"
    ]);
  });

  it("parses ja-pron audio filenames from ja.wiktionary-style templates", () => {
    const source = `
=={{ja}}==
{{ja-pron|ボタン|a=Ja-botan-anglonative.oga}}
`;

    expect(extractCommonsFileTitlesFromWiktionaryWikitext(source)).toEqual([
      "File:Ja-botan-anglonative.oga"
    ]);
  });

  it("prefers exact Lingua Libre matches with richer metadata", () => {
    const candidates: PronunciationCandidate[] = [
      {
        fileTitle: "File:Ja-食べる.mp3",
        fileUrl: "https://commons.wikimedia.org/file/ja-taberu.mp3",
        pageUrl: "https://commons.wikimedia.org/wiki/File:Ja-%E9%A3%9F%E3%81%B9%E3%82%8B.mp3",
        source: "wikimedia_commons",
        spokenText: "食べる"
      },
      {
        attribution: "Native Speaker via Lingua Libre",
        fileTitle: "File:LL-Q188 (jpn)-Native Speaker-食べる.ogg",
        fileUrl: "https://commons.wikimedia.org/file/ll-taberu.ogg",
        license: "CC BY-SA 4.0",
        pageUrl: "https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Native_Speaker-%E9%A3%9F%E3%81%B9%E3%82%8B.ogg",
        source: "lingua_libre",
        speaker: "Native Speaker",
        spokenText: "食べる"
      }
    ];

    expect(
      scorePronunciationCandidate(target, candidates[1]!)
    ).toBeGreaterThan(scorePronunciationCandidate(target, candidates[0]!));
    expect(selectBestPronunciationCandidate(target, candidates)?.fileTitle).toBe(
      "File:LL-Q188 (jpn)-Native Speaker-食べる.ogg"
    );
  });

  it("rejects ambiguous candidates that do not exactly match lemma, reading, or aliases", () => {
    const ambiguousCandidate: PronunciationCandidate = {
      fileTitle: "File:LL-Q188 (jpn)-Speaker-食い物.ogg",
      fileUrl: "https://commons.wikimedia.org/file/kuimono.ogg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Speaker-%E9%A3%9F%E3%81%84%E7%89%A9.ogg",
      source: "lingua_libre",
      spokenText: "食い物"
    };

    expect(scorePronunciationCandidate(target, ambiguousCandidate)).toBe(
      Number.NEGATIVE_INFINITY
    );
    expect(
      selectBestPronunciationCandidate(target, [ambiguousCandidate])
    ).toBeNull();
  });

  it("rejects non-audio Commons files even if the title text matches", () => {
    const myPageTarget: PronunciationTargetEntry = {
      aliases: ["マイページ", "まいぺーじ"],
      id: "term-mypage",
      kind: "term",
      label: "MY PAGE",
      mediaDirectory: "/tmp/gundam",
      mediaSlug: "gundam-arsenal-base",
      reading: "まいぺーじ"
    };
    const imageCandidate: PronunciationCandidate = {
      fileTitle: "File:My Page.png",
      fileUrl: "https://commons.wikimedia.org/file/mypage.png",
      mimeType: "image/png",
      pageUrl: "https://commons.wikimedia.org/wiki/File:My_Page.png",
      source: "wikimedia_commons",
      spokenText: "My Page"
    };

    expect(scorePronunciationCandidate(myPageTarget, imageCandidate)).toBe(
      Number.NEGATIVE_INFINITY
    );
    expect(selectBestPronunciationCandidate(myPageTarget, [imageCandidate])).toBeNull();
  });

  it("accepts Wiktionary-derived audio when the spoken text hint matches the entry", () => {
    const setteiTarget: PronunciationTargetEntry = {
      aliases: ["せってい"],
      id: "term-settings",
      kind: "term",
      label: "設定",
      mediaDirectory: "/tmp/duel",
      mediaSlug: "duel-masters-dm25",
      reading: "せってい"
    };
    const candidate: PronunciationCandidate = {
      fileTitle: "File:Ja-settei-setting.ogg",
      fileUrl: "https://commons.wikimedia.org/file/ja-settei-setting.ogg",
      mimeType: "application/ogg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Ja-settei-setting.ogg",
      source: "wikimedia_commons",
      spokenText: "設定"
    };

    expect(scorePronunciationCandidate(setteiTarget, candidate)).toBeGreaterThan(0);
    expect(selectBestPronunciationCandidate(setteiTarget, [candidate])?.fileTitle).toBe(
      "File:Ja-settei-setting.ogg"
    );
  });

  it("parses Retry-After values expressed in seconds", () => {
    expect(parseRetryAfterMs("7")).toBe(7000);
  });

  it("returns null for invalid Retry-After values", () => {
    expect(parseRetryAfterMs("not-a-date")).toBeNull();
    expect(parseRetryAfterMs(null)).toBeNull();
  });
});

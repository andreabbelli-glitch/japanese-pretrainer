import { describe, expect, it } from "vitest";

import {
  parseForvoCandidateText,
  parseForvoWordList,
  scoreForvoCandidate,
  selectBestForvoCandidate
} from "@/lib/forvo-pronunciation-fetch";

describe("forvo pronunciation helpers", () => {
  it("parses plain-text or TSV word lists", () => {
    expect(
      parseForvoWordList(
        ["# comment", "食べる", "設定\tせってい", "ている\tている\tgrammar-teiru", "term-taberu"].join(
          "\n"
        )
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
});

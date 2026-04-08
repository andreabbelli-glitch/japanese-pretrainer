import { describe, expect, it } from "vitest";

import {
  buildKanjiClashCandidate,
  buildKanjiClashPairKey,
  extractKanjiFromText,
  generateKanjiClashCandidates,
  type KanjiClashEligibleSubject
} from "@/lib/kanji-clash";

function buildSubject(
  input: Partial<KanjiClashEligibleSubject> & Pick<KanjiClashEligibleSubject, "label" | "subjectKey">
): KanjiClashEligibleSubject {
  const label = input.label;
  const reading = input.reading ?? null;

  return {
    entryType: "term",
    kanji: input.kanji ?? extractKanjiFromText(label),
    label,
    members:
      input.members ??
      [
        {
          entryId:
            input.source?.type === "entry"
              ? input.source.entryId
              : `${input.subjectKey}-member`,
          lemma: label,
          meaningIt: `${label} meaning`,
          mediaId: "media-fixture",
          mediaSlug: "fixture",
          mediaTitle: "Fixture",
          reading: reading ?? ""
        }
      ],
    reading,
    readingForms:
      input.readingForms ??
      (reading ? [reading] : []),
    reps: input.reps ?? 3,
    reviewState: input.reviewState ?? "review",
    source:
      input.source ??
      {
        entryId: input.subjectKey.replaceAll(":", "-"),
        type: "entry"
      },
    stability: input.stability ?? 8,
    subjectKey: input.subjectKey,
    surfaceForms: input.surfaceForms ?? [label]
  };
}

describe("kanji clash pairing helpers", () => {
  it("extracts kanji from inline markdown surfaces", () => {
    expect(extractKanjiFromText("{{食費|しょくひ}}")).toEqual(["食", "費"]);
  });

  it("builds pair keys as unordered canonical identifiers", () => {
    expect(buildKanjiClashPairKey("entry:term:zeta", "entry:term:alpha")).toBe(
      "entry:term:alpha::entry:term:zeta"
    );
  });

  it("excludes surface clones even when subject keys differ", () => {
    const first = buildSubject({
      label: "食費",
      reading: "しょくひ",
      subjectKey: "entry:term:alpha"
    });
    const clone = buildSubject({
      label: "食費",
      reading: "しょくひ",
      subjectKey: "entry:term:beta"
    });

    expect(buildKanjiClashCandidate(first, clone)).toBeNull();
  });

  it("deduplicates repeated pair generation across multiple shared kanji buckets", () => {
    const first = buildSubject({
      label: "情報量",
      reading: "じょうほうりょう",
      subjectKey: "entry:term:first"
    });
    const second = buildSubject({
      label: "情報学",
      reading: "じょうほうがく",
      subjectKey: "entry:term:second"
    });
    const third = buildSubject({
      label: "食費",
      reading: "しょくひ",
      subjectKey: "entry:term:third"
    });

    const candidates = generateKanjiClashCandidates([first, second, third]);

    expect(candidates.map((candidate) => candidate.pairKey)).toEqual([
      "entry:term:first::entry:term:second"
    ]);
    expect(candidates[0]?.sharedKanji).toEqual(["情", "報"]);
  });
});

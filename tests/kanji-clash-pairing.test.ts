import { describe, expect, it } from "vitest";

import {
  buildKanjiClashCandidate,
  buildKanjiClashContrastKey,
  buildKanjiClashContrastRoundKey,
  buildKanjiClashPairKey,
  extractKanjiFromText,
  generateKanjiClashCandidates,
  getKanjiClashPairExclusionReason,
  type KanjiClashEligibleSubject
} from "@/lib/kanji-clash";

function buildSubject(
  input: Partial<KanjiClashEligibleSubject> &
    Pick<KanjiClashEligibleSubject, "label" | "subjectKey">
): KanjiClashEligibleSubject {
  const label = input.label;
  const reading = input.reading ?? null;

  return {
    entryType: "term",
    kanji: input.kanji ?? extractKanjiFromText(label),
    label,
    members: input.members ?? [
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
    readingForms: input.readingForms ?? (reading ? [reading] : []),
    reps: input.reps ?? 3,
    reviewState: input.reviewState ?? "review",
    source: input.source ?? {
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

  it("reuses the unordered canonical key for manual contrast identity", () => {
    expect(
      buildKanjiClashContrastKey("entry:term:zeta", "entry:grammar:alpha")
    ).toBe("entry:grammar:alpha::entry:term:zeta");
  });

  it("builds directional manual contrast round keys per target endpoint", () => {
    const contrastKey = buildKanjiClashContrastKey(
      "entry:term:hold",
      "entry:term:wait"
    );

    expect(
      buildKanjiClashContrastRoundKey(contrastKey, "entry:term:hold")
    ).toBe("entry:term:hold::entry:term:wait::target:entry:term:hold");
    expect(
      buildKanjiClashContrastRoundKey(contrastKey, "entry:term:wait")
    ).toBe("entry:term:hold::entry:term:wait::target:entry:term:wait");
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

  it.each([
    ["一番下", "山札の一番下"],
    ["購入", "カード購入"],
    ["状態", "タップ状態"],
    ["選択", "ステージ選択"],
    ["図鑑", "ポケモン図鑑"],
    ["待って", "ちょっと待って"],
    ["呪文", "無色呪文"],
    ["対戦", "対戦開始"],
    ["開始", "対戦開始"],
    ["期限", "受け取り期限"],
    ["大きい", "最も大きい"],
    ["中", "開催中"],
    ["出す", "思い出す"]
  ])(
    "excludes qualified contained clones for %s vs %s",
    (shorterLabel, longerLabel) => {
      const shorter = buildSubject({
        label: shorterLabel,
        subjectKey: `entry:term:${shorterLabel}`
      });
      const longer = buildSubject({
        label: longerLabel,
        subjectKey: `entry:term:${longerLabel}`
      });

      expect(getKanjiClashPairExclusionReason(shorter, longer)).toBe(
        "qualified-contained-clone"
      );
      expect(buildKanjiClashCandidate(shorter, longer)).toBeNull();
    }
  );

  it.each([
    ["おすすめ編成", "パーティー編成"],
    ["おすすめ編成", "デッキ編成"],
    ["パーティー編成", "デッキ編成"],
    ["受け取る", "受け取り期限"],
    ["受け取る", "受け取り履歴"],
    ["受け取り履歴", "受け取り期限"],
    ["未受け取り", "一括受け取り"]
  ])("excludes shared lexical cores for %s vs %s", (leftLabel, rightLabel) => {
    const left = buildSubject({
      label: leftLabel,
      subjectKey: `entry:term:${leftLabel}`
    });
    const right = buildSubject({
      label: rightLabel,
      subjectKey: `entry:term:${rightLabel}`
    });

    expect(getKanjiClashPairExclusionReason(left, right)).toBe(
      "shared-lexical-core"
    );
    expect(buildKanjiClashCandidate(left, right)).toBeNull();
  });

  it.each([["山札の上から1枚目", "山札の一番下"]])(
    "excludes phrase-level contextual prefixes for %s vs %s",
    (leftLabel, rightLabel) => {
      const left = buildSubject({
        label: leftLabel,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBe(
        "shared-contextual-prefix"
      );
      expect(buildKanjiClashCandidate(left, right)).toBeNull();
    }
  );

  it.each([["山札の一番下", "一番上"]])(
    "excludes contextualized head families for %s vs %s",
    (leftLabel, rightLabel) => {
      const left = buildSubject({
        label: leftLabel,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBe(
        "contextualized-head-family"
      );
      expect(buildKanjiClashCandidate(left, right)).toBeNull();
    }
  );

  it.each([
    ["受け取る", "一括受け取り"],
    ["一括受け取り", "受け取り履歴"],
    ["一括受け取り", "受け取り期限"],
    ["未受け取り", "受け取り履歴"],
    ["未受け取り", "受け取り期限"]
  ])(
    "excludes cross-edge mixed stems for %s vs %s",
    (leftLabel, rightLabel) => {
      const left = buildSubject({
        label: leftLabel,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBe(
        "cross-edge-mixed-stem"
      );
      expect(buildKanjiClashCandidate(left, right)).toBeNull();
    }
  );

  it.each([
    ["ランク戦", "らんくせん", "ストラテジー戦", "すとらてじーせん"],
    ["行く", "いく", "行こう", "いこう"]
  ])(
    "excludes same kanji-core readings for %s vs %s",
    (leftLabel, leftReading, rightLabel, rightReading) => {
      const left = buildSubject({
        label: leftLabel,
        reading: leftReading,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        reading: rightReading,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBe(
        "same-kanji-core-reading"
      );
      expect(buildKanjiClashCandidate(left, right)).toBeNull();
    }
  );

  it.each([["道", "道具"]])(
    "keeps distinct pairs when the extra material is not a short qualifying edge for %s vs %s",
    (leftLabel, rightLabel) => {
      const left = buildSubject({
        label: leftLabel,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBeNull();
      expect(buildKanjiClashCandidate(left, right)).not.toBeNull();
    }
  );

  it.each([
    ["行う", "おこなう", "行く", "いく"],
    ["出す", "だす", "出る", "でる"],
    ["ランク戦", "らんくせん", "戦う", "たたかう"]
  ])(
    "keeps distinct pairs when the shared kanji core changes reading or edge role for %s vs %s",
    (leftLabel, leftReading, rightLabel, rightReading) => {
      const left = buildSubject({
        label: leftLabel,
        reading: leftReading,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        reading: rightReading,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBeNull();
      expect(buildKanjiClashCandidate(left, right)).not.toBeNull();
    }
  );

  it("builds a similar-kanji candidate when two compact surfaces differ by one allowed kanji swap", () => {
    const wait = buildSubject({
      kanji: ["待"],
      label: "待つ",
      reading: "まつ",
      subjectKey: "entry:term:wait"
    });
    const hold = buildSubject({
      kanji: ["持"],
      label: "持つ",
      reading: "もつ",
      subjectKey: "entry:term:hold"
    });
    const candidate = buildKanjiClashCandidate(wait, hold);

    expect(candidate).not.toBeNull();
    expect(candidate?.pairReasons).toEqual(["similar-kanji"]);
    expect(candidate?.sharedKanji).toEqual([]);
    expect(candidate?.similarKanjiSwaps).toEqual([
      {
        confidence: 0.5,
        leftKanji: "持",
        position: 0,
        rightKanji: "待"
      }
    ]);
  });

  it("normalizes inline-marked surfaces before checking similar-kanji swaps", () => {
    const wait = buildSubject({
      kanji: ["待"],
      label: "待つ",
      reading: "まつ",
      subjectKey: "entry:term:wait-inline",
      surfaceForms: ["{{待|ま}}つ"]
    });
    const hold = buildSubject({
      kanji: ["持"],
      label: "持つ",
      reading: "もつ",
      subjectKey: "entry:term:hold-inline",
      surfaceForms: ["{{持|も}}つ"]
    });
    const candidate = buildKanjiClashCandidate(wait, hold);

    expect(candidate).not.toBeNull();
    expect(candidate?.pairReasons).toEqual(["similar-kanji"]);
    expect(candidate?.sharedKanji).toEqual([]);
    expect(candidate?.similarKanjiSwaps).toEqual([
      {
        confidence: 0.5,
        leftKanji: "持",
        position: 0,
        rightKanji: "待"
      }
    ]);
  });

  it("keeps both reasons when a pair shares one kanji and swaps another confusable kanji", () => {
    const left = buildSubject({
      kanji: ["待", "機"],
      label: "待機",
      reading: "たいき",
      subjectKey: "entry:term:left"
    });
    const right = buildSubject({
      kanji: ["持", "機"],
      label: "持機",
      reading: "じき",
      subjectKey: "entry:term:right"
    });
    const candidate = buildKanjiClashCandidate(left, right);

    expect(candidate).not.toBeNull();
    expect(candidate?.pairReasons).toEqual(["shared-kanji", "similar-kanji"]);
    expect(candidate?.sharedKanji).toEqual(["機"]);
    expect(candidate?.similarKanjiSwaps).toEqual([
      {
        confidence: 0.5,
        leftKanji: "待",
        position: 0,
        rightKanji: "持"
      }
    ]);
  });

  it("rejects similar-kanji candidates when more than one position changes", () => {
    const left = buildSubject({
      kanji: ["待", "機"],
      label: "待機",
      reading: "たいき",
      subjectKey: "entry:term:left"
    });
    const right = buildSubject({
      kanji: ["持", "器"],
      label: "持器",
      reading: "じき",
      subjectKey: "entry:term:right"
    });

    expect(buildKanjiClashCandidate(left, right)).toBeNull();
  });

  it("rejects similar-kanji candidates when the okurigana schema changes", () => {
    const left = buildSubject({
      kanji: ["待"],
      label: "待つ",
      reading: "まつ",
      subjectKey: "entry:term:left"
    });
    const right = buildSubject({
      kanji: ["持"],
      label: "持た",
      reading: "もた",
      subjectKey: "entry:term:right"
    });

    expect(buildKanjiClashCandidate(left, right)).toBeNull();
  });

  it.each([["一番上", "一番下"]])(
    "keeps contrastive compounds that only share a structural prefix for %s vs %s",
    (leftLabel, rightLabel) => {
      const left = buildSubject({
        label: leftLabel,
        subjectKey: `entry:term:${leftLabel}`
      });
      const right = buildSubject({
        label: rightLabel,
        subjectKey: `entry:term:${rightLabel}`
      });

      expect(getKanjiClashPairExclusionReason(left, right)).toBeNull();
      expect(buildKanjiClashCandidate(left, right)).not.toBeNull();
    }
  );

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

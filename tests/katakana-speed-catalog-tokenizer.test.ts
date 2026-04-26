import { describe, expect, it } from "vitest";

import {
  countKatakanaMora,
  generateKatakanaSpeedPseudoWord,
  getKatakanaSpeedCatalog,
  getKatakanaSpeedConfusionClusters,
  getKatakanaSpeedItemById,
  formatKatakanaSpeedReading,
  tokenizeKatakanaDisplaySegments,
  tokenizeKatakanaMora
} from "@/features/katakana-speed/model";

describe("katakana speed catalog", () => {
  it("exposes the MVP core chunk catalog with stable IDs and frozen items", () => {
    const catalog = getKatakanaSpeedCatalog();
    const bySurface = new Map(catalog.map((item) => [item.surface, item]));

    expect(bySurface.get("シェ")?.id).toBe("chunk-she");
    expect(bySurface.get("ジェ")?.id).toBe("chunk-je");
    expect(bySurface.get("チェ")?.id).toBe("chunk-che");
    expect(bySurface.get("ティ")?.id).toBe("chunk-ti");
    expect(bySurface.get("ディ")?.id).toBe("chunk-di");
    expect(bySurface.get("トゥ")?.id).toBe("chunk-tu");
    expect(bySurface.get("ドゥ")?.id).toBe("chunk-du");
    expect(bySurface.get("デュ")?.id).toBe("chunk-dyu");
    expect(bySurface.get("ファ")?.id).toBe("chunk-fa");
    expect(bySurface.get("フィ")?.id).toBe("chunk-fi");
    expect(bySurface.get("フェ")?.id).toBe("chunk-fe");
    expect(bySurface.get("フォ")?.id).toBe("chunk-fo");
    expect(bySurface.get("フュ")?.id).toBe("chunk-fyu");
    expect(bySurface.get("ウィ")?.id).toBe("chunk-wi");
    expect(bySurface.get("ウェ")?.id).toBe("chunk-we");
    expect(bySurface.get("ウォ")?.id).toBe("chunk-wo");
    expect(bySurface.get("ヴァ")?.id).toBe("chunk-va");
    expect(bySurface.get("ヴィ")?.id).toBe("chunk-vi");
    expect(bySurface.get("ヴ")?.id).toBe("chunk-vu");
    expect(bySurface.get("ヴェ")?.id).toBe("chunk-ve");
    expect(bySurface.get("ヴォ")?.id).toBe("chunk-vo");

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog[0])).toBe(true);
  });

  it("has unique IDs and no dangling distractor references", () => {
    const catalog = getKatakanaSpeedCatalog();
    const ids = new Set(catalog.map((item) => item.id));

    expect(ids.size).toBe(catalog.length);
    for (const item of catalog) {
      for (const distractorId of item.distractorItemIds) {
        expect(ids.has(distractorId)).toBe(true);
      }
    }
  });

  it("includes visual single-kana and confusion clusters needed by the MVP", () => {
    expect(getKatakanaSpeedItemById("kana-shi")?.surface).toBe("シ");
    expect(getKatakanaSpeedItemById("kana-tsu")?.surface).toBe("ツ");
    expect(getKatakanaSpeedItemById("kana-so")?.surface).toBe("ソ");
    expect(getKatakanaSpeedItemById("kana-n")?.surface).toBe("ン");
    expect(getKatakanaSpeedItemById("kana-no")?.surface).toBe("ノ");
    expect(getKatakanaSpeedItemById("kana-me")?.surface).toBe("メ");
    expect(getKatakanaSpeedItemById("kana-nu")?.surface).toBe("ヌ");

    const clusters = getKatakanaSpeedConfusionClusters();
    expect(
      clusters.find((cluster) => cluster.id === "visual-shi-tsu-so-n")
    ).toMatchObject({ itemIds: ["kana-shi", "kana-tsu", "kana-so", "kana-n"] });
    expect(
      clusters.find((cluster) => cluster.id === "visual-no-me-nu")
    ).toMatchObject({ itemIds: ["kana-no", "kana-me", "kana-nu"] });
  });

  it("expands the static catalog with word, pseudoword, and sentence item types", () => {
    expect(getKatakanaSpeedItemById("word-security")?.surface).toBe(
      "セキュリティ"
    );
    expect(getKatakanaSpeedItemById("word-security")).toMatchObject({
      displaySegments: ["セ", "キュ", "リ", "ティ"],
      focusChunks: ["ティ"],
      kind: "word",
      moraCount: 4,
      tier: "A"
    });

    expect(getKatakanaSpeedItemById("pseudo-ti-rado")).toMatchObject({
      focusChunks: ["ティ"],
      kind: "pseudoword",
      surface: "ティラード",
      tier: "A"
    });

    expect(getKatakanaSpeedItemById("sentence-P01")).toMatchObject({
      focusChunks: ["ティ", "ファ", "チェ"],
      kind: "sentence",
      sentenceId: "P01"
    });
  });

  it("keeps a representative Tier A/B/C seed mix without renaming existing items", () => {
    expect(getKatakanaSpeedItemById("chunk-she")).toMatchObject({ tier: "A" });
    expect(getKatakanaSpeedItemById("chunk-wi")).toMatchObject({ tier: "B" });
    expect(getKatakanaSpeedItemById("chunk-si")).toMatchObject({
      surface: "スィ",
      tier: "C"
    });
    expect(getKatakanaSpeedItemById("word-quartet")).toMatchObject({
      focusChunks: ["クァ"],
      kind: "word",
      tier: "B"
    });
    expect(getKatakanaSpeedItemById("word-kierkegaard")).toMatchObject({
      focusChunks: ["キェ"],
      kind: "word",
      tier: "C"
    });
  });

  it("includes the phrase bank under stable P IDs", () => {
    const sentenceItems = getKatakanaSpeedCatalog().filter(
      (item) => item.kind === "sentence"
    );

    expect(sentenceItems).toHaveLength(60);
    expect(sentenceItems.map((item) => item.sentenceId)).toContain("P60");
    expect(getKatakanaSpeedItemById("sentence-P60")?.surface).toBe(
      "珍しい表記は、正解速度よりも一瞬で固まらないことを重視します。"
    );
  });

  it("generates pseudo words deterministically from chunk and seed", () => {
    expect(generateKatakanaSpeedPseudoWord({ chunk: "ティ", seed: 0 })).toBe(
      "ティトール"
    );
    expect(generateKatakanaSpeedPseudoWord({ chunk: "ティ", seed: 6 })).toBe(
      "ティミア"
    );
    expect(
      generateKatakanaSpeedPseudoWord({ chunk: "ティ", seed: "daily-1" })
    ).toBe(generateKatakanaSpeedPseudoWord({ chunk: "ティ", seed: "daily-1" }));
    expect(
      generateKatakanaSpeedPseudoWord({ chunk: "ディ", seed: "daily-1" })
    ).not.toBe(
      generateKatakanaSpeedPseudoWord({ chunk: "ティ", seed: "daily-1" })
    );
  });

  it("formats learner-facing romaji readings without exposing raw placeholders", () => {
    expect(formatKatakanaSpeedReading("メヴィラン")).toBe("meviran");
    expect(formatKatakanaSpeedReading("セキュリティ")).toBe("sekyuriti");
    expect(formatKatakanaSpeedReading("ヴョトール")).toBe("vyotooru");
    expect(formatKatakanaSpeedReading("ヴュートール")).toBe("vyuutooru");
    expect(formatKatakanaSpeedReading("フョトール")).toBe("fyotooru");
    expect(formatKatakanaSpeedReading("インタヴュー")).toBe("intavyuu");
    expect(formatKatakanaSpeedReading("ディスカッション")).toBe("disukasshon");
    expect(formatKatakanaSpeedReading("プロデューサー")).toBe("purodyuusaa");
    expect(formatKatakanaSpeedReading("ピッツァ")).toBe("pittsa");
    expect(formatKatakanaSpeedReading("ケース・バイ・ケース")).toBe(
      "keesu bai keesu"
    );
    expect(formatKatakanaSpeedReading("同じ")).toBeNull();
    expect(formatKatakanaSpeedReading("ツィ、スィ、ズィ")).toBeNull();

    const chunk = getKatakanaSpeedItemById("chunk-ti");
    expect(formatKatakanaSpeedReading(chunk)).toBe("ti");
  });

  it("matches static catalog readings for every single kana and extended chunk", () => {
    const checkedKinds = new Set(["single_kana", "extended_chunk"]);

    for (const item of getKatakanaSpeedCatalog()) {
      if (!checkedKinds.has(item.kind)) {
        continue;
      }

      expect(formatKatakanaSpeedReading(item.surface), item.id).toBe(
        item.reading
      );
    }
  });
});

describe("katakana tokenizer", () => {
  it.each([
    ["セキュリティ", ["セ", "キュ", "リ", "ティ"]],
    ["フィードバック", ["フィー", "ド", "バッ", "ク"]],
    ["ウェブサイト", ["ウェ", "ブ", "サ", "イ", "ト"]],
    ["プロデューサー", ["プ", "ロ", "デュー", "サー"]],
    ["ウォーキング", ["ウォー", "キン", "グ"]],
    ["ディスカッション", ["ディ", "ス", "カッ", "ショ", "ン"]]
  ])("segments %s for display without exposing romaji", (input, expected) => {
    expect(tokenizeKatakanaDisplaySegments(input)).toEqual(expected);
  });

  it.each([
    ["セキュリティ", ["セ", "キュ", "リ", "ティ"], 4],
    ["フィードバック", ["フィ", "ー", "ド", "バ", "ッ", "ク"], 6],
    ["オンライン", ["オ", "ン", "ラ", "イ", "ン"], 5],
    ["ディスカッション", ["ディ", "ス", "カ", "ッ", "ショ", "ン"], 6],
    [
      "ケース・バイ・ケース",
      ["ケ", "ー", "ス", "バ", "イ", "ケ", "ー", "ス"],
      8
    ]
  ])("counts ー/ッ/ン as mora in %s", (input, moraTokens, moraCount) => {
    expect(tokenizeKatakanaMora(input)).toEqual(moraTokens);
    expect(countKatakanaMora(input)).toBe(moraCount);
  });
});

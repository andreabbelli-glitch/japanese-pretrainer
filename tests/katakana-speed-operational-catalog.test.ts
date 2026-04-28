import { describe, expect, it } from "vitest";

import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedConfusionClusters,
  getKatakanaSpeedItemBySurface
} from "@/features/katakana-speed/model";
import { getKatakanaSpeedExerciseCatalog } from "@/features/katakana-speed/model/exercise-catalog";

describe("katakana speed operational exercise catalog", () => {
  it("materializes only the current training-loop exercise registry", () => {
    const exercises = getKatakanaSpeedExerciseCatalog();
    const supportedExerciseIds = exercises
      .filter((exercise) => exercise.supported)
      .map((exercise) => exercise.id);
    const audioExerciseIds = exercises
      .filter((exercise) => exercise.requiresAudio)
      .map((exercise) => exercise.id);

    expect(supportedExerciseIds).toEqual([
      "E01",
      "E02",
      "E03",
      "E04",
      "E10",
      "E12",
      "E13",
      "E15",
      "E16",
      "E18",
      "E20"
    ]);
    expect(audioExerciseIds).toEqual([]);
    expect(
      exercises.some((exercise) =>
        ["E08", "E09", "E14", "E17", "E21", "E22"].includes(exercise.id)
      )
    ).toBe(false);
  });

  it("adds the operational word bank seeds as static word items", () => {
    for (const surface of [
      "データベース",
      "ワークフロー",
      "クレジットカード",
      "ヴェルサイユ",
      "ソルジェニーツィン",
      "ケース・バイ・ケース"
    ]) {
      expect(getKatakanaSpeedItemBySurface(surface)).toMatchObject({
        kind: "word",
        surface
      });
    }
  });

  it("adds media katakana terms as static training words", () => {
    for (const [surface, sourceTag] of [
      ["アビスラッシュ", "media:duel-masters-dm25"],
      ["イモータルジャスティスガンダム", "media:gundam-arsenal-base"],
      ["テラスタルエネルギー", "media:pokemon-scarlet-violet"]
    ] as const) {
      expect(getKatakanaSpeedItemBySurface(surface)).toMatchObject({
        kind: "word",
        surface,
        tags: expect.arrayContaining(["media-word-bank", sourceTag])
      });
    }
    expect(
      getKatakanaSpeedCatalog().filter((item) =>
        item.tags.includes("media-word-bank")
      ).length
    ).toBeGreaterThan(140);
  });

  it("covers visual clusters V3 through V10 with reusable static items", () => {
    const clusters = getKatakanaSpeedConfusionClusters();

    expect(
      clusters.find((cluster) => cluster.id === "visual-wa-u-fu-ku")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-ko-ro-yu-yo")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-ma-mu")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-ra-fu-wo-wa")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-ta-ku-ke")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-ha-ba-pa")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-dakuon-core")
    ).toBeDefined();
    expect(
      clusters.find((cluster) => cluster.id === "visual-long-vowel-mark")
    ).toBeDefined();

    for (const surface of [
      "ワ",
      "ウ",
      "フ",
      "ロ",
      "ユ",
      "ヨ",
      "マ",
      "ム",
      "ヲ",
      "ケ",
      "バ",
      "パ",
      "ガ",
      "ザ",
      "デ",
      "ー"
    ]) {
      expect(getKatakanaSpeedItemBySurface(surface)).toBeDefined();
    }
  });

  it("keeps the operational word bank inside the static item catalog", () => {
    expect(
      getKatakanaSpeedCatalog().filter((item) =>
        item.tags.includes("operational-word-bank")
      ).length
    ).toBeGreaterThan(180);
  });
});

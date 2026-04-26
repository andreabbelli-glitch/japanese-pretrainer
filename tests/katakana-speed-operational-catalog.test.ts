import { describe, expect, it } from "vitest";

import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedConfusionClusters,
  getKatakanaSpeedItemBySurface
} from "@/features/katakana-speed/model";
import {
  getKatakanaSpeedChunkSpottingTargets,
  getKatakanaSpeedExerciseCatalog,
  getKatakanaSpeedLadderDefinitions,
  getKatakanaSpeedMoraTrapPairs,
  getKatakanaSpeedVariantPairs
} from "@/features/katakana-speed/model/exercise-catalog";

describe("katakana speed operational exercise catalog", () => {
  it("materializes the complete non-audio operational exercise registry", () => {
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
      "E05",
      "E08",
      "E09",
      "E10",
      "E11",
      "E12",
      "E13",
      "E14",
      "E15",
      "E16",
      "E17",
      "E18",
      "E20",
      "E21",
      "E22"
    ]);
    expect(audioExerciseIds).toEqual(["E06", "E07", "E19"]);
    expect(exercises.find((exercise) => exercise.id === "E22")).toMatchObject({
      defaultNoRomaji: true
    });
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

  it("exposes mora traps, variants, chunk spotting targets, and ladders", () => {
    expect(getKatakanaSpeedMoraTrapPairs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          correctSurface: "バッグ",
          trapSurface: "バグ",
          feature: "sokuon"
        }),
        expect.objectContaining({
          correctSurface: "サーバー",
          trapSurface: "サバ",
          feature: "long-vowel"
        })
      ])
    );
    expect(getKatakanaSpeedVariantPairs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          firstSurface: "ウイスキー",
          secondSurface: "ウィスキー"
        }),
        expect.objectContaining({
          firstSurface: "インタビュー",
          secondSurface: "インタヴュー"
        })
      ])
    );
    expect(getKatakanaSpeedChunkSpottingTargets()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chunk: "ティ",
          wordSurface: "セキュリティ"
        }),
        expect.objectContaining({
          chunk: "フュ",
          wordSurface: "フュージョン"
        })
      ])
    );
    expect(getKatakanaSpeedLadderDefinitions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ladder-di",
          targetSurface: "ディ"
        }),
        expect.objectContaining({
          id: "ladder-f-family",
          targetSurface: "フィ"
        })
      ])
    );

    expect(
      getKatakanaSpeedCatalog().filter((item) =>
        item.tags.includes("operational-word-bank")
      ).length
    ).toBeGreaterThan(180);
  });
});

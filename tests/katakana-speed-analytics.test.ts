import { describe, expect, it } from "vitest";

import {
  buildKatakanaSpeedAnalytics,
  type KatakanaSpeedAnalyticsAttempt,
  type KatakanaSpeedAnalyticsExerciseResult
} from "@/features/katakana-speed/model/analytics";

describe("katakana speed analytics", () => {
  it("builds mode-aware recap metrics from attempts and aggregate results", () => {
    const attempts: KatakanaSpeedAnalyticsAttempt[] = [
      attempt({
        expectedSurface: "ディ",
        isCorrect: false,
        itemId: "chunk-di",
        mode: "minimal_pair",
        responseMs: 1320,
        userAnswer: "ジ"
      }),
      attempt({
        errorTags: ["slow_correct"],
        expectedSurface: "ヴョ",
        features: { moraCount: 1, rarity: "rare", tier: "C", wasRare: true },
        isCorrect: true,
        itemId: "chunk-vyo",
        mode: "minimal_pair",
        responseMs: 1900,
        userAnswer: "ヴョ"
      }),
      attempt({
        expectedSurface: "ティラード",
        features: { family: "pseudo-bank", moraCount: 4, rarity: "edge" },
        focusChunks: ["ティ"],
        isCorrect: true,
        itemId: "pseudo-ti-rado",
        itemType: "pseudoword",
        metrics: { msPerMora: 410 },
        mode: "pseudoword_sprint",
        responseMs: 1640,
        selfRating: "clean",
        userAnswer: "clean",
        wasPseudo: true,
        wasTransfer: true
      }),
      attempt({
        expectedSurface:
          "ミーティング、セキュリティ、コミュニティを連続で読みます。",
        features: { family: "sentence-sprint", moraCount: 20 },
        focusChunks: ["ティ"],
        isCorrect: true,
        itemId: "sentence-P37",
        itemType: "sentence",
        metrics: { msPerMora: 300 },
        mode: "sentence_sprint",
        responseMs: 6000,
        selfRating: "hesitated",
        userAnswer: "hesitated",
        wasTransfer: true
      })
    ];
    const exerciseResults: KatakanaSpeedAnalyticsExerciseResult[] = [
      {
        metrics: {
          firstPassMs: 7200,
          improvementRatio: 0.25,
          repeatedPassMs: 5400,
          transferPassMs: 5800,
          transferStatus: "retained"
        },
        selfRating: null
      },
      {
        metrics: {
          adjustedItemsPerSecond: 1.7,
          cellSurfaces: Array.from({ length: 25 }, (_, index) =>
            index % 2 === 0 ? "シ" : "ツ"
          ),
          errors: 2,
          errorRate: 0.08,
          itemsPerSecond: 2.1,
          rows: 5,
          columns: 5,
          totalItems: 25,
          wrongCellIndexes: [6, 18],
          wrongCells: [
            {
              column: 2,
              index: 6,
              itemId: "kana-shi",
              row: 2,
              surface: "シ"
            },
            {
              column: 4,
              index: 18,
              itemId: "kana-shi",
              row: 4,
              surface: "シ"
            }
          ]
        },
        selfRating: null
      }
    ];

    const analytics = buildKatakanaSpeedAnalytics({
      attempts,
      exerciseResults,
      itemStates: []
    });

    expect(analytics.overview).toMatchObject({
      accuracyPercent: 75,
      fluentCorrectPercent: 25,
      totalAttempts: 4
    });
    expect(analytics.modeMetrics.rareAccuracy).toMatchObject({
      accuracyPercent: 100,
      attempts: 1
    });
    expect(analytics.modeMetrics.pseudoTransfer).toMatchObject({
      attempts: 1,
      medianMsPerMora: 410,
      transferReadyPercent: 100
    });
    expect(analytics.modeMetrics.sentenceFlow).toMatchObject({
      attempts: 1,
      medianMsPerMora: 300
    });
    expect(analytics.modeMetrics.repeatedReadingGain).toMatchObject({
      latestGainPercent: 25,
      transferStatus: "retained"
    });
    expect(analytics.modeMetrics.ranItemsPerSecond).toMatchObject({
      adjustedItemsPerSecond: 1.7,
      errors: 2,
      errorRate: 0.08,
      itemsPerSecond: 2.1,
      totalItems: 25,
      wrongCellIndexes: [6, 18],
      wrongCells: [
        {
          column: 2,
          index: 6,
          itemId: "kana-shi",
          row: 2,
          surface: "シ"
        },
        {
          column: 4,
          index: 18,
          itemId: "kana-shi",
          row: 4,
          surface: "シ"
        }
      ]
    });
    expect(analytics.topConfusions[0]).toMatchObject({
      avgRtMs: 1320,
      count: 1,
      expectedSurface: "ディ",
      observedSurface: "ジ"
    });
    expect(
      analytics.topSlowItems.find((item) => item.surface === "ヴョ")
    ).toMatchObject({
      count: 1,
      medianRtMs: 1900,
      surface: "ヴョ"
    });
    expect(analytics.familyCards.length).toBeGreaterThan(0);
    expect(analytics.recommendedMode.mode).toBe("rare_combo");
  });
});

function attempt(
  overrides: Partial<KatakanaSpeedAnalyticsAttempt>
): KatakanaSpeedAnalyticsAttempt {
  return {
    errorTags: overrides.errorTags ?? [],
    expectedSurface: overrides.expectedSurface ?? "ティ",
    features: overrides.features ?? {},
    focusChunks: overrides.focusChunks ?? [],
    isCorrect: overrides.isCorrect ?? true,
    itemId: overrides.itemId ?? "chunk-ti",
    itemType: overrides.itemType ?? "extended_chunk",
    metrics: overrides.metrics ?? {},
    mode: overrides.mode ?? "minimal_pair",
    promptSurface:
      overrides.promptSurface ?? overrides.expectedSurface ?? "ティ",
    responseMs: overrides.responseMs ?? 500,
    selfRating: overrides.selfRating ?? null,
    targetRtMs: overrides.targetRtMs ?? null,
    userAnswer: overrides.userAnswer ?? overrides.expectedSurface ?? "ティ",
    wasPseudo: overrides.wasPseudo ?? false,
    wasRepair: overrides.wasRepair ?? false,
    wasTransfer: overrides.wasTransfer ?? false
  };
}

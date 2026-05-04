import { describe, expect, it } from "vitest";

import {
  buildKatakanaSpeedRanGridCellSnapshots,
  buildKatakanaSpeedRanGridMetrics,
  scoreKatakanaSpeedPseudowordTransfer,
  scoreKatakanaSpeedRanGrid,
  scoreKatakanaSpeedSentenceSprint
} from "@/features/katakana-speed/model";

describe("katakana speed expansion scoring", () => {
  it("scores pseudoword transfer from response time per mora and self rating", () => {
    expect(
      scoreKatakanaSpeedPseudowordTransfer({
        moraCount: 4,
        responseMs: 1600,
        selfRating: "clean"
      })
    ).toEqual({
      rtPerMora: 400,
      status: "transfer_ready"
    });

    expect(
      scoreKatakanaSpeedPseudowordTransfer({
        moraCount: 4,
        responseMs: 3600,
        selfRating: "wrong"
      })
    ).toEqual({
      rtPerMora: 900,
      status: "blocked"
    });

    expect(
      scoreKatakanaSpeedPseudowordTransfer({
        moraCount: 4,
        responseMs: 1600,
        selfRating: "hesitated"
      })
    ).toEqual({
      rtPerMora: 400,
      status: "developing"
    });

    expect(
      scoreKatakanaSpeedPseudowordTransfer({
        moraCount: 4,
        responseMs: 1600,
        selfRating: "wrong"
      })
    ).toEqual({
      rtPerMora: 400,
      status: "blocked"
    });
  });

  it("scores sentence sprint speed as milliseconds per mora", () => {
    expect(
      scoreKatakanaSpeedSentenceSprint({
        moraCount: 18,
        responseMs: 4500
      })
    ).toEqual({
      msPerMora: 250,
      status: "fluent"
    });
  });

  it("scores RAN grids by raw and accuracy-adjusted items per second", () => {
    expect(
      scoreKatakanaSpeedRanGrid({
        correctItems: 28,
        totalItems: 30,
        responseMs: 14_000
      })
    ).toEqual({
      adjustedItemsPerSecond: 1.867,
      itemsPerSecond: 2.143
    });
  });

  it("builds canonical RAN grid metrics from cells and indexed errors", () => {
    const sourceCells = Array.from({ length: 25 }, (_, index) => ({
      itemId: index % 2 === 0 ? "kana-shi" : "kana-tsu",
      surface: index % 2 === 0 ? "シ" : "ツ"
    }));
    const cells = buildKatakanaSpeedRanGridCellSnapshots({
      cells: sourceCells,
      columns: 5
    });

    expect(
      buildKatakanaSpeedRanGridMetrics({
        cells,
        columns: 5,
        durationMs: 12_500,
        wrongCellIndexes: [18, 6, 6]
      })
    ).toEqual({
      adjustedItemsPerSecond: 1.693,
      cells,
      cellItemIds: sourceCells.map((cell) => cell.itemId),
      cellSurfaces: sourceCells.map((cell) => cell.surface),
      columns: 5,
      correctItems: 23,
      durationMs: 12_500,
      errorRate: 0.08,
      errors: 2,
      itemsPerSecond: 2,
      rows: 5,
      schemaVersion: 1,
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
  });
});

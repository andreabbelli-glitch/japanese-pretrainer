import { describe, expect, it } from "vitest";

import {
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
});

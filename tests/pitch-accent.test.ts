import { describe, expect, it } from "vitest";

import {
  buildPitchAccentData,
  formatPitchAccentLabel,
  normalizePitchAccentReading,
  splitJapaneseMorae
} from "@/features/pitch-accent/model";

describe("pitch accent helpers", () => {
  it("splits morae while preserving combined kana", () => {
    expect(splitJapaneseMorae("きょう")).toEqual(["きょ", "う"]);
    expect(splitJapaneseMorae("スーパー")).toEqual(["ス", "ー", "パ", "ー"]);
    expect(splitJapaneseMorae("～ている")).toEqual(["て", "い", "る"]);
  });

  it("normalizes Kuuuube ka-row semi-voiced marks to voiced kana", () => {
    expect(normalizePitchAccentReading("ハク゚")).toBe("ハグ");
    expect(normalizePitchAccentReading("タンコ゚")).toBe("タンゴ");
    expect(normalizePitchAccentReading("パ")).toBe("パ");
    expect(splitJapaneseMorae("ハク゚")).toEqual(["ハ", "グ"]);
  });

  it("builds a valid contour for downstep notation", () => {
    const data = buildPitchAccentData("しんか", 2);

    expect(data).toEqual({
      downstep: 2,
      levels: ["low", "high", "low"],
      morae: ["し", "ん", "か"],
      shape: "nakadaka",
      trailingLevel: "low"
    });
    expect(formatPitchAccentLabel(data!)).toBe("Nakadaka (2)");
  });

  it("rejects impossible pitch accent values for the reading", () => {
    expect(buildPitchAccentData("たべる", 4)).toBeNull();
    expect(buildPitchAccentData("たべる", -1)).toBeNull();
  });
});

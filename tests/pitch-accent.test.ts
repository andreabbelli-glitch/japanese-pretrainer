import { describe, expect, it } from "vitest";

import {
  buildPitchAccentData,
  formatPitchAccentLabel,
  splitJapaneseMorae
} from "@/lib/pitch-accent";

describe("pitch accent helpers", () => {
  it("splits morae while preserving combined kana", () => {
    expect(splitJapaneseMorae("きょう")).toEqual(["きょ", "う"]);
    expect(splitJapaneseMorae("スーパー")).toEqual(["ス", "ー", "パ", "ー"]);
    expect(splitJapaneseMorae("～ている")).toEqual(["て", "い", "る"]);
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

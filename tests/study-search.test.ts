import { describe, expect, it } from "vitest";

import { romanizeKanaForSearch } from "@/lib/study-search";

describe("study search", () => {
  it("romanizes ツァ-series loanword digraphs without inserting an extra u", () => {
    expect(romanizeKanaForSearch("ぱんつぁー")).toBe("pantsaa");
    expect(romanizeKanaForSearch("パンツェル")).toBe("pantseru");
  });

  it("romanizes extended katakana loanword digraphs precisely for search", () => {
    expect(romanizeKanaForSearch("ヴョトール")).toBe("vyotooru");
    expect(romanizeKanaForSearch("ヴュートール")).toBe("vyuutooru");
    expect(romanizeKanaForSearch("デュエット")).toBe("dyuetto");
    expect(romanizeKanaForSearch("テューバ")).toBe("tyuuba");
    expect(romanizeKanaForSearch("フョトール")).toBe("fyotooru");
    expect(romanizeKanaForSearch("キェルケゴール")).toBe("kyerukegooru");
    expect(romanizeKanaForSearch("グェルフ")).toBe("gwerufu");
    expect(romanizeKanaForSearch("スィート")).toBe("siito");
    expect(romanizeKanaForSearch("イェルサレム")).toBe("yerusaremu");
    expect(romanizeKanaForSearch("クァルテット")).toBe("kwarutetto");
    expect(romanizeKanaForSearch("インタヴュー")).toBe("intavyuu");
    expect(romanizeKanaForSearch("ケース・バイ・ケース")).toBe("keesubaikeesu");
    expect(romanizeKanaForSearch("ヲ")).toBe("wo");
    expect(romanizeKanaForSearch("を")).toBe("o");
  });
});

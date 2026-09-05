import { describe, expect, it, vi } from "vitest";

import * as parser from "@/features/content/parser/markdown";
import { stripInlineMarkdown } from "@/features/study/model/inline-markdown";

describe("plain study surfaces", () => {
  it("does not run the Markdown parser for repeated plain Unicode words", () => {
    const parse = vi.spyOn(parser, "parseInlineFragment");
    try {
      for (let i = 0; i < 100; i++) {
        for (const word of [
          "日本語",
          "カタカナ",
          "𠮷野家",
          "ＡＢＣ",
          "abc123"
        ]) {
          expect(stripInlineMarkdown(word)).toBe(word);
        }
      }
      expect(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it.each([
    ["{{用語|ようご}}", "用語"],
    ["**大切**な *言葉*", "大切な 言葉"],
    ["[用語](term:term-card)", "用語"],
    ["&amp;", "&"],
    ["\\*文字\\*", "*文字*"],
    ["\n用語\n", "用語"],
    ["", ""]
  ])("preserves inline parsing for %s", (source, expected) => {
    expect(stripInlineMarkdown(source)).toBe(expected);
  });
});

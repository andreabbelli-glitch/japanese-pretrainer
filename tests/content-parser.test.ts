import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "@/features/content/parser/frontmatter";
import { parseInlineFragment } from "@/features/content/parser/markdown";
import { extractStructuredBlocks } from "@/features/content/parser/structured-blocks";

describe("content parser", () => {
  it("parses frontmatter when the file starts with BOM and uses CRLF", () => {
    const source =
      "\uFEFF---\r\nid: media-demo\r\nslug: demo\r\n---\r\n# Body\r\n";
    const result = parseFrontmatter(source, "fixture.md");

    expect(result.issues).toEqual([]);
    expect(result.data).toEqual({
      id: "media-demo",
      slug: "demo"
    });
    expect(result.bodyLineOffset).toBe(4);
    expect(result.body).toBe("# Body\n");
  });

  it("does not parse structured blocks inside longer code fences", () => {
    const source = [
      "````md",
      "```yaml",
      ":::term",
      "id: term-ignored",
      "lemma: 例",
      "reading: れい",
      "romaji: rei",
      "meaning_it: esempio",
      ":::",
      "```",
      "````"
    ].join("\n");
    const result = extractStructuredBlocks(source, "fixture.md", 0);

    expect(result.issues).toEqual([]);
    expect(result.blocks).toEqual([]);
    expect(result.transformedSource).toBe(source);
  });

  it("tracks semantic references nested inside inline code fragments", () => {
    const result = parseInlineFragment({
      source: "`[食べる](term:term-taberu)`",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.references).toContainEqual(
      expect.objectContaining({
        referenceType: "term",
        targetId: "term-taberu",
        display: "食べる"
      })
    );
    expect(result.fragment.nodes).toEqual([
      {
        type: "inlineCode",
        children: [
          {
            type: "reference",
            raw: "[食べる](term:term-taberu)",
            display: "食べる",
            targetType: "term",
            targetId: "term-taberu",
            children: [{ type: "text", value: "食べる" }]
          }
        ]
      }
    ]);
  });

  it("tracks semantic references inside block-looking inline code fragments", () => {
    const cases = [
      {
        source: "`- [食べる](term:term-taberu)`",
        prefix: "- "
      },
      {
        source: "`> [食べる](term:term-taberu)`",
        prefix: "> "
      }
    ];

    for (const testCase of cases) {
      const result = parseInlineFragment({
        source: testCase.source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.references).toContainEqual(
        expect.objectContaining({
          referenceType: "term",
          targetId: "term-taberu",
          display: "食べる"
        })
      );
      expect(result.fragment.nodes).toEqual([
        {
          type: "inlineCode",
          children: [
            { type: "text", value: testCase.prefix },
            {
              type: "reference",
              raw: "[食べる](term:term-taberu)",
              display: "食べる",
              targetType: "term",
              targetId: "term-taberu",
              children: [{ type: "text", value: "食べる" }]
            }
          ]
        }
      ]);
    }
  });

  it("preserves literal block-looking markdown inside inline code fragments", () => {
    const cases = [
      { source: "`- foo`", expected: "- foo" },
      { source: "`1. foo`", expected: "1. foo" }
    ];

    for (const testCase of cases) {
      const result = parseInlineFragment({
        source: testCase.source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.fragment.nodes).toEqual([
        {
          type: "inlineCode",
          children: [{ type: "text", value: testCase.expected }]
        }
      ]);
    }
  });

  it("parses compound furigana for numeric counters and numeric qualifiers", () => {
    const result = parseInlineFragment({
      source: "`{{1枚|いちまい}}` e `{{2000以下|にせんいか}}`",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.issues).toEqual([]);
    expect(result.fragment.nodes).toEqual([
      {
        type: "inlineCode",
        children: [
          {
            type: "furigana",
            raw: "{{1枚|いちまい}}",
            base: "1枚",
            reading: "いちまい"
          }
        ]
      },
      { type: "text", value: " e " },
      {
        type: "inlineCode",
        children: [
          {
            type: "furigana",
            raw: "{{2000以下|にせんいか}}",
            base: "2000以下",
            reading: "にせんいか"
          }
        ]
      }
    ]);
  });

  it("flags furigana bases that keep visible kana inside the ruby", () => {
    const cases = [
      "{{受け取る|うけとる}}",
      "{{メイン枠|めいんわく}}",
      "{{2つ|ふたつ}}",
      "{{赤いガンダム(0085)|あかいがんだむ ぜろぜろはちご}}"
    ];

    for (const source of cases) {
      const result = parseInlineFragment({
        source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.mixed-kana-base",
          category: "syntax"
        })
      );
    }
  });

  it("accepts furigana split so kana stays visible", () => {
    const result = parseInlineFragment({
      source:
        "{{受|う}}け{{取|と}}る / メイン{{枠|わく}} / {{2|ふた}}つ / {{赤|あか}}いガンダム({{0085|ぜろぜろはちご}})",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.issues).toEqual([]);
  });

  it("flags furigana split between a number and its counter", () => {
    const result = parseInlineFragment({
      source: "`1{{枚|まい}}`",
      filePath: "inline.md",
      documentKind: "lesson",
      sourcePath: "notesIt"
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "furigana.numeric-compound-split",
        category: "syntax",
        details: expect.objectContaining({
          numeric: "1",
          counter: "枚"
        })
      })
    );
  });

  it("flags furigana split between a numeric compound and its qualifier", () => {
    const cases = [
      "`4{{以下|いか}}`",
      "`{{2000|にせん}}{{以下|いか}}`",
      "`{{4つ|よっつ}}{{以上|いじょう}}`"
    ];

    for (const source of cases) {
      const result = parseInlineFragment({
        source,
        filePath: "inline.md",
        documentKind: "lesson",
        sourcePath: "notesIt"
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: "furigana.numeric-compound-split",
          category: "syntax"
        })
      );
    }
  });
});

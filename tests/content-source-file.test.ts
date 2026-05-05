import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeSourceFile } from "@/lib/content/importer/render";

describe("content source file normalization", () => {
  it("keeps source files in dot-prefixed directories relative to the content root", () => {
    const contentRoot = path.join(path.sep, "tmp", "content");
    const sourceFile = path.join(contentRoot, "..generated", "lesson.md");

    expect(normalizeSourceFile(contentRoot, sourceFile)).toBe(
      "..generated/lesson.md"
    );
  });
});

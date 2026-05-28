import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("pitch accent css", () => {
  it("uses the canonical Japanese font token on pitch accent surfaces", async () => {
    const [baseCss, tokensCss] = await Promise.all([
      readFile(path.join(PROJECT_ROOT, "src/styles/base.css"), "utf8"),
      readFile(path.join(PROJECT_ROOT, "src/styles/tokens.css"), "utf8")
    ]);

    expect(tokensCss).toMatch(/--font-family-jp\s*:/);
    expect(baseCss).not.toContain("--font-family-japanese");
    expect(baseCss).toMatch(
      /\.pitch-accent__graph\s*\{[^}]*font-family:\s*var\(--font-family-jp\);/s
    );
    expect(baseCss).toMatch(
      /\.pitch-accent-kana\s*\{[^}]*font-family:\s*var\(--font-family-jp\);/s
    );
  });
});

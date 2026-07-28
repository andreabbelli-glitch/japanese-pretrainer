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

  it("keeps Japanese glyphs on the readable Gothic family across UI titles", async () => {
    const [foundationsCss, tokensCss] = await Promise.all([
      readFile(
        path.join(PROJECT_ROOT, "src/styles/ui-foundations.css"),
        "utf8"
      ),
      readFile(path.join(PROJECT_ROOT, "src/styles/tokens.css"), "utf8")
    ]);

    expect(tokensCss).toMatch(
      /--font-family-display:\s*"Newsreader",\s*"BIZ UDPGothic"[^;]*serif;/s
    );
    expect(tokensCss).toMatch(
      /--font-family-ui:\s*"Instrument Sans Variable",\s*"BIZ UDPGothic"[^;]*sans-serif;/s
    );
    expect(foundationsCss).toMatch(
      /\.entry-preview-card__title\.jp-inline,\n\.entry-tooltip-card__title\.jp-inline,\n\.glossary-result-card__title\.jp-inline\s*\{[^}]*font-family:\s*var\(--font-family-jp\);/s
    );
  });
});

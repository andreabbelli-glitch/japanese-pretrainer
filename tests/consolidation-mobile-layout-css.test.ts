import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("consolidation mobile layout css", () => {
  it("keeps option buttons stable, readable, and motion-reduced friendly", async () => {
    const css = await readFile(
      path.join(
        PROJECT_ROOT,
        "src/components/consolidation/consolidation-session.module.css"
      ),
      "utf8"
    );

    expect(css).toMatch(
      /\.optionsGrid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*min-height:/s
    );
    expect(css).toMatch(
      /\.optionButton\s*\{[^}]*min-height:\s*72px;[^}]*overflow-wrap:\s*anywhere;/s
    );
    expect(css).toMatch(/\.retrievalSurface\s*\{[^}]*min-height:\s*220px;/s);
    expect(css).not.toContain("placeholderGrid");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toMatch(
      /\.optionsGrid\s*\{[^}]*grid-template-columns:\s*1fr;/s
    );
    expect(css).not.toMatch(/\.actions\s*\{[^}]*position:\s*sticky;/s);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});

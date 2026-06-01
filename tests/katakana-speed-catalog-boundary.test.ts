import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const catalogPath = join(
  repoRoot,
  "src/features/katakana-speed/model/catalog.ts"
);
const staticDataPath = join(
  repoRoot,
  "src/features/katakana-speed/model/catalog-static-data.ts"
);
const sentenceBankPath = join(
  repoRoot,
  "src/features/katakana-speed/model/sentence-bank.ts"
);

describe("katakana speed catalog module boundaries", () => {
  it("keeps static seed rows out of the catalog materializer", () => {
    expect(existsSync(staticDataPath)).toBe(true);
    expect(existsSync(sentenceBankPath)).toBe(true);

    const catalogSource = readFileSync(catalogPath, "utf8");

    expect(catalogSource).toContain('from "./catalog-static-data.ts"');
    expect(catalogSource).toContain('from "./sentence-bank.ts"');
    expect(catalogSource).not.toMatch(/\bitem\(\s*"chunk-she"/u);
    expect(catalogSource).not.toMatch(/\bword\(\s*"word-security"/u);
    expect(catalogSource).not.toMatch(/\bsentence\(\s*"P01"/u);
    expect(catalogSource).not.toMatch(/\bcluster\(\s*"visual-shi-tsu-so-n"/u);
    expect(catalogSource).not.toMatch(
      /const\s+OPERATIONAL_FOCUS_CHUNKS\s*=\s*\[/u
    );
  });
});

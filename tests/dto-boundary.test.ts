import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const publicDtoFiles = [
  "src/features/kanji-clash/types.ts",
  "src/features/glossary/types.ts",
  "src/features/textbook/types.ts",
  "src/lib/review-types.ts"
] as const;

describe("public DTO boundaries", () => {
  it.each(publicDtoFiles)(
    "%s stays independent from framework and database modules",
    async (relativePath) => {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      expect(findDisallowedImports(source)).toEqual([]);
    }
  );
});

function findDisallowedImports(source: string) {
  const violations: string[] = [];
  const importPatterns = [
    /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'](?<path>[^"']+)["']/gu,
    /import\s*\(\s*["'](?<path>[^"']+)["']\s*\)/gu,
    /export\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)["'](?<path>[^"']+)["']/gu
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const importPath = match.groups?.path;

      if (importPath && isDisallowedDtoImport(importPath)) {
        violations.push(importPath);
      }
    }
  }

  return violations;
}

function isDisallowedDtoImport(importPath: string) {
  return (
    importPath === "next" ||
    importPath.startsWith("next/") ||
    importPath === "@/db" ||
    importPath.startsWith("@/db/") ||
    importPath === "drizzle-orm" ||
    importPath.startsWith("drizzle-orm/")
  );
}

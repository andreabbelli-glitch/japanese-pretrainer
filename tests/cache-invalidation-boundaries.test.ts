import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const touchedMutationFiles = [
  "src/actions/textbook.ts",
  "src/actions/settings.ts",
  "src/actions/kanji-clash.ts",
  "src/app/api/internal/content-cache/revalidate/route.ts"
] as const;
const disallowedDataCacheMutationImports = new Set([
  "revalidateGlossarySummaryCache",
  "revalidateMediaListCache",
  "revalidateReviewSummaryCache",
  "revalidateSettingsCache",
  "revalidateTextbookLessonBodyCache",
  "revalidateTextbookTooltipCache",
  "updateGlossarySummaryCache",
  "updateMediaListCache",
  "updateReviewSummaryCache",
  "updateSettingsCache"
]);

describe("cache invalidation boundaries", () => {
  it.each(touchedMutationFiles)(
    "%s delegates mutation cache invalidation through the policy layer",
    async (relativePath) => {
      const source = await readFile(
        path.join(PROJECT_ROOT, relativePath),
        "utf8"
      );

      expect(source).not.toMatch(/from\s+["']next\/cache["']/u);
      expect(findDisallowedDataCacheImports(source)).toEqual([]);
    }
  );
});

function findDisallowedDataCacheImports(source: string) {
  const names: string[] = [];
  const importPattern =
    /import\s*\{(?<specifiers>[\s\S]*?)\}\s*from\s*["']@\/lib\/data-cache["']/gu;

  for (const match of source.matchAll(importPattern)) {
    const specifiers = match.groups?.specifiers ?? "";

    for (const rawSpecifier of specifiers.split(",")) {
      const localName = rawSpecifier
        .trim()
        .replace(/^type\s+/u, "")
        .split(/\s+as\s+/u)[0]
        ?.trim();

      if (localName && disallowedDataCacheMutationImports.has(localName)) {
        names.push(localName);
      }
    }
  }

  return names;
}

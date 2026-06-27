import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const splitReviewTestFiles = [
  "tests/review-model.test.ts",
  "tests/review-counters.test.ts",
  "tests/review-queue.test.ts",
  "tests/review-mutations.test.ts",
  "tests/review-rendering.test.ts"
];
const maxReviewSplitLines = 1_150;
const expectedReviewTestCount = 52;

function extractTestTitles(source: string) {
  const titles = [
    ...source.matchAll(/\bit\("([^"]+)"/g),
    ...source.matchAll(/\bit\.each[\s\S]*?\(\s*"([^"]+)"/g)
  ].map((match) => match[1]);

  return titles.sort((left, right) => left.localeCompare(right));
}

describe("review suite navigability", () => {
  it("keeps the review tests split into focused files", async () => {
    await expect(
      access(path.join(process.cwd(), "tests/review.test.ts"))
    ).rejects.toThrow();

    const titles: string[] = [];

    for (const filePath of splitReviewTestFiles) {
      const source = await readFile(path.join(process.cwd(), filePath), "utf8");
      const lineCount = source.trimEnd().split("\n").length;

      expect(lineCount, filePath).toBeLessThanOrEqual(maxReviewSplitLines);
      titles.push(...extractTestTitles(source));
    }

    expect(titles).toHaveLength(expectedReviewTestCount);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

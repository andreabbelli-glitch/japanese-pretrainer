import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("database query module boundary", () => {
  it("keeps review overview and launch SQL out of the base review query module", async () => {
    const source = await readFile(
      path.join(PROJECT_ROOT, "src", "db", "queries", "review.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/\bfunction\s+loadReviewOverviewData\b/u);
    expect(source).not.toMatch(
      /\bexport\s+async\s+function\s+listReviewLaunchCandidates\b/u
    );
    expect(source).not.toMatch(
      /\bexport\s+async\s+function\s+getReviewLaunchCandidateByMediaId\b/u
    );
  });
});

import { access, readFile } from "node:fs/promises";
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

  it("keeps review launch candidate SQL in a focused query module", async () => {
    const violations: string[] = [];
    const launchCandidatesPath = path.join(
      PROJECT_ROOT,
      "src",
      "db",
      "queries",
      "review-launch-candidates.ts"
    );
    const reviewModuleSource = await readFile(
      path.join(PROJECT_ROOT, "src", "db", "queries", "review.ts"),
      "utf8"
    );
    const overviewModuleSource = await readFile(
      path.join(PROJECT_ROOT, "src", "db", "queries", "review-overview.ts"),
      "utf8"
    );

    if (!(await fileExists(launchCandidatesPath))) {
      violations.push("missing src/db/queries/review-launch-candidates.ts");
    }

    if (violations.length === 0) {
      const launchCandidatesSource = await readFile(
        launchCandidatesPath,
        "utf8"
      );

      for (const exportedName of [
        "ReviewLaunchCandidate",
        "listReviewLaunchCandidates",
        "getReviewLaunchCandidateByMediaId",
        "selectReviewLaunchCandidateByDue",
        "selectReviewLaunchCandidateByNew"
      ]) {
        if (!launchCandidatesSource.includes(exportedName)) {
          violations.push(
            `review-launch-candidates.ts missing ${exportedName}`
          );
        }
      }
    }

    if (!reviewModuleSource.includes('from "./review-launch-candidates')) {
      violations.push("review.ts does not re-export review launch candidates");
    }

    if (
      /export\s+(type\s+)?ReviewLaunchCandidate|export\s+function\s+selectReviewLaunchCandidate|export\s+async\s+function\s+(listReviewLaunchCandidates|getReviewLaunchCandidateByMediaId)/u.test(
        overviewModuleSource
      )
    ) {
      violations.push("review-overview.ts still owns launch candidate exports");
    }

    expect(violations).toEqual([]);
  });
});

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

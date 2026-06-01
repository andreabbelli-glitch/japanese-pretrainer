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
    const reviewOverviewPath = path.join(
      PROJECT_ROOT,
      "src",
      "db",
      "queries",
      "review-overview.ts"
    );
    const overviewLoaderSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "overview-loader.ts"
      ),
      "utf8"
    );
    const reviewServerIndexSource = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "review",
        "server",
        "index.ts"
      ),
      "utf8"
    );
    const reviewModuleSource = await readFile(
      path.join(PROJECT_ROOT, "src", "db", "queries", "review.ts"),
      "utf8"
    );

    if (!(await fileExists(launchCandidatesPath))) {
      violations.push("missing src/db/queries/review-launch-candidates.ts");
    }

    if (await fileExists(reviewOverviewPath)) {
      violations.push("src/db/queries/review-overview.ts still exists");
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

    if (reviewModuleSource.includes('from "./review-overview')) {
      violations.push("review.ts still re-exports retired review overview SQL");
    }

    if (
      /GlobalReviewOverview|aggregateGlobalReviewOverviewData|getGlobalReviewNextCardFront|getGlobalReviewOverviewData|getReviewOverviewDataByMediaId|getQueuedNewReviewSubjectSummaryByMediaId/u.test(
        reviewModuleSource
      )
    ) {
      violations.push("review.ts still exports retired review overview API");
    }

    if (/mapReviewOverviewSnapshot/u.test(overviewLoaderSource)) {
      violations.push("overview-loader.ts still exports the retired mapper");
    }

    if (/mapReviewOverviewSnapshot/u.test(reviewServerIndexSource)) {
      violations.push(
        "review server barrel still re-exports the retired mapper"
      );
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

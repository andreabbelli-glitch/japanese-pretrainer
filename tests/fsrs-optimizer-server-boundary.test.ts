import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const trainingDataModulePath = path.join(
  PROJECT_ROOT,
  "src",
  "features",
  "fsrs-optimizer",
  "server",
  "training-data.ts"
);

describe("fsrs optimizer server boundary", () => {
  it("keeps training data helpers in a focused server module", async () => {
    const violations: string[] = [];

    if (!(await fileExists(trainingDataModulePath))) {
      violations.push(
        "missing src/features/fsrs-optimizer/server/training-data.ts"
      );
    }

    if (violations.length === 0) {
      const source = await readFile(trainingDataModulePath, "utf8");

      for (const exportedName of [
        "buildFsrsTrainingDataset",
        "countEligibleFsrsOptimizerReviews",
        "loadFsrsOptimizerLogRows"
      ]) {
        if (!source.includes(exportedName)) {
          violations.push(`training-data.ts missing ${exportedName}`);
        }
      }

      if (/userSetting|user-settings|next\/cache|revalidateTag/u.test(source)) {
        violations.push("training-data.ts mixes settings/cache concerns");
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps the public FSRS server facade stable for training data helpers", async () => {
    const source = await readFile(
      path.join(
        PROJECT_ROOT,
        "src",
        "features",
        "fsrs-optimizer",
        "server",
        "index.ts"
      ),
      "utf8"
    );

    expect(source).toContain('from "./training-data');
    expect(source).toContain("buildFsrsTrainingDataset");
    expect(source).toContain("countEligibleFsrsOptimizerReviews");
    expect(source).toContain("loadFsrsOptimizerLogRows");
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

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const trainingPolicyModulePath = path.join(
  PROJECT_ROOT,
  "src",
  "features",
  "fsrs-optimizer",
  "model",
  "training-policy.ts"
);
const trainerModulePath = path.join(
  PROJECT_ROOT,
  "src",
  "features",
  "fsrs-optimizer",
  "tooling",
  "trainer.ts"
);
const serverFacadePath = path.join(
  PROJECT_ROOT,
  "src",
  "features",
  "fsrs-optimizer",
  "server",
  "index.ts"
);

describe("fsrs optimizer trainer boundary", () => {
  it("keeps optimizer run policy pure and outside trainer IO orchestration", async () => {
    const violations: string[] = [];

    if (!(await fileExists(trainingPolicyModulePath))) {
      violations.push(
        "missing src/features/fsrs-optimizer/model/training-policy.ts"
      );
    }

    if (violations.length === 0) {
      const policySource = await readFile(trainingPolicyModulePath, "utf8");

      for (const exportedName of [
        "planFsrsOptimizerRun",
        "resolveFsrsTrainingReadiness",
        "FsrsOptimizationRunResult"
      ]) {
        if (!policySource.includes(exportedName)) {
          violations.push(`training-policy.ts missing ${exportedName}`);
        }
      }

      if (
        /db\/|server\/|@open-spaced-repetition\/binding|next\/cache|process\.env|writeFsrs|loadFsrs|computeParameters/u.test(
          policySource
        )
      ) {
        violations.push("training-policy.ts mixes IO/training concerns");
      }
    }

    const trainerSource = await readFile(trainerModulePath, "utf8");

    if (!trainerSource.includes("../model/training-policy")) {
      violations.push("trainer.ts does not use the model training policy");
    }

    if (trainerSource.includes("../server/index")) {
      violations.push(
        "trainer.ts imports the server facade instead of focused modules"
      );
    }

    const facadeSource = await readFile(serverFacadePath, "utf8");

    if (!facadeSource.includes("../model/training-policy")) {
      violations.push("server facade does not re-export training policy types");
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

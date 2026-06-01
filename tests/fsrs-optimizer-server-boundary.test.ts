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
const settingsStoreModulePath = path.join(
  PROJECT_ROOT,
  "src",
  "features",
  "fsrs-optimizer",
  "server",
  "settings-store.ts"
);
const serverFacadePath = path.join(
  PROJECT_ROOT,
  "src",
  "features",
  "fsrs-optimizer",
  "server",
  "index.ts"
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
    const source = await readFile(serverFacadePath, "utf8");

    expect(source).toContain('from "./training-data');
    expect(source).toContain("buildFsrsTrainingDataset");
    expect(source).toContain("countEligibleFsrsOptimizerReviews");
    expect(source).toContain("loadFsrsOptimizerLogRows");
  });

  it("keeps settings storage and runtime cache in a focused server module", async () => {
    const violations: string[] = [];

    if (!(await fileExists(settingsStoreModulePath))) {
      violations.push(
        "missing src/features/fsrs-optimizer/server/settings-store.ts"
      );
    }

    if (violations.length === 0) {
      const settingsStoreSource = await readFile(
        settingsStoreModulePath,
        "utf8"
      );

      for (const exportedName of [
        "FSRS_OPTIMIZER_CONFIG_KEY",
        "FSRS_OPTIMIZER_STATE_KEY",
        "FSRS_PARAMS_RECOGNITION_KEY",
        "FSRS_PARAMS_CONCEPT_KEY",
        "getFsrsOptimizerConfigDefaults",
        "calculateFsrsOptimizerNewReviewThreshold",
        "buildDefaultFsrsOptimizerSnapshot",
        "getFsrsOptimizerSnapshot",
        "getFsrsOptimizerRuntimeContext",
        "getFsrsOptimizerRuntimeSnapshot",
        "getFsrsOptimizerCacheKeyPart",
        "writeFsrsOptimizerConfig",
        "writeFsrsOptimizerState",
        "writeFsrsOptimizedParameters",
        "invalidateFsrsOptimizerRuntimeContextCache",
        "normalizeFsrsWeights",
        "getBindingPackageVersion"
      ]) {
        if (!settingsStoreSource.includes(exportedName)) {
          violations.push(`settings-store.ts missing ${exportedName}`);
        }
      }

      if (
        /\.\/index|\.\/training-data|reviewSubjectLog|buildFsrsTrainingDataset|loadFsrsOptimizerLogRows|countEligibleFsrsOptimizerReviews/u.test(
          settingsStoreSource
        )
      ) {
        violations.push(
          "settings-store.ts mixes facade/training-data concerns"
        );
      }
    }

    const facadeSource = await readFile(serverFacadePath, "utf8");

    if (!facadeSource.includes('from "./settings-store')) {
      violations.push("server facade does not re-export settings-store");
    }

    if (
      /user-settings|next\/cache|node:fs|node:path|generatorParameters|cachedFsrsRuntimeContext|upsertUserSettingValue/u.test(
        facadeSource
      )
    ) {
      violations.push("server facade still owns settings/cache persistence");
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

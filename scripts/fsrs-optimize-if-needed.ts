import "dotenv/config";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { runFsrsOptimizer } from "../src/features/fsrs-optimizer/tooling/trainer.ts";

const location = resolveDatabaseLocation();

try {
  const result = await runFsrsOptimizer({
    database: db
  });

  if (result.status === "trained") {
    console.info(
      [
        `FSRS optimizer eseguito: training completato il ${result.trainedAt}.`,
        `Review eleggibili: ${result.totalEligibleReviews}.`,
        `Preset recognition: ${result.presetResults.recognition.status} (${result.presetResults.recognition.trainingReviewCount} review).`,
        `Preset concept: ${result.presetResults.concept.status} (${result.presetResults.concept.trainingReviewCount} review).`,
        `DB: ${location.databasePath ?? location.configuredPath}.`
      ].join(" ")
    );
  } else if (result.status === "failed") {
    console.error(
      [
        `FSRS optimizer fallito il ${result.failedAt}: ${result.error}`,
        `Preset recognition: ${result.presetResults.recognition.status} (${result.presetResults.recognition.trainingReviewCount} review).`,
        `Preset concept: ${result.presetResults.concept.status} (${result.presetResults.concept.trainingReviewCount} review).`,
        `DB: ${location.databasePath ?? location.configuredPath}.`
      ].join(" ")
    );
    process.exitCode = 1;
  } else {
    console.info(
      [
        `FSRS optimizer non eseguito: ${result.reason}.`,
        `Review eleggibili: ${result.totalEligibleReviews}.`,
        `Review nuove: ${result.newEligibleReviews}.`,
        `Check: ${result.lastCheckAt}.`,
        `DB: ${location.databasePath ?? location.configuredPath}.`
      ].join(" ")
    );
  }
} finally {
  closeDatabaseClient(db);
}

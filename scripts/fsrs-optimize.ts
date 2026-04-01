import "dotenv/config";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { runFsrsOptimizer } from "../src/lib/fsrs-optimizer-trainer.ts";

const location = resolveDatabaseLocation();

try {
  const result = await runFsrsOptimizer({
    database: db,
    force: true
  });

  if (result.status === "trained") {
    console.info(
      [
        `FSRS optimizer completato il ${result.trainedAt}.`,
        `Review eleggibili: ${result.totalEligibleReviews}.`,
        `Preset recognition: ${result.presetResults.recognition.status} (${result.presetResults.recognition.trainingReviewCount} review).`,
        `Preset concept: ${result.presetResults.concept.status} (${result.presetResults.concept.trainingReviewCount} review).`,
        `DB: ${location.databasePath ?? location.configuredPath}.`
      ].join(" ")
    );
  } else {
    console.info(
      [
        `FSRS optimizer saltato: ${result.reason}.`,
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

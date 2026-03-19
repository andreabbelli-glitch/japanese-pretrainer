import "dotenv/config";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";

const location = resolveDatabaseLocation();

try {
  const result = await backfillReviewSubjectState(db);

  console.info(
    [
      `Backfilled ${result.insertedCount} review subject states`,
      `from ${result.cardCount} review cards`,
      `(${result.subjectCount} total subjects)`,
      `on ${location.databasePath ?? location.configuredPath}.`
    ].join(" ")
  );
} finally {
  closeDatabaseClient(db);
}

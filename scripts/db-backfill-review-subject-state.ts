import "dotenv/config";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import {
  backfillReviewSubjectState,
  inspectReviewSubjectStateCoverage
} from "../src/lib/review-subject-state-backfill.ts";

const location = resolveDatabaseLocation();

try {
  const before = await inspectReviewSubjectStateCoverage(db);
  const result = await backfillReviewSubjectState(db);
  const after = await inspectReviewSubjectStateCoverage(db);

  console.info(
    [
      `Coverage before: ${before.existingStateCount}/${before.subjectCount} subject states present`,
      `(${before.missingStateCount} missing; inline=${before.legacyFallbackCounts.inline}, complex=${before.legacyFallbackCounts.complex}).`,
      `Backfilled ${result.insertedCount} review subject states`,
      `from ${result.cardCount} review cards`,
      `(${result.subjectCount} total subjects).`,
      `Coverage after: ${after.existingStateCount}/${after.subjectCount} subject states present`,
      `(${after.missingStateCount} missing).`,
      `on ${location.databasePath ?? location.configuredPath}.`
    ].join(" ")
  );
} finally {
  closeDatabaseClient(db);
}

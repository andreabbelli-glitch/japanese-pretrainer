import "dotenv/config";

import { count } from "drizzle-orm";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { reviewSubjectState } from "../src/db/schema/review.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";

const location = resolveDatabaseLocation();

try {
  const before = await countReviewSubjectStates();
  const result = await backfillReviewSubjectState(db);
  const after = await countReviewSubjectStates();

  console.info(
    [
      "Manual recovery only: in condizioni normali questo script non dovrebbe essere necessario.",
      `review_subject_state prima: ${before}.`,
      `Recovery completata: ${result.insertedCount} subject state inseriti`,
      `su ${result.subjectCount} subject derivati da ${result.cardCount} card.`,
      `review_subject_state dopo: ${after}.`,
      `DB: ${location.databasePath ?? location.configuredPath}.`
    ].join(" ")
  );
} finally {
  closeDatabaseClient(db);
}

async function countReviewSubjectStates() {
  const rows = await db.select({ value: count() }).from(reviewSubjectState);
  return rows[0]?.value ?? 0;
}

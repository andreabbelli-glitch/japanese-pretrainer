import "dotenv/config";

import path from "node:path";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

const location = resolveDatabaseLocation();
const contentRoot = path.resolve(process.cwd(), "content");

try {
  const result = await importContentWorkspace({
    contentRoot,
    database: db
  });

  if (result.status === "failed") {
    throw new Error(result.message);
  }

  const purgedMedia = await purgeArchivedMedia(db);
  const backfillResult = await backfillReviewSubjectState(db);

  console.info(
    `Imported ${result.parseResult.data.bundles.length} content bundle(s) into ${location.databasePath ?? location.configuredPath}.`
  );
  if (purgedMedia.length > 0) {
    console.info(`Purged archived media: ${purgedMedia.join(", ")}.`);
  }
  console.info(
    `Backfilled review_subject_state: ${backfillResult.insertedCount} subject state(s) from ${backfillResult.cardCount} card(s).`
  );
} finally {
  closeDatabaseClient(db);
}

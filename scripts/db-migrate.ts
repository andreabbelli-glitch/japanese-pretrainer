import "dotenv/config";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { runMigrations } from "../src/db/migrate.ts";

const location = resolveDatabaseLocation();

try {
  await runMigrations(db);
  console.info(
    `Applied database migrations to ${location.databasePath ?? location.configuredPath}.`
  );
} finally {
  closeDatabaseClient(db);
}

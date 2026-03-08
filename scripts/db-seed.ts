import "dotenv/config";

import { closeDatabaseClient, db } from "../src/db/client.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { seedDevelopmentDatabase } from "../src/db/seed.ts";

const location = resolveDatabaseLocation();

try {
  await seedDevelopmentDatabase(db);
  console.info(
    `Seeded development data into ${location.databasePath ?? location.configuredPath}.`
  );
} finally {
  closeDatabaseClient(db);
}

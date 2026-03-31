import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { ensureDatabaseDirectory, resolveDatabaseLocation } from "./config.ts";
import * as schema from "./schema/index.ts";

export type DatabaseClient = LibSQLDatabase<typeof schema> & {
  $client: Client;
};

export type DatabaseQueryClient = Omit<DatabaseClient, "$client" | "batch">;

export interface DatabaseClientOptions {
  databaseUrl?: string;
  logger?: boolean;
}

export function createDatabaseClient(
  options: DatabaseClientOptions = {}
): DatabaseClient {
  const location = resolveDatabaseLocation(options.databaseUrl);
  const authToken =
    process.env.DATABASE_AUTH_TOKEN?.trim() ||
    process.env.LIBSQL_AUTH_TOKEN?.trim() ||
    undefined;

  ensureDatabaseDirectory(location.databasePath);
  const client = createClient({
    authToken,
    url: location.connectionUrl
  });

  return drizzle({
    client,
    schema,
    logger: options.logger ?? false
  });
}

export function closeDatabaseClient(database: DatabaseClient): void {
  database.$client.close();
}

const globalForDatabase = globalThis as {
  __japaneseCustomStudyDb__?: DatabaseClient;
};
export const db =
  globalForDatabase.__japaneseCustomStudyDb__ ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.__japaneseCustomStudyDb__ = db;
}

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import { ensureDatabaseDirectory, resolveDatabaseLocation } from "./config.ts";
import * as schema from "./schema/index.ts";

export type DatabaseClient = LibSQLDatabase<typeof schema> & {
  $client: Client;
};

export interface DatabaseClientOptions {
  databaseUrl?: string;
  logger?: boolean;
  preferEmbeddedReplica?: boolean;
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

  const useEmbeddedReplica =
    options.preferEmbeddedReplica === true &&
    location.isRemote &&
    location.replicaPath;

  if (useEmbeddedReplica) {
    ensureDatabaseDirectory(location.replicaPath);
  }

  const client = createClient(
    useEmbeddedReplica
      ? {
          authToken,
          syncUrl: location.connectionUrl,
          url: `file:${location.replicaPath}`
        }
      : {
          authToken,
          url: location.connectionUrl
        }
  );

  return drizzle({
    client,
    schema,
    logger: options.logger ?? false
  });
}

export function closeDatabaseClient(database: DatabaseClient): void {
  database.$client.close();
}

export async function syncDatabaseClient(
  database: DatabaseClient
): Promise<void> {
  if ("sync" in database.$client && typeof database.$client.sync === "function") {
    await database.$client.sync();
  }
}

const globalForDatabase = globalThis as {
  __japaneseCustomStudyDb__?: DatabaseClient;
};

export function shouldPreferEmbeddedReplica(): boolean {
  return process.env.JCS_ENABLE_EMBEDDED_REPLICA === "1";
}

export const db =
  globalForDatabase.__japaneseCustomStudyDb__ ??
  createDatabaseClient({
    preferEmbeddedReplica: shouldPreferEmbeddedReplica()
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.__japaneseCustomStudyDb__ = db;
}

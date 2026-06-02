import {
  createDatabaseClient,
  type DatabaseClient
} from "./create-client.ts";

export {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient,
  type DatabaseClientOptions,
  type DatabaseQueryClient
} from "./create-client.ts";

const globalForDatabase = globalThis as {
  __japaneseCustomStudyDb__?: DatabaseClient;
};
export const db =
  globalForDatabase.__japaneseCustomStudyDb__ ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.__japaneseCustomStudyDb__ = db;
}

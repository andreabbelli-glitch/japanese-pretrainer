import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import { listMediaCached } from "@/lib/data-cache";

describe("media list cache", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-media-cache-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("deduplicates concurrent media list getters into one database read", async () => {
    const mediaQuerySpy = vi.spyOn(database.query.media, "findMany");

    const [first, second] = await Promise.all([
      listMediaCached(database),
      listMediaCached(database)
    ]);

    expect(first).toEqual(second);
    expect(mediaQuerySpy).toHaveBeenCalledTimes(1);

    mediaQuerySpy.mockRestore();
  });
});

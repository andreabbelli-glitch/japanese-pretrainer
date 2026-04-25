import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { getMediaBySlugCached } from "@/lib/data-cache";

describe("media-by-slug cache", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-media-by-slug-cache-"));
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

  it("deduplicates concurrent media slug getters into one database read", async () => {
    const mediaQuerySpy = vi.spyOn(database.query.media, "findFirst");

    const [first, second] = await Promise.all([
      getMediaBySlugCached(database, developmentFixture.mediaSlug),
      getMediaBySlugCached(database, developmentFixture.mediaSlug)
    ]);

    expect(first).toEqual(second);
    expect(mediaQuerySpy).toHaveBeenCalledTimes(1);

    mediaQuerySpy.mockRestore();
  });
});

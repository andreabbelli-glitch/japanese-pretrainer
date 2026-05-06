import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { listMediaCached } from "@/lib/data-cache";
import {
  cleanupTestDatabase,
  setupTestDatabase,
  type TestDatabaseFixture
} from "./helpers/test-db";

describe("media list cache", () => {
  let fixture: TestDatabaseFixture;
  let database: DatabaseClient;

  beforeEach(async () => {
    fixture = await setupTestDatabase({
      prefix: "jcs-media-cache-",
      seedDevelopmentFixture: true
    });
    database = fixture.database;
  });

  afterEach(async () => {
    await cleanupTestDatabase(fixture);
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

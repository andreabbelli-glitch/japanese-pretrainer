import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { developmentFixture } from "@/db/seed";
import { getMediaBySlugCached } from "@/lib/data-cache";
import {
  cleanupTestDatabase,
  setupTestDatabase,
  type TestDatabaseFixture
} from "./helpers/test-db";

describe("media-by-slug cache", () => {
  let fixture: TestDatabaseFixture;
  let database: DatabaseClient;

  beforeEach(async () => {
    fixture = await setupTestDatabase({
      prefix: "jcs-media-by-slug-cache-",
      seedDevelopmentFixture: true
    });
    database = fixture.database;
  });

  afterEach(async () => {
    await cleanupTestDatabase(fixture);
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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import * as dataCacheModule from "@/lib/data-cache";
import { getGlossaryPageData } from "@/features/glossary/server";
import * as settingsModule from "@/features/settings/server";
import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("glossary page query scheduling", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-glossary-page-scheduling-")
    );
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("starts the default-sort lookup before the media lookup resolves", async () => {
    const schedule = createQuerySchedulingHarness();
    const resolvedMedia = await dataCacheModule.getMediaBySlugCached(
      database,
      developmentFixture.mediaSlug
    );
    const mediaLookupGate =
      schedule.gate<typeof resolvedMedia>("media lookup");
    const defaultSortGate = schedule.gate("default sort");
    const originalGetGlossaryDefaultSort =
      settingsModule.getGlossaryDefaultSort;

    const mediaLookupSpy = vi
      .spyOn(dataCacheModule, "getMediaBySlugCached")
      .mockImplementation(async (...args) => {
        void args;
        return mediaLookupGate.loader()();
      });
    const defaultSortSpy = vi
      .spyOn(settingsModule, "getGlossaryDefaultSort")
      .mockImplementation(async (...args) => {
        defaultSortGate.loader()();
        return originalGetGlossaryDefaultSort(...args);
      });

    const pageDataPromise = getGlossaryPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    try {
      await schedule.expectStarted(
        "media lookup",
        "default sort"
      );
      schedule.expectNotSettled("media lookup");
    } finally {
      mediaLookupGate.resolve(resolvedMedia);
      await schedule.releaseAll();
      await pageDataPromise;
      mediaLookupSpy.mockRestore();
      defaultSortSpy.mockRestore();
    }
  });
});

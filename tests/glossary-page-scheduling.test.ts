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
import * as settingsModule from "@/lib/settings";

function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

async function waitForTruthy(
  predicate: () => boolean,
  message: string,
  attempts = 50
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(message);
}

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
    const resolvedMedia = await dataCacheModule.getMediaBySlugCached(
      database,
      developmentFixture.mediaSlug
    );
    const mediaLookupGate = createDeferred<typeof resolvedMedia>();
    let mediaLookupStarted = false;
    let defaultSortStarted = false;
    const originalGetGlossaryDefaultSort =
      settingsModule.getGlossaryDefaultSort;

    const mediaLookupSpy = vi
      .spyOn(dataCacheModule, "getMediaBySlugCached")
      .mockImplementation(async (...args) => {
        void args;
        mediaLookupStarted = true;
        return mediaLookupGate.promise;
      });
    const defaultSortSpy = vi
      .spyOn(settingsModule, "getGlossaryDefaultSort")
      .mockImplementation(async (...args) => {
        defaultSortStarted = true;
        return originalGetGlossaryDefaultSort(...args);
      });

    const pageDataPromise = getGlossaryPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    try {
      await waitForTruthy(
        () => mediaLookupStarted,
        "Expected the local glossary media lookup to start."
      );
      await waitForTruthy(
        () => defaultSortStarted,
        "Expected the default sort lookup to start before the media lookup resolved."
      );
    } finally {
      mediaLookupGate.resolve(resolvedMedia);
      await pageDataPromise;
      mediaLookupSpy.mockRestore();
      defaultSortSpy.mockRestore();
    }
  });
});

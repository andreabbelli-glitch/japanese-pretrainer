import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import * as dbModule from "@/db";
import * as fsrsOptimizerModule from "@/lib/fsrs-optimizer";
import { applyReviewGrade } from "@/lib/review-service";
import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";

const primarySubjectKey = `entry:term:${developmentFixture.termDbId}`;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
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

describe("review service query scheduling", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-review-service-query-scheduling-")
    );
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("starts the member-card lookup before the subject state settles during grading", async () => {
    const subjectStateGate = createDeferred();
    let subjectStateStarted = false;
    let memberCardLookupStarted = false;
    const originalGetReviewSubjectStateByKey = dbModule.getReviewSubjectStateByKey;
    const originalListReviewCardIdsByEntryRefs =
      dbModule.listReviewCardIdsByEntryRefs;
    const subjectStateSpy = vi
      .spyOn(dbModule, "getReviewSubjectStateByKey")
      .mockImplementation(async (...args) => {
        subjectStateStarted = true;
        const resultPromise = originalGetReviewSubjectStateByKey(...args);
        await subjectStateGate.promise;
        return resultPromise;
      });
    const memberCardLookupSpy = vi
      .spyOn(dbModule, "listReviewCardIdsByEntryRefs")
      .mockImplementation(async (...args) => {
        memberCardLookupStarted = true;
        return originalListReviewCardIdsByEntryRefs(...args);
      });

    const gradePromise = applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T12:00:00.000Z"),
      rating: "good"
    });

    try {
      await waitForTruthy(
        () => subjectStateStarted,
        "Expected the subject state lookup to start."
      );
      await waitForTruthy(
        () => memberCardLookupStarted,
        "Expected the member-card lookup to start before the subject state resolved."
      );
    } finally {
      subjectStateGate.resolve();
      await gradePromise;
      subjectStateSpy.mockRestore();
      memberCardLookupSpy.mockRestore();
    }
  });

  it("starts the FSRS snapshot lookup before the subject context settles during grading", async () => {
    const subjectStateGate = createDeferred();
    let subjectStateStarted = false;
    let fsrsSnapshotStarted = false;
    const originalGetReviewSubjectStateByKey = dbModule.getReviewSubjectStateByKey;
    const originalGetFsrsOptimizerSnapshot =
      fsrsOptimizerModule.getFsrsOptimizerSnapshot;
    const subjectStateSpy = vi
      .spyOn(dbModule, "getReviewSubjectStateByKey")
      .mockImplementation(async (...args) => {
        subjectStateStarted = true;
        const resultPromise = originalGetReviewSubjectStateByKey(...args);
        await subjectStateGate.promise;
        return resultPromise;
      });
    const fsrsSnapshotSpy = vi
      .spyOn(fsrsOptimizerModule, "getFsrsOptimizerSnapshot")
      .mockImplementation(async (...args) => {
        fsrsSnapshotStarted = true;
        return originalGetFsrsOptimizerSnapshot(...args);
      });

    const gradePromise = applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T12:00:00.000Z"),
      rating: "good"
    });

    try {
      await waitForTruthy(
        () => subjectStateStarted,
        "Expected the subject context lookup to start."
      );
      await waitForTruthy(
        () => fsrsSnapshotStarted,
        "Expected the FSRS snapshot lookup to start before the subject context resolved."
      );
    } finally {
      subjectStateGate.resolve();
      await gradePromise;
      subjectStateSpy.mockRestore();
      fsrsSnapshotSpy.mockRestore();
    }
  });
});

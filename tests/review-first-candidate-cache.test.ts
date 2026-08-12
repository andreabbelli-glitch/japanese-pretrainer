import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cacheLoadCounts,
  cacheStore,
  cacheTagsByKey,
  getFsrsOptimizerRuntimeContextMock,
  getFsrsOptimizerRuntimeSnapshotMock,
  getFsrsOptimizerSnapshotMock,
  revalidateTagMock,
  unstableCacheMock
} = vi.hoisted(() => {
  const cacheLoadCounts = new Map<string, number>();
  const cacheStore = new Map<string, Promise<unknown>>();
  const cacheTagsByKey = new Map<string, string[]>();
  const revalidateTagMock = vi.fn((tag: string) => {
    for (const [cacheKey, tags] of cacheTagsByKey) {
      if (tags.includes(tag)) {
        cacheStore.delete(cacheKey);
      }
    }
  });
  const unstableCacheMock = vi.fn(
    (
      loader: () => Promise<unknown>,
      keyParts: string[],
      options?: { tags?: string[] }
    ) => {
      const cacheKey = JSON.stringify(keyParts);

      cacheTagsByKey.set(cacheKey, options?.tags ?? []);

      return async () => {
        if (!cacheStore.has(cacheKey)) {
          cacheLoadCounts.set(
            cacheKey,
            (cacheLoadCounts.get(cacheKey) ?? 0) + 1
          );
          cacheStore.set(cacheKey, loader());
        }

        return cacheStore.get(cacheKey);
      };
    }
  );

  return {
    cacheLoadCounts,
    cacheStore,
    cacheTagsByKey,
    getFsrsOptimizerRuntimeContextMock: vi.fn(),
    getFsrsOptimizerRuntimeSnapshotMock: vi.fn(),
    getFsrsOptimizerSnapshotMock: vi.fn(),
    revalidateTagMock,
    unstableCacheMock
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: revalidateTagMock,
  unstable_cache: unstableCacheMock
}));

vi.mock("@/features/cache/server/data-cache", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/cache/server/data-cache")
  >("@/features/cache/server/data-cache");

  return {
    ...actual,
    canUseDataCache: vi.fn(() => true)
  };
});

vi.mock("@/features/fsrs-optimizer/server", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/fsrs-optimizer/server")
  >("@/features/fsrs-optimizer/server");

  getFsrsOptimizerRuntimeContextMock.mockImplementation(
    actual.getFsrsOptimizerRuntimeContext
  );
  getFsrsOptimizerRuntimeSnapshotMock.mockImplementation(
    actual.getFsrsOptimizerRuntimeSnapshot
  );
  getFsrsOptimizerSnapshotMock.mockImplementation(
    actual.getFsrsOptimizerSnapshot
  );

  return {
    ...actual,
    getFsrsOptimizerRuntimeContext: getFsrsOptimizerRuntimeContextMock,
    getFsrsOptimizerRuntimeSnapshot: getFsrsOptimizerRuntimeSnapshotMock,
    getFsrsOptimizerSnapshot: getFsrsOptimizerSnapshotMock
  };
});

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { reviewSubjectState } from "@/db/schema";
import {
  revalidateGlossarySummaryCache,
  revalidateReviewCardContentCache,
  revalidateReviewSummaryCache,
  revalidateSettingsCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/features/cache/server/data-cache";
import {
  getFsrsOptimizerCacheKeyPart,
  writeFsrsOptimizedParameters,
  writeFsrsOptimizerConfig
} from "@/features/fsrs-optimizer/server";
import { getLocalIsoTimeBucketKey } from "@/features/shared/model/local-date";
import { loadReviewPageDataSession } from "@/features/review/server/page-data";
import {
  loadReviewLaunchCandidatesCached,
  loadReviewWorkspaceV2
} from "@/features/review/server/loader";
import {
  getGlobalReviewFirstCandidateLoadResult,
  hydrateReviewCard
} from "@/features/review/server";
import { applyReviewGrade } from "@/features/review/server/service";
import {
  resetReviewCardProgress,
  setReviewCardSuspended
} from "@/features/review/server/mutations";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";
import { REVIEW_QUEUE_ORDERING_VERSION } from "@/features/review/model/queue-ordering";
import {
  buildReviewSubjectStateRow,
  seedSingleReviewCardFixture
} from "./helpers/review-fixture";
import { createDeferred, waitForTruthy } from "./helpers/async";

function buildTestFsrsSnapshot(recognitionWeights: number[] | null = null) {
  return {
    config: {
      desiredRetention: 0.9,
      enabled: true,
      minDaysBetweenRuns: 30,
      minNewReviews: 500,
      presetStrategy: "card_type_v1" as const
    },
    presets: {
      concept: null,
      recognition: recognitionWeights
        ? {
            desiredRetention: 0.9,
            presetKey: "recognition" as const,
            trainedAt: "2026-03-10T10:00:00.000Z",
            trainingReviewCount: 42,
            weights: recognitionWeights
          }
        : null
    },
    state: {
      bindingVersion: "test",
      lastAttemptAt: null,
      lastCheckAt: null,
      lastSuccessfulTrainingAt: null,
      lastTrainingError: null,
      newEligibleReviewsSinceLastTraining: 0,
      totalEligibleReviewsAtLastTraining: 0
    }
  };
}

function buildTestFsrsWeights(value: number) {
  return reviewSchedulerConfig.fsrs.w.map(() => value);
}

describe("global review first-candidate cache", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    cacheLoadCounts.clear();
    cacheStore.clear();
    cacheTagsByKey.clear();
    getFsrsOptimizerRuntimeContextMock.mockClear();
    getFsrsOptimizerRuntimeSnapshotMock.mockClear();
    getFsrsOptimizerSnapshotMock.mockClear();
    unstableCacheMock.mockClear();
    revalidateTagMock.mockClear();
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-first-candidate-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reuses the cached snapshot within a local time bucket and refreshes on the next bucket", async () => {
    await seedSingleReviewCardFixture(database);

    vi.useFakeTimers();
    try {
      const firstTime = new Date(2026, 2, 10, 10, 1, 0, 0);
      const secondTime = new Date(2026, 2, 10, 10, 8, 0, 0);
      const thirdTime = new Date(2026, 2, 10, 10, 11, 0, 0);
      const firstBucketKey = getLocalIsoTimeBucketKey(firstTime);
      const thirdBucketKey = getLocalIsoTimeBucketKey(thirdTime);
      const fsrsCacheKeyPart = await getFsrsOptimizerCacheKeyPart(database);

      vi.setSystemTime(firstTime);
      const first = await getGlobalReviewFirstCandidateLoadResult({}, database);

      vi.setSystemTime(secondTime);
      const second = await getGlobalReviewFirstCandidateLoadResult(
        {},
        database
      );

      vi.setSystemTime(thirdTime);
      const third = await getGlobalReviewFirstCandidateLoadResult({}, database);

      expect(first.kind).toBe("ready");
      expect(second.kind).toBe("ready");
      expect(third.kind).toBe("ready");
      expect(second).toEqual(first);

      const firstCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `ordering:${REVIEW_QUEUE_ORDERING_VERSION}`,
        `bucket:${firstBucketKey}`,
        `fsrs:${fsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
        "extra-new-anchor:",
        "notice:",
        "segment:",
        "selected:",
        "show:0"
      ]);
      const thirdCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `ordering:${REVIEW_QUEUE_ORDERING_VERSION}`,
        `bucket:${thirdBucketKey}`,
        `fsrs:${fsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
        "extra-new-anchor:",
        "notice:",
        "segment:",
        "selected:",
        "show:0"
      ]);

      expect(unstableCacheMock).toHaveBeenCalled();
      expect(cacheStore.has(firstCacheKey)).toBe(true);
      expect(cacheStore.has(thirdCacheKey)).toBe(true);

      const firstCacheHits = unstableCacheMock.mock.calls.filter(
        ([, keyParts]) => JSON.stringify(keyParts) === firstCacheKey
      );
      const thirdCacheHits = unstableCacheMock.mock.calls.filter(
        ([, keyParts]) => JSON.stringify(keyParts) === thirdCacheKey
      );
      expect(firstCacheHits).toHaveLength(2);
      expect(thirdCacheHits).toHaveLength(1);
      expect(getFsrsOptimizerRuntimeContextMock).toHaveBeenCalledTimes(3);
      expect(getFsrsOptimizerRuntimeSnapshotMock).not.toHaveBeenCalled();
      expect(getFsrsOptimizerSnapshotMock).not.toHaveBeenCalled();

      revalidateReviewSummaryCache("media_a");
      revalidateGlossarySummaryCache("media_a");
      revalidateSettingsCache();

      expect(revalidateTagMock).toHaveBeenCalledWith(
        REVIEW_FIRST_CANDIDATE_TAG,
        "max"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("batches cold FSRS and study settings into one database read", async () => {
    await seedSingleReviewCardFixture(database);
    const settingsReadSpy = vi.spyOn(database.query.userSetting, "findMany");

    const result = await getGlobalReviewFirstCandidateLoadResult({}, database);

    expect(result.kind).toBe("ready");
    expect(settingsReadSpy).toHaveBeenCalledTimes(1);

    settingsReadSpy.mockRestore();
  });

  it("reuses the time-sensitive review launch cache within a local bucket and refreshes on the next bucket", async () => {
    const databaseAllSpy = vi.spyOn(
      database as DatabaseClient & {
        all: (sql: string) => Promise<unknown[]>;
      },
      "all"
    );
    const firstTime = new Date(2026, 2, 10, 10, 1, 0, 0);
    const secondTime = new Date(2026, 2, 10, 10, 8, 0, 0);
    const thirdTime = new Date(2026, 2, 10, 10, 11, 0, 0);
    const firstCandidateKey = JSON.stringify([
      "review-launch-candidates",
      `bucket:${getLocalIsoTimeBucketKey(firstTime)}`
    ]);
    const thirdCandidateKey = JSON.stringify([
      "review-launch-candidates",
      `bucket:${getLocalIsoTimeBucketKey(thirdTime)}`
    ]);

    await loadReviewLaunchCandidatesCached(database, firstTime.toISOString());
    await loadReviewLaunchCandidatesCached(database, secondTime.toISOString());
    await loadReviewLaunchCandidatesCached(database, thirdTime.toISOString());

    expect(databaseAllSpy).toHaveBeenCalledTimes(2);
    expect(cacheStore.has(firstCandidateKey)).toBe(true);
    expect(cacheStore.has(thirdCandidateKey)).toBe(true);

    databaseAllSpy.mockRestore();
  });

  it("reuses the cached hydrated review card for repeated loads", async () => {
    await seedSingleReviewCardFixture(database);
    const fsrsCacheKeyPart = await getFsrsOptimizerCacheKeyPart(database);

    const coldStart = performance.now();
    const first = await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    const coldMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const second = await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    const warmMs = performance.now() - warmStart;

    console.info(
      `[review-card-hydration-cache] cold=${coldMs.toFixed(2)}ms warm=${warmMs.toFixed(2)}ms`
    );

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(warmMs).toBeLessThanOrEqual(coldMs);

    const cacheKey = JSON.stringify([
      "review",
      "hydrated-card",
      "card_a",
      `fsrs:${fsrsCacheKeyPart}`
    ]);

    expect(unstableCacheMock).toHaveBeenCalled();
    expect(cacheStore.has(cacheKey)).toBe(true);
    expect(getFsrsOptimizerRuntimeContextMock).toHaveBeenCalledTimes(2);
    expect(getFsrsOptimizerRuntimeSnapshotMock).not.toHaveBeenCalled();
    expect(getFsrsOptimizerSnapshotMock).not.toHaveBeenCalled();

    revalidateReviewSummaryCache("media_a");
    revalidateGlossarySummaryCache("media_a");

    expect(revalidateTagMock).toHaveBeenCalledWith(
      REVIEW_FIRST_CANDIDATE_TAG,
      "max"
    );
  });

  it("keeps static card content warm when a review mutation expires dynamic hydration", async () => {
    await seedSingleReviewCardFixture(database);
    const fsrsCacheKeyPart = await getFsrsOptimizerCacheKeyPart(database);
    const hydrationCacheKey = JSON.stringify([
      "review",
      "hydrated-card",
      "card_a",
      `fsrs:${fsrsCacheKeyPart}`
    ]);
    const contentCacheKey = JSON.stringify([
      "review",
      "card-content",
      "card_a"
    ]);

    await hydrateReviewCard({ cardId: "card_a", database });

    expect(cacheLoadCounts.get(hydrationCacheKey)).toBe(1);
    expect(cacheLoadCounts.get(contentCacheKey)).toBe(1);

    revalidateReviewSummaryCache("media_a");

    expect(cacheStore.has(hydrationCacheKey)).toBe(false);
    expect(cacheStore.has(contentCacheKey)).toBe(true);

    await hydrateReviewCard({ cardId: "card_a", database });

    expect(cacheLoadCounts.get(hydrationCacheKey)).toBe(2);
    expect(cacheLoadCounts.get(contentCacheKey)).toBe(1);
  });

  it("recomposes suspended and reset state over warm static card content", async () => {
    await seedSingleReviewCardFixture(database);
    const contentCacheKey = JSON.stringify([
      "review",
      "card-content",
      "card_a"
    ]);

    const initial = await hydrateReviewCard({ cardId: "card_a", database });

    expect(initial?.effectiveState).not.toBe("suspended");
    expect(cacheLoadCounts.get(contentCacheKey)).toBe(1);

    await setReviewCardSuspended({
      cardId: "card_a",
      database,
      now: new Date("2026-03-10T10:00:00.000Z"),
      suspended: true
    });
    revalidateReviewSummaryCache("media_a");

    const suspended = await hydrateReviewCard({
      cardId: "card_a",
      database
    });

    expect(suspended?.effectiveState).toBe("suspended");
    expect(cacheLoadCounts.get(contentCacheKey)).toBe(1);

    await resetReviewCardProgress({
      cardId: "card_a",
      database,
      now: new Date("2026-03-10T10:01:00.000Z")
    });
    revalidateReviewSummaryCache("media_a");

    const reset = await hydrateReviewCard({ cardId: "card_a", database });

    expect(reset?.effectiveState).toBe("new");
    expect(reset?.reviewSeedState.reps).toBe(0);
    expect(cacheLoadCounts.get(contentCacheKey)).toBe(1);
  });

  it("loads one FSRS ordering context when the global queue has no selected card", async () => {
    await seedSingleReviewCardFixture(database);

    await database.insert(reviewSubjectState).values(
      buildReviewSubjectStateRow({
        cardId: "card_a",
        difficulty: 2.5,
        dueAt: "2999-01-01T00:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        scheduledDays: 7,
        state: "review",
        stability: 3,
        subjectKey: "card:card_a"
      })
    );

    const result = await getGlobalReviewFirstCandidateLoadResult({}, database);

    expect(result.kind).toBe("ready");
    expect(
      result.kind === "ready" ? result.data.selectedCard : null
    ).toBeNull();
    expect(getFsrsOptimizerRuntimeContextMock).toHaveBeenCalledTimes(1);
    expect(getFsrsOptimizerRuntimeSnapshotMock).not.toHaveBeenCalled();
  });

  it("serves a warm first-candidate cache hit without waiting for FSRS snapshot lookup", async () => {
    await seedSingleReviewCardFixture(database);
    await getGlobalReviewFirstCandidateLoadResult({}, database);
    getFsrsOptimizerRuntimeSnapshotMock.mockClear();

    const fsrsSnapshotDeferred =
      createDeferred<ReturnType<typeof buildTestFsrsSnapshot>>();
    const originalFsrsSnapshotImplementation =
      getFsrsOptimizerRuntimeSnapshotMock.getMockImplementation();
    let cacheHitResolved = false;
    const fsrsSnapshotSpy =
      getFsrsOptimizerRuntimeSnapshotMock.mockImplementation(
        async () => fsrsSnapshotDeferred.promise
      );

    const cachedResultPromise = getGlobalReviewFirstCandidateLoadResult(
      {},
      database
    ).then((result) => {
      cacheHitResolved = true;
      return result;
    });

    try {
      await waitForTruthy(
        () => cacheHitResolved,
        "Expected the warm first-candidate cache hit to resolve."
      );

      expect(fsrsSnapshotSpy).not.toHaveBeenCalled();
    } finally {
      fsrsSnapshotDeferred.resolve(buildTestFsrsSnapshot());
      await cachedResultPromise;
      if (originalFsrsSnapshotImplementation) {
        getFsrsOptimizerRuntimeSnapshotMock.mockImplementation(
          originalFsrsSnapshotImplementation
        );
      }
    }
  });

  it("reloads the first-candidate cache after FSRS optimized parameters change", async () => {
    await seedSingleReviewCardFixture(database);

    vi.useFakeTimers();
    try {
      const now = new Date(2026, 2, 10, 10, 1, 0, 0);
      vi.setSystemTime(now);

      const initialFsrsCacheKeyPart =
        await getFsrsOptimizerCacheKeyPart(database);
      const cacheBucketKey = getLocalIsoTimeBucketKey(now);
      const first = await getGlobalReviewFirstCandidateLoadResult({}, database);

      expect(first.kind).toBe("ready");
      expect(
        first.kind === "ready"
          ? first.data.selectedCard?.reviewSeedState.fsrsWeights
          : null
      ).toBeNull();
      expect(initialFsrsCacheKeyPart).toBe("none|none|none");

      await writeFsrsOptimizedParameters(
        {
          desiredRetention: 0.91,
          presetKey: "recognition",
          trainedAt: "2026-03-10T10:02:00.000Z",
          trainingReviewCount: 42,
          weights: buildTestFsrsWeights(1)
        },
        database,
        "2026-03-10T10:02:00.000Z"
      );

      const updatedFsrsCacheKeyPart =
        await getFsrsOptimizerCacheKeyPart(database);
      const firstCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `ordering:${REVIEW_QUEUE_ORDERING_VERSION}`,
        `bucket:${cacheBucketKey}`,
        `fsrs:${initialFsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
        "extra-new-anchor:",
        "notice:",
        "segment:",
        "selected:",
        "show:0"
      ]);
      const secondCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `ordering:${REVIEW_QUEUE_ORDERING_VERSION}`,
        `bucket:${cacheBucketKey}`,
        `fsrs:${updatedFsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
        "extra-new-anchor:",
        "notice:",
        "segment:",
        "selected:",
        "show:0"
      ]);

      const second = await getGlobalReviewFirstCandidateLoadResult(
        {},
        database
      );

      expect(second.kind).toBe("ready");
      expect(updatedFsrsCacheKeyPart).not.toBe(initialFsrsCacheKeyPart);
      expect(cacheStore.has(firstCacheKey)).toBe(false);
      expect(cacheStore.has(secondCacheKey)).toBe(true);
      expect(secondCacheKey).not.toBe(firstCacheKey);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serves a warm hydrated-card cache hit without waiting for FSRS snapshot lookup", async () => {
    await seedSingleReviewCardFixture(database);
    await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    getFsrsOptimizerRuntimeSnapshotMock.mockClear();

    const fsrsSnapshotDeferred =
      createDeferred<ReturnType<typeof buildTestFsrsSnapshot>>();
    const originalFsrsSnapshotImplementation =
      getFsrsOptimizerRuntimeSnapshotMock.getMockImplementation();
    let cacheHitResolved = false;
    const fsrsSnapshotSpy =
      getFsrsOptimizerRuntimeSnapshotMock.mockImplementation(
        async () => fsrsSnapshotDeferred.promise
      );

    const cachedResultPromise = hydrateReviewCard({
      cardId: "card_a",
      database
    }).then((result) => {
      cacheHitResolved = true;
      return result;
    });

    try {
      await waitForTruthy(
        () => cacheHitResolved,
        "Expected the warm hydrated-card cache hit to resolve."
      );

      expect(fsrsSnapshotSpy).not.toHaveBeenCalled();
    } finally {
      fsrsSnapshotDeferred.resolve(buildTestFsrsSnapshot());
      await cachedResultPromise;
      if (originalFsrsSnapshotImplementation) {
        getFsrsOptimizerRuntimeSnapshotMock.mockImplementation(
          originalFsrsSnapshotImplementation
        );
      }
    }
  });

  it("reloads the hydrated-card cache after FSRS optimized parameters change", async () => {
    await seedSingleReviewCardFixture(database);

    const initialWeights = buildTestFsrsWeights(1);
    const updatedWeights = buildTestFsrsWeights(2);
    await writeFsrsOptimizedParameters(
      {
        desiredRetention: 0.9,
        presetKey: "recognition",
        trainedAt: "2026-03-10T10:01:00.000Z",
        trainingReviewCount: 42,
        weights: initialWeights
      },
      database,
      "2026-03-10T10:01:00.000Z"
    );
    const initialFsrsCacheKeyPart =
      await getFsrsOptimizerCacheKeyPart(database);
    const first = await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    const firstCacheKey = JSON.stringify([
      "review",
      "hydrated-card",
      "card_a",
      `fsrs:${initialFsrsCacheKeyPart}`
    ]);

    expect(first).not.toBeNull();
    expect(cacheStore.has(firstCacheKey)).toBe(true);

    await writeFsrsOptimizedParameters(
      {
        desiredRetention: 0.9,
        presetKey: "recognition",
        trainedAt: "2026-03-10T10:02:00.000Z",
        trainingReviewCount: 42,
        weights: updatedWeights
      },
      database,
      "2026-03-10T10:02:00.000Z"
    );

    const updatedFsrsCacheKeyPart =
      await getFsrsOptimizerCacheKeyPart(database);
    const second = await hydrateReviewCard({
      cardId: "card_a",
      database
    });
    const secondCacheKey = JSON.stringify([
      "review",
      "hydrated-card",
      "card_a",
      `fsrs:${updatedFsrsCacheKeyPart}`
    ]);

    expect(second).not.toBeNull();
    expect(updatedFsrsCacheKeyPart).not.toBe(initialFsrsCacheKeyPart);
    expect(cacheStore.has(secondCacheKey)).toBe(true);
    expect(secondCacheKey).not.toBe(firstCacheKey);
  });

  it("revalidates review-first-candidate-tagged caches when FSRS runtime inputs change", async () => {
    await writeFsrsOptimizerConfig(
      {
        desiredRetention: 0.91,
        enabled: true,
        minDaysBetweenRuns: 30,
        minNewReviews: 500,
        presetStrategy: "card_type_v1"
      },
      database,
      "2026-03-10T12:00:00.000Z"
    );
    await writeFsrsOptimizedParameters(
      {
        desiredRetention: 0.91,
        presetKey: "recognition",
        trainedAt: "2026-03-10T12:01:00.000Z",
        trainingReviewCount: 42,
        weights: buildTestFsrsWeights(1)
      },
      database,
      "2026-03-10T12:01:00.000Z"
    );

    expect(revalidateTagMock).toHaveBeenCalledWith(
      REVIEW_FIRST_CANDIDATE_TAG,
      "max"
    );
  });

  it("refreshes the introduced-today count when review workspace bypasses cache", async () => {
    await seedSingleReviewCardFixture(database);

    const asOf = new Date("2026-03-10T12:00:00.000Z");

    const initial = await loadReviewWorkspaceV2({
      database,
      mediaIds: ["media_a"],
      now: asOf
    });

    await applyReviewGrade({
      cardId: "card_a",
      database,
      now: asOf,
      rating: "good"
    });

    const stale = await loadReviewWorkspaceV2({
      database,
      mediaIds: ["media_a"],
      now: asOf
    });
    const refreshed = await loadReviewWorkspaceV2({
      bypassCache: true,
      database,
      mediaIds: ["media_a"],
      now: asOf
    });

    expect(initial.newIntroducedTodayCount).toBe(0);
    expect(stale.newIntroducedTodayCount).toBe(0);
    expect(refreshed.newIntroducedTodayCount).toBe(1);
  });

  it("reuses the stable workspace cache for read-only session hydration", async () => {
    await seedSingleReviewCardFixture(database);

    const first = await loadReviewPageDataSession(
      {
        scope: "global",
        searchParams: {}
      },
      database
    );
    const second = await loadReviewPageDataSession(
      {
        scope: "global",
        searchParams: {}
      },
      database
    );

    expect(first.selectedCard).not.toBeNull();
    expect(second).toEqual(first);

    expect(unstableCacheMock).toHaveBeenCalled();
    expect(
      [...cacheStore.keys()].some((cacheKey) =>
        cacheKey.includes('"review","stable-workspace"')
      )
    ).toBe(true);
  });

  it("keeps stable workspace content warm across grades and expires it on content changes", async () => {
    await seedSingleReviewCardFixture(database);
    const asOf = new Date("2026-03-10T10:00:00.000Z");

    await loadReviewWorkspaceV2({
      database,
      mediaIds: ["media_a"],
      now: asOf
    });

    const workspaceCacheKey = [...cacheStore.keys()].find((cacheKey) =>
      cacheKey.includes('"review","stable-workspace"')
    );

    expect(workspaceCacheKey).toBeDefined();
    expect(cacheLoadCounts.get(workspaceCacheKey!)).toBe(1);

    revalidateReviewSummaryCache("media_a");
    await loadReviewWorkspaceV2({
      database,
      mediaIds: ["media_a"],
      now: asOf
    });

    expect(cacheLoadCounts.get(workspaceCacheKey!)).toBe(1);

    revalidateReviewCardContentCache();
    await loadReviewWorkspaceV2({
      database,
      mediaIds: ["media_a"],
      now: asOf
    });

    expect(cacheLoadCounts.get(workspaceCacheKey!)).toBe(2);
  });
});

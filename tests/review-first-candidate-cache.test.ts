import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  cacheStore,
  getFsrsOptimizerRuntimeContextMock,
  getFsrsOptimizerRuntimeSnapshotMock,
  getFsrsOptimizerSnapshotMock,
  revalidateTagMock,
  unstableCacheMock
} = vi.hoisted(() => {
  const cacheStore = new Map<string, Promise<unknown>>();
  const revalidateTagMock = vi.fn();
  const unstableCacheMock = vi.fn(
    (loader: () => Promise<unknown>, keyParts: string[]) => {
      const cacheKey = JSON.stringify(keyParts);

      return async () => {
        if (!cacheStore.has(cacheKey)) {
          cacheStore.set(cacheKey, loader());
        }

        return cacheStore.get(cacheKey);
      };
    }
  );

  return {
    cacheStore,
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

vi.mock("@/lib/data-cache", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/data-cache")>(
      "@/lib/data-cache"
    );

  return {
    ...actual,
    canUseDataCache: vi.fn(() => true)
  };
});

vi.mock("@/lib/fsrs-optimizer", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fsrs-optimizer")>(
    "@/lib/fsrs-optimizer"
  );

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
  reviewSubjectState,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  revalidateGlossarySummaryCache,
  revalidateReviewSummaryCache,
  revalidateSettingsCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import {
  getFsrsOptimizerCacheKeyPart,
  writeFsrsOptimizedParameters,
  writeFsrsOptimizerConfig
} from "@/lib/fsrs-optimizer";
import { getLocalIsoTimeBucketKey } from "@/lib/local-date";
import { loadReviewPageDataSession } from "@/lib/review-page-data";
import {
  loadGlobalReviewOverviewDataCached,
  loadReviewLaunchCandidatesCached,
  loadReviewWorkspaceV2
} from "@/lib/review-loader";
import {
  getGlobalReviewFirstCandidateLoadResult,
  hydrateReviewCard
} from "@/lib/review";
import { applyReviewGrade } from "@/lib/review-service";
import {
  buildReviewSubjectStateRow,
  seedSingleReviewCardFixture
} from "./helpers/review-fixture";

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

describe("global review first-candidate cache", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    cacheStore.clear();
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
        `bucket:${firstBucketKey}`,
        `fsrs:${fsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
        "notice:",
        "segment:",
        "selected:",
        "show:0"
      ]);
      const thirdCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `bucket:${thirdBucketKey}`,
        `fsrs:${fsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
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
      expect(getFsrsOptimizerRuntimeContextMock).not.toHaveBeenCalled();
      expect(getFsrsOptimizerRuntimeSnapshotMock).toHaveBeenCalledTimes(2);
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

  it("reuses the time-sensitive review loader caches within a local bucket and refreshes on the next bucket", async () => {
    const databaseAllSpy = vi.spyOn(
      database as DatabaseClient & {
        all: (sql: string) => Promise<unknown[]>;
      },
      "all"
    );
    const firstTime = new Date(2026, 2, 10, 10, 1, 0, 0);
    const secondTime = new Date(2026, 2, 10, 10, 8, 0, 0);
    const thirdTime = new Date(2026, 2, 10, 10, 11, 0, 0);
    const firstOverviewKey = JSON.stringify([
      "review-global-overview",
      `bucket:${getLocalIsoTimeBucketKey(firstTime)}`
    ]);
    const thirdOverviewKey = JSON.stringify([
      "review-global-overview",
      `bucket:${getLocalIsoTimeBucketKey(thirdTime)}`
    ]);
    const firstCandidateKey = JSON.stringify([
      "review-launch-candidates",
      `bucket:${getLocalIsoTimeBucketKey(firstTime)}`
    ]);
    const thirdCandidateKey = JSON.stringify([
      "review-launch-candidates",
      `bucket:${getLocalIsoTimeBucketKey(thirdTime)}`
    ]);

    await loadGlobalReviewOverviewDataCached(database, firstTime);
    await loadReviewLaunchCandidatesCached(database, firstTime.toISOString());
    await loadGlobalReviewOverviewDataCached(database, secondTime);
    await loadReviewLaunchCandidatesCached(database, secondTime.toISOString());
    await loadGlobalReviewOverviewDataCached(database, thirdTime);
    await loadReviewLaunchCandidatesCached(database, thirdTime.toISOString());

    expect(databaseAllSpy).toHaveBeenCalledTimes(4);
    expect(cacheStore.has(firstOverviewKey)).toBe(true);
    expect(cacheStore.has(thirdOverviewKey)).toBe(true);
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

  it("skips FSRS snapshot loading when the global queue has no selected card", async () => {
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
    expect(getFsrsOptimizerRuntimeContextMock).not.toHaveBeenCalled();
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
        first.kind === "ready" ? first.data.selectedCard?.reviewSeedState.fsrsWeights : null
      ).toBeNull();
      expect(initialFsrsCacheKeyPart).toBe("none|none|none");

      await writeFsrsOptimizedParameters(
        {
          desiredRetention: 0.91,
          presetKey: "recognition",
          trainedAt: "2026-03-10T10:02:00.000Z",
          trainingReviewCount: 42,
          weights: new Array(17).fill(1)
        },
        database,
        "2026-03-10T10:02:00.000Z"
      );

      const updatedFsrsCacheKeyPart =
        await getFsrsOptimizerCacheKeyPart(database);
      const firstCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `bucket:${cacheBucketKey}`,
        `fsrs:${initialFsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
        "notice:",
        "segment:",
        "selected:",
        "show:0"
      ]);
      const secondCacheKey = JSON.stringify([
        "review",
        "global-first-candidate",
        `bucket:${cacheBucketKey}`,
        `fsrs:${updatedFsrsCacheKeyPart}`,
        "answered:0",
        "extra-new:0",
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
      expect(cacheStore.has(firstCacheKey)).toBe(true);
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

    const initialWeights = new Array(17).fill(1);
    const updatedWeights = new Array(17).fill(2);
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
        weights: new Array(17).fill(1)
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
});

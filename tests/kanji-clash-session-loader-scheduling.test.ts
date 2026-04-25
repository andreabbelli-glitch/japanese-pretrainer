import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("kanji clash session loader scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/features/kanji-clash/server/manual-contrast.ts");
    vi.doUnmock("@/features/kanji-clash/server/manual-queue-loader.ts");
    vi.doUnmock("@/features/kanji-clash/model/pairing.ts");
    vi.doUnmock("@/features/kanji-clash/model/queue.ts");
  });

  it("starts loading manual contrast candidates before eligible subjects settle", async () => {
    const eligibleSubjectsDeferred =
      createDeferred<Array<{ subjectKey: string }>>();
    const manualContrastSeedDeferred = createDeferred<{
      candidates: [];
      pairStates: Map<string, null>;
      suppressedContrastKeys: Set<string>;
    }>();
    let eligibleSubjectsStarted = false;
    let manualContrastStarted = false;

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      countKanjiClashAutomaticNewPairIntroductions: vi.fn(),
      listEligibleKanjiClashSubjects: vi.fn(() => {
        eligibleSubjectsStarted = true;
        return eligibleSubjectsDeferred.promise;
      }),
      listKanjiClashPairStatesByPairKeys: vi.fn()
    }));
    vi.doMock("@/features/kanji-clash/server/manual-contrast.ts", () => ({
      loadKanjiClashManualContrastCandidates: vi.fn(() => {
        manualContrastStarted = true;
        return manualContrastSeedDeferred.promise;
      })
    }));
    vi.doMock("@/features/kanji-clash/server/manual-queue-loader.ts", () => ({
      loadManualKanjiClashQueueSnapshot: vi.fn(() =>
        Promise.resolve({
          mode: "manual",
          requestedSize: null,
          rounds: [],
          scope: "global",
          snapshotAtIso: "2026-04-21T01:00:00.000Z",
          totalCount: 0
        })
      )
    }));
    vi.doMock("@/features/kanji-clash/model/pairing.ts", () => ({
      generateKanjiClashCandidates: vi.fn(() => [])
    }));
    vi.doMock("@/features/kanji-clash/model/queue.ts", () => ({
      buildKanjiClashQueueSnapshot: vi.fn()
    }));

    const { loadKanjiClashQueueSnapshot } =
      await import("@/features/kanji-clash/server/session-loader.ts");
    const queuePromise = loadKanjiClashQueueSnapshot({
      database: {} as never,
      mode: "manual",
      now: new Date("2026-04-21T01:00:00.000Z"),
      scope: "global"
    });

    await flushMicrotasks();

    try {
      expect(eligibleSubjectsStarted).toBe(true);
      expect(manualContrastStarted).toBe(true);
    } finally {
      eligibleSubjectsDeferred.resolve([]);
      manualContrastSeedDeferred.resolve({
        candidates: [],
        pairStates: new Map<string, null>(),
        suppressedContrastKeys: new Set()
      });
      await queuePromise;
    }
  });

  it("starts introduced-today counting before automatic pair-state loading settles", async () => {
    const pairStatesDeferred = createDeferred<Map<string, null>>();
    const introducedTodayDeferred = createDeferred<number>();
    let pairStatesStarted = false;
    let introducedTodayStarted = false;

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      countKanjiClashAutomaticNewPairIntroductions: vi.fn(() => {
        introducedTodayStarted = true;
        return introducedTodayDeferred.promise;
      }),
      listEligibleKanjiClashSubjects: vi.fn(() =>
        Promise.resolve([{ subjectKey: "subject-a" }])
      ),
      listKanjiClashPairStatesByPairKeys: vi.fn(() => {
        pairStatesStarted = true;
        return pairStatesDeferred.promise;
      })
    }));
    vi.doMock("@/features/kanji-clash/server/manual-contrast.ts", () => ({
      loadKanjiClashManualContrastCandidates: vi.fn(() =>
        Promise.resolve({
          candidates: [],
          pairStates: new Map<string, null>(),
          suppressedContrastKeys: new Set()
        })
      )
    }));
    vi.doMock("@/features/kanji-clash/server/manual-queue-loader.ts", () => ({
      loadManualKanjiClashQueueSnapshot: vi.fn()
    }));
    vi.doMock("@/features/kanji-clash/model/pairing.ts", () => ({
      generateKanjiClashCandidates: vi.fn(() => [
        {
          pairKey: "pair-a"
        }
      ])
    }));
    vi.doMock("@/features/kanji-clash/model/queue.ts", () => ({
      buildKanjiClashQueueSnapshot: vi.fn(
        ({ newIntroducedTodayCount }: { newIntroducedTodayCount: number }) => ({
          mode: "automatic",
          requestedSize: null,
          rounds: [],
          scope: "global",
          snapshotAtIso: "2026-04-21T01:00:00.000Z",
          totalCount: newIntroducedTodayCount
        })
      )
    }));

    const { loadKanjiClashQueueSnapshot } =
      await import("@/features/kanji-clash/server/session-loader.ts");
    const queuePromise = loadKanjiClashQueueSnapshot({
      dailyNewLimit: 7,
      database: {} as never,
      mode: "automatic",
      now: new Date("2026-04-21T01:00:00.000Z"),
      scope: "global"
    });

    await flushMicrotasks();

    try {
      expect(pairStatesStarted).toBe(true);
      expect(introducedTodayStarted).toBe(true);
    } finally {
      pairStatesDeferred.resolve(new Map<string, null>());
      introducedTodayDeferred.resolve(3);
    }

    await expect(queuePromise).resolves.toMatchObject({
      mode: "automatic",
      totalCount: 3
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

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
    const schedule = createQuerySchedulingHarness();
    const eligibleSubjectsGate =
      schedule.gate<Array<{ subjectKey: string }>>("eligible subjects");
    const manualContrastSeedGate = schedule.gate<{
      candidates: [];
      pairStates: Map<string, null>;
      suppressedContrastKeys: Set<string>;
    }>("manual contrast seed");

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      countKanjiClashAutomaticNewPairIntroductions: vi.fn(),
      listEligibleKanjiClashSubjects: vi.fn(eligibleSubjectsGate.loader()),
      listKanjiClashPairStatesByPairKeys: vi.fn()
    }));
    vi.doMock("@/features/kanji-clash/server/manual-contrast.ts", () => ({
      loadKanjiClashManualContrastCandidates: vi.fn(
        manualContrastSeedGate.loader()
      )
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

    try {
      await schedule.expectStarted("eligible subjects", "manual contrast seed");
      schedule.expectNotSettled("eligible subjects");
    } finally {
      eligibleSubjectsGate.resolve([]);
      manualContrastSeedGate.resolve({
        candidates: [],
        pairStates: new Map<string, null>(),
        suppressedContrastKeys: new Set()
      });
      await queuePromise;
    }
  });

  it("starts introduced-today counting before automatic pair-state loading settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const pairStatesGate = schedule.gate<Map<string, null>>("pair states");
    const introducedTodayGate = schedule.gate<number>("introduced today");

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      countKanjiClashAutomaticNewPairIntroductions: vi.fn(
        introducedTodayGate.loader()
      ),
      listEligibleKanjiClashSubjects: vi.fn(() =>
        Promise.resolve([{ subjectKey: "subject-a" }])
      ),
      listKanjiClashPairStatesByPairKeys: vi.fn(pairStatesGate.loader())
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

    try {
      await schedule.expectStarted("pair states", "introduced today");
      schedule.expectNotSettled("pair states");
    } finally {
      pairStatesGate.resolve(new Map<string, null>());
      introducedTodayGate.resolve(3);
    }

    await expect(queuePromise).resolves.toMatchObject({
      mode: "automatic",
      totalCount: 3
    });
  });
});

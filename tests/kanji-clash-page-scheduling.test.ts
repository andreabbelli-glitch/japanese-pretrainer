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

describe("kanji clash page query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/features/kanji-clash/server/manual-contrast.ts");
    vi.doUnmock("@/features/kanji-clash/server/queue-token.ts");
    vi.doUnmock("@/features/kanji-clash/model/queue.ts");
    vi.doUnmock("@/features/kanji-clash/server/session.ts");
  });

  it("starts queue loading before manual contrast summaries settle", async () => {
    const settingsValue = {
      kanjiClashDailyNewLimit: 7,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20
    };
    const mediaRowsValue = [
      {
        id: "media-1",
        slug: "alpha",
        title: "Alpha"
      }
    ];
    const queueValue = {
      requestedSize: null,
      rounds: [],
      scope: "media" as const,
      snapshotAtIso: "2026-04-21T01:00:00.000Z",
      totalCount: 0
    };
    const settingsDeferred = createDeferred<typeof settingsValue>();
    const mediaRowsDeferred = createDeferred<typeof mediaRowsValue>();
    const manualContrastSnapshotDeferred = createDeferred<{
      manualContrastSeed: {
        candidates: [];
        pairStates: Map<string, null>;
        suppressedContrastKeys: Set<string>;
      };
      manualContrasts: Array<{
        contrastKey: string;
        status: "active";
      }>;
    }>();
    const queueDeferred = createDeferred<typeof queueValue>();
    const loadKanjiClashQueueSnapshot = vi.fn(() => queueDeferred.promise);

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      listMediaCached: vi.fn(() => mediaRowsDeferred.promise)
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(() => settingsDeferred.promise),
      kanjiClashManualDefaultSizeOptions: [10, 20, 40],
      resolveKanjiClashDefaultScope: vi.fn(
        (defaultScope: "global" | "media") => defaultScope
      )
    }));
    vi.doMock("@/features/kanji-clash/server/manual-contrast.ts", () => ({
      loadKanjiClashManualContrastPageSnapshot: vi.fn(
        () => manualContrastSnapshotDeferred.promise
      )
    }));
    vi.doMock("@/features/kanji-clash/model/queue.ts", () => ({
      getKanjiClashCurrentRound: vi.fn(() => null)
    }));
    vi.doMock("@/features/kanji-clash/server/queue-token.ts", () => ({
      createKanjiClashQueueToken: vi.fn(() => "queue-token")
    }));
    vi.doMock("@/features/kanji-clash/server/session.ts", () => ({
      loadKanjiClashQueueSnapshot
    }));

    const { getKanjiClashPageData } =
      await import("@/features/kanji-clash/server/page-data");
    const dataPromise = getKanjiClashPageData({
      media: "alpha"
    });

    await flushMicrotasks();
    settingsDeferred.resolve(settingsValue);
    mediaRowsDeferred.resolve(mediaRowsValue);
    await flushMicrotasks();

    expect(loadKanjiClashQueueSnapshot).toHaveBeenCalledTimes(1);
    expect(loadKanjiClashQueueSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyNewLimit: 7,
        database: {},
        mediaIds: ["media-1"],
        mode: "automatic",
        now: expect.any(Date),
        requestedSize: null,
        resolvedManualContrastSeed: expect.any(Promise),
        scope: "media"
      })
    );

    manualContrastSnapshotDeferred.resolve({
      manualContrastSeed: {
        candidates: [],
        pairStates: new Map<string, null>(),
        suppressedContrastKeys: new Set<string>()
      },
      manualContrasts: []
    });
    queueDeferred.resolve(queueValue);

    const data = await dataPromise;

    expect(data.queue).toEqual(queueValue);
    expect(data.selectedMedia?.slug).toBe("alpha");
  });
});

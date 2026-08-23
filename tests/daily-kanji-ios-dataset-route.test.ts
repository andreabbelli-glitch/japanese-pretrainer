import { beforeEach, describe, expect, it, vi } from "vitest";

import { closeDatabaseClient, type DatabaseClient } from "@/db";
import { developmentFixture } from "@/db/seed";
import { refreshDailyKanjiRuntimeSnapshot } from "@/features/daily-kanji/server";
import { withTestDatabase } from "./helpers/test-db";

const { dbMock, loadDailyKanjiRuntimeSnapshotMock } = vi.hoisted(() => ({
  dbMock: {},
  loadDailyKanjiRuntimeSnapshotMock: vi.fn()
}));

describe("daily kanji iOS dataset route", () => {
  beforeEach(() => {
    process.env.DAILY_KANJI_IOS_SYNC_TOKEN = "daily-kanji-secret";
    loadDailyKanjiRuntimeSnapshotMock.mockReset();
  });

  it("reports a server configuration error when the sync token is missing", async () => {
    delete process.env.DAILY_KANJI_IOS_SYNC_TOKEN;
    const { GET } = await importRouteWithMockedExporter();

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-dataset", {
        headers: {
          authorization: "Bearer daily-kanji-secret"
        }
      })
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0"
    );
    await expect(response.json()).resolves.toEqual({
      error: "DAILY_KANJI_IOS_SYNC_TOKEN is not configured on the app runtime."
    });
    expect(loadDailyKanjiRuntimeSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong bearer token", async () => {
    const { GET } = await importRouteWithMockedExporter();

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-dataset", {
        headers: {
          authorization: "Bearer wrong-secret"
        }
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0"
    );
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized."
    });
    expect(loadDailyKanjiRuntimeSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects requests without an authorization header", async () => {
    const { GET } = await importRouteWithMockedExporter();

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-dataset")
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0"
    );
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized."
    });
    expect(loadDailyKanjiRuntimeSnapshotMock).not.toHaveBeenCalled();
  });

  it("serves a cacheable persisted snapshot without rebuilding it", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;

    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-ios-route-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await refreshDailyKanjiRuntimeSnapshot({
          database,
          now: new Date("2026-08-23T04:15:00.000Z")
        });
        closeAndForgetDatabaseSingleton();
        vi.resetModules();
        vi.doUnmock("@/db");
        vi.doUnmock("@/features/daily-kanji/server");
        process.env.DATABASE_URL = databasePath;

        try {
          const { GET } =
            await import("@/app/api/daily-kanji/ios-dataset/route");

          const response = await GET(
            new Request("https://example.test/api/daily-kanji/ios-dataset", {
              headers: {
                authorization: "Bearer daily-kanji-secret"
              }
            })
          );
          const body = await response.json();

          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toBe(
            "private, max-age=21600, stale-if-error=604800"
          );
          expect(response.headers.get("etag")).toMatch(/^"dk-/u);
          expect(response.headers.get("x-daily-kanji-snapshot")).toBe(
            "persisted"
          );
          expect(body.version).toBe(1);
          expect(Array.isArray(body.cards)).toBe(true);
          expect(
            body.cards.map((card: { cardId: string }) => card.cardId)
          ).toContain(developmentFixture.primaryCardId);
        } finally {
          closeAndForgetDatabaseSingleton();
          restoreDatabaseUrl(previousDatabaseUrl);
          vi.resetModules();
        }
      }
    );
  });

  it("returns 304 without a response body when the client ETag is current", async () => {
    loadDailyKanjiRuntimeSnapshotMock.mockResolvedValue(buildSnapshotFixture());
    const { GET } = await importRouteWithMockedSnapshot();

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-dataset", {
        headers: {
          authorization: "Bearer daily-kanji-secret",
          "if-none-match": 'W/"dk-fixture"'
        }
      })
    );

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"dk-fixture"');
    await expect(response.text()).resolves.toBe("");
  });

  it("returns a retryable error when the snapshot has not been generated", async () => {
    loadDailyKanjiRuntimeSnapshotMock.mockResolvedValue(null);
    const { GET } = await importRouteWithMockedSnapshot();

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-dataset", {
        headers: {
          authorization: "Bearer daily-kanji-secret"
        }
      })
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0"
    );
    await expect(response.json()).resolves.toEqual({
      error: "Daily Kanji dataset snapshot is not ready.",
      ok: false
    });
  });

  it("returns a structured error if the snapshot read fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    loadDailyKanjiRuntimeSnapshotMock.mockRejectedValue(
      new Error("database offline")
    );
    const { GET } = await importRouteWithMockedSnapshot();

    try {
      const response = await GET(
        new Request("https://example.test/api/daily-kanji/ios-dataset", {
          headers: {
            authorization: "Bearer daily-kanji-secret"
          }
        })
      );

      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0"
      );
      await expect(response.json()).resolves.toEqual({
        error: "Daily Kanji dataset snapshot is unavailable.",
        ok: false
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Daily Kanji iOS snapshot load failed.",
        expect.any(Error)
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

async function importRouteWithMockedExporter() {
  return importRouteWithMockedSnapshot();
}

async function importRouteWithMockedSnapshot() {
  closeAndForgetDatabaseSingleton();
  vi.resetModules();
  vi.doMock("@/db", () => ({
    db: dbMock
  }));
  vi.doMock("@/features/daily-kanji/server", () => ({
    loadDailyKanjiRuntimeSnapshot: loadDailyKanjiRuntimeSnapshotMock
  }));

  return import("@/app/api/daily-kanji/ios-dataset/route");
}

function buildSnapshotFixture() {
  const payloadJson = JSON.stringify({
    cards: [{ cardId: "card-fixture" }],
    generatedAt: "2026-08-23T04:15:00.000Z",
    recentMistakeLookbackDays: 3,
    version: 1
  });

  return {
    buildDurationMs: 10,
    generatedAt: "2026-08-23T04:15:00.000Z",
    payloadBytes: payloadJson.length,
    payloadEtag: '"dk-fixture"',
    payloadJson,
    refreshNotBefore: "2026-08-24T00:15:00.000Z",
    schemaVersion: 1
  };
}

function closeAndForgetDatabaseSingleton() {
  const globalForDatabase = globalThis as {
    __japaneseCustomStudyDb__?: DatabaseClient;
  };

  if (globalForDatabase.__japaneseCustomStudyDb__) {
    closeDatabaseClient(globalForDatabase.__japaneseCustomStudyDb__);
    delete globalForDatabase.__japaneseCustomStudyDb__;
  }
}

function restoreDatabaseUrl(previousDatabaseUrl: string | undefined) {
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = previousDatabaseUrl;
}

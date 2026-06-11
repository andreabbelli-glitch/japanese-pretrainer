import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  type DatabaseClient
} from "@/db";
import { developmentFixture } from "@/db/seed";
import { withTestDatabase } from "./helpers/test-db";

const { buildDailyKanjiDatasetMock, dbMock } = vi.hoisted(() => ({
  buildDailyKanjiDatasetMock: vi.fn(),
  dbMock: {}
}));

describe("daily kanji iOS dataset route", () => {
  beforeEach(() => {
    process.env.DAILY_KANJI_IOS_SYNC_TOKEN = "daily-kanji-secret";
    buildDailyKanjiDatasetMock.mockReset();
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
    expect(buildDailyKanjiDatasetMock).not.toHaveBeenCalled();
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
    expect(buildDailyKanjiDatasetMock).not.toHaveBeenCalled();
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
    expect(buildDailyKanjiDatasetMock).not.toHaveBeenCalled();
  });

  it("returns a no-store Daily Kanji dataset for authorized requests", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;

    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-ios-route-",
        seedDevelopmentFixture: true
      },
      async ({ databasePath }) => {
        closeAndForgetDatabaseSingleton();
        vi.resetModules();
        vi.doUnmock("@/db");
        vi.doUnmock("@/features/daily-kanji/server");
        process.env.DATABASE_URL = databasePath;

        try {
          const { GET } = await import(
            "@/app/api/daily-kanji/ios-dataset/route"
          );

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
            "private, no-store, max-age=0"
          );
          expect(body.version).toBe(1);
          expect(Array.isArray(body.cards)).toBe(true);
          expect(body.cards.map((card: { cardId: string }) => card.cardId)).toContain(
            developmentFixture.primaryCardId
          );
        } finally {
          closeAndForgetDatabaseSingleton();
          restoreDatabaseUrl(previousDatabaseUrl);
          vi.resetModules();
        }
      }
    );
  });

  it("returns a structured error if dataset generation fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    buildDailyKanjiDatasetMock.mockRejectedValue(new Error("database offline"));
    const { GET } = await importRouteWithMockedExporter();

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
        error: "Daily Kanji dataset generation failed.",
        ok: false
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Daily Kanji iOS dataset generation failed.",
        expect.any(Error)
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

async function importRouteWithMockedExporter() {
  closeAndForgetDatabaseSingleton();
  vi.resetModules();
  vi.doMock("@/db", () => ({
    db: dbMock
  }));
  vi.doMock("@/features/daily-kanji/server", () => ({
    buildDailyKanjiDataset: buildDailyKanjiDatasetMock
  }));

  return import("@/app/api/daily-kanji/ios-dataset/route");
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

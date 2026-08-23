import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, refreshDailyKanjiRuntimeSnapshotsMock } = vi.hoisted(() => ({
  dbMock: {},
  refreshDailyKanjiRuntimeSnapshotsMock: vi.fn()
}));

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/features/daily-kanji/server", () => ({
  refreshDailyKanjiRuntimeSnapshots: refreshDailyKanjiRuntimeSnapshotsMock
}));

import { GET } from "@/app/api/internal/daily-kanji/refresh/route";

describe("Daily Kanji snapshot cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    refreshDailyKanjiRuntimeSnapshotsMock.mockReset();
  });

  it("rejects unauthenticated refresh attempts before touching the database", async () => {
    const response = await GET(
      new Request("https://example.test/api/internal/daily-kanji/refresh")
    );

    expect(response.status).toBe(401);
    expect(refreshDailyKanjiRuntimeSnapshotsMock).not.toHaveBeenCalled();
  });

  it("returns the bounded refresh metadata without exposing the payload", async () => {
    refreshDailyKanjiRuntimeSnapshotsMock.mockResolvedValue({
      cards: {
        snapshot: {
          buildDurationMs: 125,
          generatedAt: "2026-08-23T04:15:00.000Z",
          payloadBytes: 420_000,
          payloadEtag: '"dk-private"',
          payloadJson: "private-cards",
          refreshNotBefore: "2026-08-24T02:15:00.000Z",
          schemaVersion: 1
        },
        status: "refreshed"
      },
      glossary: {
        snapshot: {
          buildDurationMs: 225,
          generatedAt: "2026-08-23T04:15:00.000Z",
          payloadBytes: 3_400_000,
          payloadEtag: '"dkg-private"',
          payloadJson: "private-glossary",
          refreshNotBefore: "2026-08-29T04:15:00.000Z",
          schemaVersion: 1
        },
        status: "refreshed"
      }
    });

    const response = await GET(
      new Request("https://example.test/api/internal/daily-kanji/refresh", {
        headers: { authorization: "Bearer cron-secret" }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      snapshots: {
        cards: {
          buildDurationMs: 125,
          generatedAt: "2026-08-23T04:15:00.000Z",
          payloadBytes: 420_000,
          refreshNotBefore: "2026-08-24T02:15:00.000Z",
          status: "refreshed"
        },
        glossary: {
          buildDurationMs: 225,
          generatedAt: "2026-08-23T04:15:00.000Z",
          payloadBytes: 3_400_000,
          refreshNotBefore: "2026-08-29T04:15:00.000Z",
          status: "refreshed"
        }
      }
    });
    expect(refreshDailyKanjiRuntimeSnapshotsMock).toHaveBeenCalledWith({
      database: dbMock
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, loadGlossarySnapshotMock } = vi.hoisted(() => ({
  dbMock: {},
  loadGlossarySnapshotMock: vi.fn()
}));

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/features/daily-kanji/server", () => ({
  loadDailyKanjiGlossaryRuntimeSnapshot: loadGlossarySnapshotMock
}));

import { GET } from "@/app/api/daily-kanji/ios-glossary/route";

describe("daily kanji iOS glossary route", () => {
  beforeEach(() => {
    process.env.DAILY_KANJI_IOS_SYNC_TOKEN = "daily-kanji-secret";
    loadGlossarySnapshotMock.mockReset();
  });

  it("rejects unauthorized reads before touching Turso", async () => {
    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-glossary")
    );

    expect(response.status).toBe(401);
    expect(loadGlossarySnapshotMock).not.toHaveBeenCalled();
  });

  it("serves the independently cached glossary snapshot", async () => {
    const payloadJson = JSON.stringify({
      entries: [{ id: "term:fixture" }],
      entryCount: 1,
      generatedAt: "2026-08-23T04:15:00.000Z",
      version: 1
    });
    loadGlossarySnapshotMock.mockResolvedValue({
      buildDurationMs: 10,
      generatedAt: "2026-08-23T04:15:00.000Z",
      payloadBytes: Buffer.byteLength(payloadJson),
      payloadEtag: '"dkg-fixture"',
      payloadJson,
      refreshNotBefore: "2026-08-29T04:15:00.000Z",
      schemaVersion: 1
    });

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-glossary", {
        headers: { authorization: "Bearer daily-kanji-secret" }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, max-age=604800, stale-if-error=2592000"
    );
    expect(response.headers.get("etag")).toBe('"dkg-fixture"');
    expect(response.headers.get("x-daily-kanji-snapshot")).toBe(
      "persisted-glossary"
    );
    await expect(response.json()).resolves.toMatchObject({
      entryCount: 1,
      version: 1
    });
  });

  it("does not build the glossary on the public request path", async () => {
    loadGlossarySnapshotMock.mockResolvedValue(null);

    const response = await GET(
      new Request("https://example.test/api/daily-kanji/ios-glossary", {
        headers: { authorization: "Bearer daily-kanji-secret" }
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Daily Kanji glossary snapshot is not ready.",
      ok: false
    });
  });
});

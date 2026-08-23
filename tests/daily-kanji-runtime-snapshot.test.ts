import { describe, expect, it, vi } from "vitest";

import { runtimeJobLease, runtimeSnapshot } from "@/db/schema";
import {
  dailyKanjiCardSnapshotMaximumBytes,
  dailyKanjiGlossarySnapshotMaximumBytes,
  dailyKanjiRuntimeSnapshotKey,
  dailyKanjiGlossaryRuntimeSnapshotKey,
  dailyKanjiGlossarySnapshotMinimumRefreshMs,
  dailyKanjiSnapshotMinimumRefreshMs,
  loadDailyKanjiGlossaryRuntimeSnapshot,
  loadDailyKanjiRuntimeSnapshot,
  refreshDailyKanjiGlossaryRuntimeSnapshot,
  refreshDailyKanjiRuntimeSnapshot
} from "@/features/daily-kanji/server";
import { withTestDatabase } from "./helpers/test-db";

describe("Daily Kanji runtime snapshot", () => {
  it("persists one complete payload and skips heavy rebuilds inside the hard interval", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-runtime-snapshot-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const allSpy = vi.spyOn(database, "all");
        const now = new Date("2026-08-23T04:15:00.000Z");
        const first = await refreshDailyKanjiRuntimeSnapshot({
          database,
          now
        });
        const heavyQueryCount = allSpy.mock.calls.length;

        expect(first.status).toBe("refreshed");
        expect(heavyQueryCount).toBeGreaterThan(0);
        expect(first.snapshot.payloadEtag).toMatch(/^"dk-/u);
        expect(first.snapshot.payloadBytes).toBe(
          Buffer.byteLength(first.snapshot.payloadJson)
        );
        expect(first.snapshot.payloadBytes).toBeLessThanOrEqual(
          dailyKanjiCardSnapshotMaximumBytes
        );
        expect(JSON.parse(first.snapshot.payloadJson)).toMatchObject({
          generatedAt: now.toISOString(),
          version: 1
        });
        expect(JSON.parse(first.snapshot.payloadJson)).not.toHaveProperty(
          "glossary"
        );

        const second = await refreshDailyKanjiRuntimeSnapshot({
          database,
          now: new Date(now.getTime() + dailyKanjiSnapshotMinimumRefreshMs - 1)
        });

        expect(second).toMatchObject({
          reason: "minimum-refresh-interval",
          status: "skipped"
        });
        expect(allSpy).toHaveBeenCalledTimes(heavyQueryCount);
        expect(second.snapshot.payloadEtag).toBe(first.snapshot.payloadEtag);
        expect(await loadDailyKanjiRuntimeSnapshot(database)).toEqual(
          first.snapshot
        );

        const rows = await database.query.runtimeSnapshot.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          key: dailyKanjiRuntimeSnapshotKey,
          schemaVersion: 1
        });
      }
    );
  });

  it("persists the stable glossary independently and refreshes it at most weekly", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-glossary-runtime-snapshot-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const now = new Date("2026-08-23T04:15:00.000Z");
        const first = await refreshDailyKanjiGlossaryRuntimeSnapshot({
          database,
          now
        });
        const second = await refreshDailyKanjiGlossaryRuntimeSnapshot({
          database,
          now: new Date(
            now.getTime() + dailyKanjiGlossarySnapshotMinimumRefreshMs - 1
          )
        });
        const payload = JSON.parse(first.snapshot.payloadJson);

        expect(first.status).toBe("refreshed");
        expect(second.status).toBe("skipped");
        expect(first.snapshot.payloadEtag).toMatch(/^"dkg-/u);
        expect(first.snapshot.payloadBytes).toBeLessThanOrEqual(
          dailyKanjiGlossarySnapshotMaximumBytes
        );
        expect(payload).toMatchObject({
          entryCount: expect.any(Number),
          entries: expect.any(Array),
          generatedAt: now.toISOString(),
          version: 1
        });
        expect(await loadDailyKanjiGlossaryRuntimeSnapshot(database)).toEqual(
          first.snapshot
        );

        const rows = await database.query.runtimeSnapshot.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.key).toBe(dailyKanjiGlossaryRuntimeSnapshotKey);
      }
    );
  });

  it("uses an atomic lease to suppress duplicate concurrent builds", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-runtime-lease-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        const initialNow = new Date("2026-08-20T04:15:00.000Z");
        const initial = await refreshDailyKanjiRuntimeSnapshot({
          database,
          now: initialNow
        });
        const dueNow = new Date(
          initialNow.getTime() + dailyKanjiSnapshotMinimumRefreshMs + 1
        );
        await database.insert(runtimeJobLease).values({
          expiresAt: new Date(dueNow.getTime() + 60_000).toISOString(),
          key: dailyKanjiRuntimeSnapshotKey,
          ownerToken: "other-function",
          updatedAt: dueNow.toISOString()
        });
        const allSpy = vi.spyOn(database, "all");

        const duplicate = await refreshDailyKanjiRuntimeSnapshot({
          database,
          now: dueNow
        });

        expect(duplicate).toMatchObject({
          reason: "refresh-in-progress",
          status: "skipped"
        });
        expect(duplicate.snapshot.payloadEtag).toBe(
          initial.snapshot.payloadEtag
        );
        expect(allSpy).not.toHaveBeenCalled();
      }
    );
  });

  it("ignores an incompatible persisted schema and replaces it on bootstrap", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-runtime-version-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await database.insert(runtimeSnapshot).values({
          buildDurationMs: 1,
          generatedAt: "2026-08-22T04:15:00.000Z",
          key: dailyKanjiRuntimeSnapshotKey,
          payloadBytes: 2,
          payloadEtag: '"obsolete"',
          payloadJson: "{}",
          refreshNotBefore: "2099-01-01T00:00:00.000Z",
          schemaVersion: 999,
          updatedAt: "2026-08-22T04:15:00.000Z"
        });

        expect(await loadDailyKanjiRuntimeSnapshot(database)).toBeNull();

        const refreshed = await refreshDailyKanjiRuntimeSnapshot({
          database,
          now: new Date("2026-08-23T04:15:00.000Z")
        });

        expect(refreshed.status).toBe("refreshed");
        expect(refreshed.snapshot.schemaVersion).toBe(1);
      }
    );
  });
});

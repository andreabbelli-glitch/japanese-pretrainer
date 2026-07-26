import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDatabaseClient, type DatabaseClient } from "@/db";
import { reviewSubjectState, userSetting } from "@/db/schema";
import { primarySubjectKey } from "./helpers/review-shared";
import { withTestDatabase } from "./helpers/test-db";
const { sendApnsMock } = vi.hoisted(() => ({
  sendApnsMock: vi.fn()
}));

vi.mock("@/features/mobile-review/server/apns", () => ({
  sendMobileReviewDueNotification: sendApnsMock
}));

describe("mobile review notification monitor", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.MOBILE_NOTIFICATION_MONITOR_SECRET = "monitor-secret";
    sendApnsMock.mockReset();
    sendApnsMock.mockResolvedValue({
      sent: true
    });
  });

  afterEach(() => {
    restoreDatabaseUrl(previousDatabaseUrl);
    delete process.env.MOBILE_NOTIFICATION_MONITOR_SECRET;
    closeAndForgetDatabaseSingleton();
    vi.resetModules();
  });

  it("rejects monitor calls without the monitor bearer token", async () => {
    const { POST } = await importMonitorRouteWithMockedDatabase();

    const response = await POST(
      new Request(
        "https://example.test/api/internal/mobile-review-notifications/run",
        {
          method: "POST"
        }
      )
    );

    expect(response.status).toBe(401);
    expect(sendApnsMock).not.toHaveBeenCalled();
  });

  it("sends APNs once when due count transitions from zero to positive", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-monitor-transition-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await registerDeviceToken(database);
        await makePrimaryCardDue(database);
        const { POST } = await importMonitorRouteForDatabase(databasePath);
        const request = () =>
          new Request(
            "https://example.test/api/internal/mobile-review-notifications/run",
            {
              headers: {
                authorization: "Bearer monitor-secret"
              },
              method: "POST"
            }
          );

        const first = await POST(request());
        const firstBody = await first.json();
        const second = await POST(request());
        const secondBody = await second.json();

        expect(first.status).toBe(200);
        expect(firstBody).toMatchObject({
          dueCount: expect.any(Number),
          notification: "sent",
          ok: true,
          previousDueCount: 0
        });
        expect(firstBody.dueCount).toBeGreaterThan(0);
        expect(second.status).toBe(200);
        expect(secondBody).toMatchObject({
          notification: "already_due",
          ok: true
        });
        expect(sendApnsMock).toHaveBeenCalledTimes(1);
      }
    );
  });

  it("does not arm the due transition when a device token is missing", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-monitor-missing-token-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await makePrimaryCardDue(database);
        const { POST } = await importMonitorRouteForDatabase(databasePath);
        const request = () =>
          new Request(
            "https://example.test/api/internal/mobile-review-notifications/run",
            {
              headers: {
                authorization: "Bearer monitor-secret"
              },
              method: "POST"
            }
          );

        const missingToken = await POST(request());
        const missingTokenBody = await missingToken.json();

        await registerDeviceToken(database);
        const sentAfterToken = await POST(request());
        const sentAfterTokenBody = await sentAfterToken.json();

        expect(missingToken.status).toBe(200);
        expect(missingTokenBody).toMatchObject({
          notification: "missing_device_token",
          previousDueCount: 0
        });
        expect(sentAfterToken.status).toBe(200);
        expect(sentAfterTokenBody).toMatchObject({
          notification: "sent",
          previousDueCount: 0
        });
        expect(sendApnsMock).toHaveBeenCalledTimes(1);
      }
    );
  });

  it("does not arm the due transition after a failed APNs send", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-monitor-send-failure-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await registerDeviceToken(database);
        await makePrimaryCardDue(database);
        sendApnsMock
          .mockResolvedValueOnce({
            reason: "server_error",
            sent: false
          })
          .mockResolvedValueOnce({
            sent: true
          });
        const { POST } = await importMonitorRouteForDatabase(databasePath);
        const request = () =>
          new Request(
            "https://example.test/api/internal/mobile-review-notifications/run",
            {
              headers: {
                authorization: "Bearer monitor-secret"
              },
              method: "POST"
            }
          );

        const failed = await POST(request());
        const failedBody = await failed.json();
        const retried = await POST(request());
        const retriedBody = await retried.json();

        expect(failed.status).toBe(200);
        expect(failedBody).toMatchObject({
          notification: "send_failed",
          previousDueCount: 0
        });
        expect(retried.status).toBe(200);
        expect(retriedBody).toMatchObject({
          notification: "sent",
          previousDueCount: 0
        });
        expect(sendApnsMock).toHaveBeenCalledTimes(2);
      }
    );
  });

  it("arms the next notification after due count returns to zero", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-mobile-monitor-rearm-",
        seedDevelopmentFixture: true
      },
      async ({ database, databasePath }) => {
        await registerDeviceToken(database);
        const { POST } = await importMonitorRouteForDatabase(databasePath);
        const request = () =>
          new Request(
            "https://example.test/api/internal/mobile-review-notifications/run",
            {
              headers: {
                authorization: "Bearer monitor-secret"
              },
              method: "POST"
            }
          );

        await makePrimaryCardDue(database);
        await POST(request());
        await makePrimaryCardUpcoming(database);
        await POST(request());
        await makePrimaryCardDue(database);
        const response = await POST(request());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.notification).toBe("sent");
        expect(sendApnsMock).toHaveBeenCalledTimes(2);
      }
    );
  });
});

async function registerDeviceToken(database: DatabaseClient) {
  await database.insert(userSetting).values({
    key: "mobile_review_apns_device_token" as (typeof userSetting.$inferInsert)["key"],
    updatedAt: "2026-04-02T12:00:00.000Z",
    valueJson: JSON.stringify({
      deviceToken: "a".repeat(64),
      updatedAt: "2026-04-02T12:00:00.000Z"
    })
  });
}

async function makePrimaryCardDue(database: DatabaseClient) {
  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2000-01-01T00:00:00.000Z",
      manualOverride: false,
      state: "learning",
      suspended: false
    })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
}

async function makePrimaryCardUpcoming(database: DatabaseClient) {
  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2999-01-01T00:00:00.000Z",
      manualOverride: false,
      state: "review",
      suspended: false
    })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
}

async function importMonitorRouteWithMockedDatabase() {
  closeAndForgetDatabaseSingleton();
  vi.resetModules();
  vi.doMock("@/db", () => ({
    db: {}
  }));

  return import("@/app/api/internal/mobile-review-notifications/run/route");
}

async function importMonitorRouteForDatabase(databasePath: string) {
  closeAndForgetDatabaseSingleton();
  vi.resetModules();
  vi.doUnmock("@/db");
  process.env.DATABASE_URL = databasePath;

  return import("@/app/api/internal/mobile-review-notifications/run/route");
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

import { db, type DatabaseClient } from "@/db";
import { sendMobileReviewDueNotification } from "./apns";
import { loadMobileReviewDueSummary } from "./due-summary";
import {
  loadMobileReviewDeviceToken,
  loadMobileReviewNotificationState,
  saveMobileReviewNotificationState
} from "./settings";

export type MobileReviewNotificationMonitorResult = {
  dueCount: number;
  nextDueAt: string | null;
  notification:
    | "already_due"
    | "idle"
    | "missing_device_token"
    | "sent"
    | "send_failed";
  ok: true;
  previousDueCount: number;
};

export async function runMobileReviewNotificationMonitor(input: {
  database?: DatabaseClient;
  now?: Date;
} = {}): Promise<MobileReviewNotificationMonitorResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const [dueSummary, previousState] = await Promise.all([
    loadMobileReviewDueSummary({ asOf: now, database }),
    loadMobileReviewNotificationState(database)
  ]);

  if (dueSummary.dueCount <= 0) {
    if (previousState.lastDueCount > 0) {
      await saveMobileReviewNotificationState({
        database,
        state: {
          lastCheckedAt: nowIso,
          lastDueCount: 0,
          lastNotifiedAt: previousState.lastNotifiedAt
        }
      });
    }

    return {
      dueCount: 0,
      nextDueAt: dueSummary.nextDueAt,
      notification: "idle",
      ok: true,
      previousDueCount: previousState.lastDueCount
    };
  }

  if (previousState.lastDueCount > 0) {
    return {
      dueCount: dueSummary.dueCount,
      nextDueAt: dueSummary.nextDueAt,
      notification: "already_due",
      ok: true,
      previousDueCount: previousState.lastDueCount
    };
  }

  const deviceToken = await loadMobileReviewDeviceToken(database);

  if (!deviceToken) {
    return {
      dueCount: dueSummary.dueCount,
      nextDueAt: dueSummary.nextDueAt,
      notification: "missing_device_token",
      ok: true,
      previousDueCount: previousState.lastDueCount
    };
  }

  const sendResult = await sendMobileReviewDueNotification({
    deviceToken,
    dueCount: dueSummary.dueCount
  });
  const notification = sendResult.sent ? "sent" : "send_failed";

  if (sendResult.sent) {
    await saveMobileReviewNotificationState({
      database,
      state: {
        lastCheckedAt: nowIso,
        lastDueCount: dueSummary.dueCount,
        lastNotifiedAt: nowIso
      }
    });
  }

  return {
    dueCount: dueSummary.dueCount,
    nextDueAt: dueSummary.nextDueAt,
    notification,
    ok: true,
    previousDueCount: previousState.lastDueCount
  };
}

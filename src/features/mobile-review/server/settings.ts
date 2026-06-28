import { db, type DatabaseClient } from "@/db";
import {
  getUserSettingByKey,
  parseOptionalUserSettingValue,
  upsertUserSettingValue
} from "@/db/queries";

type MobileReviewApnsDeviceToken = {
  deviceToken: string;
  updatedAt: string;
};

export type MobileReviewNotificationState = {
  lastCheckedAt: string;
  lastDueCount: number;
  lastNotifiedAt: string | null;
};

const DEVICE_TOKEN_KEY = "mobile_review_apns_device_token";
const NOTIFICATION_STATE_KEY = "mobile_review_notification_state";

export async function saveMobileReviewDeviceToken(input: {
  database?: DatabaseClient;
  deviceToken: string;
  now?: Date;
}) {
  const normalized = normalizeDeviceToken(input.deviceToken);

  if (!normalized) {
    throw new Error("Invalid APNs device token.");
  }

  const nowIso = (input.now ?? new Date()).toISOString();

  await upsertUserSettingValue({
    database: input.database ?? db,
    key: DEVICE_TOKEN_KEY,
    nowIso,
    valueJson: JSON.stringify({
      deviceToken: normalized,
      updatedAt: nowIso
    } satisfies MobileReviewApnsDeviceToken)
  });
}

export async function loadMobileReviewDeviceToken(
  database: DatabaseClient = db
) {
  const row = await getUserSettingByKey(database, DEVICE_TOKEN_KEY);
  const value = parseOptionalUserSettingValue<
    Partial<MobileReviewApnsDeviceToken>,
    MobileReviewApnsDeviceToken
  >(row?.valueJson, (candidate) => {
    const deviceToken = normalizeDeviceToken(candidate.deviceToken);
    const updatedAt =
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : "";

    return deviceToken && updatedAt ? { deviceToken, updatedAt } : null;
  });

  return value?.deviceToken ?? null;
}

export async function loadMobileReviewNotificationState(
  database: DatabaseClient = db
): Promise<MobileReviewNotificationState> {
  const row = await getUserSettingByKey(database, NOTIFICATION_STATE_KEY);

  return (
    parseOptionalUserSettingValue<
      Partial<MobileReviewNotificationState>,
      MobileReviewNotificationState
    >(row?.valueJson, (candidate) => {
      const lastCheckedAt =
        typeof candidate.lastCheckedAt === "string"
          ? candidate.lastCheckedAt
          : "";
      const lastNotifiedAt =
        typeof candidate.lastNotifiedAt === "string"
          ? candidate.lastNotifiedAt
          : null;
      const lastDueCount =
        typeof candidate.lastDueCount === "number" &&
        Number.isFinite(candidate.lastDueCount) &&
        candidate.lastDueCount >= 0
          ? Math.floor(candidate.lastDueCount)
          : null;

      return lastCheckedAt && lastDueCount !== null
        ? { lastCheckedAt, lastDueCount, lastNotifiedAt }
        : null;
    }) ?? {
      lastCheckedAt: "",
      lastDueCount: 0,
      lastNotifiedAt: null
    }
  );
}

export async function saveMobileReviewNotificationState(input: {
  database?: DatabaseClient;
  state: MobileReviewNotificationState;
}) {
  await upsertUserSettingValue({
    database: input.database ?? db,
    key: NOTIFICATION_STATE_KEY,
    nowIso: input.state.lastCheckedAt,
    valueJson: JSON.stringify(input.state)
  });
}

function normalizeDeviceToken(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replaceAll(/\s/gu, "").toLowerCase();

  return /^[a-f0-9]{64,}$/u.test(normalized) ? normalized : null;
}

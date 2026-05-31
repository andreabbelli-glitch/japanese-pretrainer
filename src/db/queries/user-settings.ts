import { eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import { userSetting } from "../schema/index.ts";

export type UserSettingKey = (typeof userSetting.$inferSelect)["key"];
export type UserSettingStorageRow = Pick<
  typeof userSetting.$inferSelect,
  "key" | "updatedAt" | "valueJson"
>;

export type UserSettingReader = Pick<DatabaseClient, "query">;
export type UserSettingWriter = Pick<DatabaseClient, "insert">;

export async function listUserSettingsByKeys(
  database: UserSettingReader,
  keys: readonly UserSettingKey[]
): Promise<UserSettingStorageRow[]> {
  if (keys.length === 0) {
    return [];
  }

  return database.query.userSetting.findMany({
    where: inArray(userSetting.key, [...keys])
  });
}

export async function getUserSettingByKey(
  database: UserSettingReader,
  key: UserSettingKey
): Promise<UserSettingStorageRow | null> {
  return (
    (await database.query.userSetting.findFirst({
      where: eq(userSetting.key, key)
    })) ?? null
  );
}

export function mapUserSettingsByKey(
  rows: readonly Pick<UserSettingStorageRow, "key" | "valueJson">[]
) {
  return new Map<UserSettingKey, string>(
    rows.map((row) => [row.key, row.valueJson])
  );
}

export function parseUserSettingValue<TValue, TResult>(
  valueJson: string | undefined,
  normalize: (value: TValue) => TResult,
  fallback: TResult
) {
  if (!valueJson) {
    return fallback;
  }

  try {
    return normalize(JSON.parse(valueJson) as TValue);
  } catch {
    return fallback;
  }
}

export function parseOptionalUserSettingValue<TValue, TResult>(
  valueJson: string | undefined,
  normalize: (value: TValue) => TResult | null
) {
  if (!valueJson) {
    return null;
  }

  try {
    return normalize(JSON.parse(valueJson) as TValue);
  } catch {
    return null;
  }
}

export async function upsertUserSettingValue(input: {
  database: UserSettingWriter;
  key: UserSettingKey;
  nowIso: string;
  valueJson: string;
}) {
  await input.database
    .insert(userSetting)
    .values({
      key: input.key,
      valueJson: input.valueJson,
      updatedAt: input.nowIso
    })
    .onConflictDoUpdate({
      target: userSetting.key,
      set: {
        valueJson: input.valueJson,
        updatedAt: input.nowIso
      }
    });
}

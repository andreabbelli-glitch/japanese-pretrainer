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

type PendingUserSettingRead = {
  keys: Set<UserSettingKey>;
  reject: (reason?: unknown) => void;
  resolve: (rows: UserSettingStorageRow[]) => void;
};

type PendingUserSettingReadBatch = {
  flushScheduled: boolean;
  keys: Set<UserSettingKey>;
  loading: boolean;
  reads: PendingUserSettingRead[];
};

const pendingUserSettingReadBatches = new WeakMap<
  UserSettingReader,
  PendingUserSettingReadBatch
>();

export function listUserSettingsByKeys(
  database: UserSettingReader,
  keys: readonly UserSettingKey[]
): Promise<UserSettingStorageRow[]> {
  if (keys.length === 0) {
    return Promise.resolve([]);
  }

  const requestedKeys = new Set(keys);

  return new Promise((resolve, reject) => {
    const pendingBatch = pendingUserSettingReadBatches.get(database);
    const read = {
      keys: requestedKeys,
      reject,
      resolve
    } satisfies PendingUserSettingRead;

    if (pendingBatch && !pendingBatch.loading) {
      for (const key of requestedKeys) {
        pendingBatch.keys.add(key);
      }
      pendingBatch.reads.push(read);
      scheduleUserSettingReadBatchFlush(database, pendingBatch);
      return;
    }

    const nextBatch = {
      flushScheduled: false,
      keys: new Set(requestedKeys),
      loading: false,
      reads: [read]
    } satisfies PendingUserSettingReadBatch;
    pendingUserSettingReadBatches.set(database, nextBatch);
    scheduleUserSettingReadBatchFlush(database, nextBatch);
  });
}

function scheduleUserSettingReadBatchFlush(
  database: UserSettingReader,
  batch: PendingUserSettingReadBatch
) {
  if (batch.flushScheduled) {
    return;
  }

  batch.flushScheduled = true;
  queueMicrotask(() => {
    void flushUserSettingReadBatch(database, batch);
  });
}

async function flushUserSettingReadBatch(
  database: UserSettingReader,
  batch: PendingUserSettingReadBatch
) {
  batch.flushScheduled = false;
  batch.loading = true;

  try {
    const rows = await database.query.userSetting.findMany({
      where: inArray(userSetting.key, [...batch.keys])
    });

    for (const read of batch.reads) {
      read.resolve(rows.filter((row) => read.keys.has(row.key)));
    }
  } catch (error) {
    for (const read of batch.reads) {
      read.reject(error);
    }
  } finally {
    if (pendingUserSettingReadBatches.get(database) === batch) {
      pendingUserSettingReadBatches.delete(database);
    }
  }
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

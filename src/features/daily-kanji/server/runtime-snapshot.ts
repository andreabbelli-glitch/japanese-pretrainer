import { createHash, randomUUID } from "node:crypto";

import { and, eq, lte } from "drizzle-orm";

import type { DatabaseClient } from "../../../db/create-client.ts";
import { runtimeJobLease, runtimeSnapshot } from "../../../db/schema/index.ts";
import {
  buildDailyKanjiCardDataset,
  dailyKanjiDatasetVersion
} from "./exporter.ts";
import {
  buildDailyKanjiGlossarySnapshot,
  dailyKanjiGlossarySnapshotVersion
} from "./glossary-exporter.ts";

export const dailyKanjiRuntimeSnapshotKey = "daily-kanji:ios-dataset:v1";
export const dailyKanjiGlossaryRuntimeSnapshotKey =
  "daily-kanji:ios-glossary:v1";
export const dailyKanjiSnapshotMinimumRefreshMs = 22 * 60 * 60 * 1_000;
export const dailyKanjiGlossarySnapshotMinimumRefreshMs =
  6 * 24 * 60 * 60 * 1_000;
export const dailyKanjiCardSnapshotMaximumBytes = 1_000_000;
export const dailyKanjiGlossarySnapshotMaximumBytes = 4_000_000;
export const dailyKanjiSnapshotRefreshLeaseMs = 5 * 60 * 1_000;

export type DailyKanjiRuntimeSnapshot = {
  buildDurationMs: number;
  generatedAt: string;
  payloadBytes: number;
  payloadEtag: string;
  payloadJson: string;
  refreshNotBefore: string;
  schemaVersion: number;
};

export type DailyKanjiSnapshotRefreshResult =
  | {
      reason: "minimum-refresh-interval" | "refresh-in-progress";
      snapshot: DailyKanjiRuntimeSnapshot;
      status: "skipped";
    }
  | {
      snapshot: DailyKanjiRuntimeSnapshot;
      status: "refreshed";
    };

export type DailyKanjiRuntimeSnapshotsRefreshResult = {
  cards: DailyKanjiSnapshotRefreshResult;
  glossary: DailyKanjiSnapshotRefreshResult;
};

export function loadDailyKanjiRuntimeSnapshot(database: DatabaseClient) {
  return loadRuntimeSnapshot({
    database,
    key: dailyKanjiRuntimeSnapshotKey,
    maximumPayloadBytes: dailyKanjiCardSnapshotMaximumBytes,
    schemaVersion: dailyKanjiDatasetVersion
  });
}

export function loadDailyKanjiGlossaryRuntimeSnapshot(
  database: DatabaseClient
) {
  return loadRuntimeSnapshot({
    database,
    key: dailyKanjiGlossaryRuntimeSnapshotKey,
    maximumPayloadBytes: dailyKanjiGlossarySnapshotMaximumBytes,
    schemaVersion: dailyKanjiGlossarySnapshotVersion
  });
}

export function refreshDailyKanjiRuntimeSnapshot(input: {
  database: DatabaseClient;
  force?: boolean;
  now?: Date;
}) {
  return refreshRuntimeSnapshot({
    buildPayload: async (nowIso) => {
      const dataset = await buildDailyKanjiCardDataset({
        database: input.database,
        nowIso
      });

      return {
        generatedAt: dataset.generatedAt,
        payload: dataset
      };
    },
    database: input.database,
    etagPrefix: "dk",
    force: input.force,
    key: dailyKanjiRuntimeSnapshotKey,
    maximumPayloadBytes: dailyKanjiCardSnapshotMaximumBytes,
    minimumRefreshMs: dailyKanjiSnapshotMinimumRefreshMs,
    now: input.now,
    schemaVersion: dailyKanjiDatasetVersion
  });
}

export function refreshDailyKanjiGlossaryRuntimeSnapshot(input: {
  database: DatabaseClient;
  force?: boolean;
  now?: Date;
}) {
  return refreshRuntimeSnapshot({
    buildPayload: async (nowIso) => {
      const glossary = await buildDailyKanjiGlossarySnapshot({
        database: input.database,
        nowIso
      });

      return {
        generatedAt: glossary.generatedAt,
        payload: glossary
      };
    },
    database: input.database,
    etagPrefix: "dkg",
    force: input.force,
    key: dailyKanjiGlossaryRuntimeSnapshotKey,
    maximumPayloadBytes: dailyKanjiGlossarySnapshotMaximumBytes,
    minimumRefreshMs: dailyKanjiGlossarySnapshotMinimumRefreshMs,
    now: input.now,
    schemaVersion: dailyKanjiGlossarySnapshotVersion
  });
}

export async function refreshDailyKanjiRuntimeSnapshots(input: {
  database: DatabaseClient;
  force?: boolean;
  now?: Date;
}): Promise<DailyKanjiRuntimeSnapshotsRefreshResult> {
  const cards = await refreshDailyKanjiRuntimeSnapshot(input);
  const glossary = await refreshDailyKanjiGlossaryRuntimeSnapshot(input);

  return { cards, glossary };
}

async function loadRuntimeSnapshot(input: {
  database: DatabaseClient;
  key: string;
  maximumPayloadBytes: number;
  schemaVersion: number;
}): Promise<DailyKanjiRuntimeSnapshot | null> {
  const row = await input.database.query.runtimeSnapshot.findFirst({
    where: eq(runtimeSnapshot.key, input.key)
  });

  if (
    !row ||
    row.schemaVersion !== input.schemaVersion ||
    row.payloadBytes > input.maximumPayloadBytes
  ) {
    return null;
  }

  return mapRuntimeSnapshot(row);
}

async function refreshRuntimeSnapshot(input: {
  buildPayload: (nowIso: string) => Promise<{
    generatedAt: string;
    payload: unknown;
  }>;
  database: DatabaseClient;
  etagPrefix: string;
  force?: boolean;
  key: string;
  maximumPayloadBytes: number;
  minimumRefreshMs: number;
  now?: Date;
  schemaVersion: number;
}): Promise<DailyKanjiSnapshotRefreshResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const current = await loadRuntimeSnapshot({
    database: input.database,
    key: input.key,
    maximumPayloadBytes: input.maximumPayloadBytes,
    schemaVersion: input.schemaVersion
  });

  if (!input.force && current && current.refreshNotBefore > nowIso) {
    return {
      reason: "minimum-refresh-interval",
      snapshot: current,
      status: "skipped"
    };
  }

  const leaseOwnerToken = await acquireRuntimeSnapshotRefreshLease({
    database: input.database,
    key: input.key,
    now
  });

  if (!leaseOwnerToken) {
    const latest = await loadRuntimeSnapshot({
      database: input.database,
      key: input.key,
      maximumPayloadBytes: input.maximumPayloadBytes,
      schemaVersion: input.schemaVersion
    });

    if (latest) {
      return {
        reason: "refresh-in-progress",
        snapshot: latest,
        status: "skipped"
      };
    }

    throw new Error(
      `Runtime snapshot ${input.key} refresh is already running.`
    );
  }

  try {
    const startedAt = performance.now();
    const built = await input.buildPayload(nowIso);
    const payloadJson = JSON.stringify(built.payload);
    const payloadBytes = Buffer.byteLength(payloadJson);

    if (payloadBytes > input.maximumPayloadBytes) {
      throw new Error(
        `Runtime snapshot ${input.key} is ${payloadBytes} bytes; ` +
          `the hard limit is ${input.maximumPayloadBytes} bytes.`
      );
    }

    const snapshot: DailyKanjiRuntimeSnapshot = {
      buildDurationMs: Math.max(Math.round(performance.now() - startedAt), 0),
      generatedAt: built.generatedAt,
      payloadBytes,
      payloadEtag: buildPayloadEtag(payloadJson, input.etagPrefix),
      payloadJson,
      refreshNotBefore: new Date(
        now.getTime() + input.minimumRefreshMs
      ).toISOString(),
      schemaVersion: input.schemaVersion
    };

    await input.database
      .insert(runtimeSnapshot)
      .values({
        key: input.key,
        ...snapshot,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: runtimeSnapshot.key,
        set: {
          buildDurationMs: snapshot.buildDurationMs,
          generatedAt: snapshot.generatedAt,
          payloadBytes: snapshot.payloadBytes,
          payloadEtag: snapshot.payloadEtag,
          payloadJson: snapshot.payloadJson,
          refreshNotBefore: snapshot.refreshNotBefore,
          schemaVersion: snapshot.schemaVersion,
          updatedAt: nowIso
        }
      });

    return {
      snapshot,
      status: "refreshed"
    };
  } finally {
    await releaseRuntimeSnapshotRefreshLease({
      database: input.database,
      key: input.key,
      ownerToken: leaseOwnerToken
    });
  }
}

async function acquireRuntimeSnapshotRefreshLease(input: {
  database: DatabaseClient;
  key: string;
  now: Date;
}) {
  const nowIso = input.now.toISOString();
  const ownerToken = randomUUID();
  const expiresAt = new Date(
    input.now.getTime() + dailyKanjiSnapshotRefreshLeaseMs
  ).toISOString();
  const rows = await input.database
    .insert(runtimeJobLease)
    .values({
      expiresAt,
      key: input.key,
      ownerToken,
      updatedAt: nowIso
    })
    .onConflictDoUpdate({
      target: runtimeJobLease.key,
      set: {
        expiresAt,
        ownerToken,
        updatedAt: nowIso
      },
      setWhere: lte(runtimeJobLease.expiresAt, nowIso)
    })
    .returning({ ownerToken: runtimeJobLease.ownerToken });

  return rows[0]?.ownerToken === ownerToken ? ownerToken : null;
}

function releaseRuntimeSnapshotRefreshLease(input: {
  database: DatabaseClient;
  key: string;
  ownerToken: string;
}) {
  return input.database
    .delete(runtimeJobLease)
    .where(
      and(
        eq(runtimeJobLease.key, input.key),
        eq(runtimeJobLease.ownerToken, input.ownerToken)
      )
    );
}

function buildPayloadEtag(payloadJson: string, prefix: string) {
  const digest = createHash("sha256")
    .update(payloadJson)
    .digest("base64url")
    .slice(0, 27);

  return `"${prefix}-${digest}"`;
}

function mapRuntimeSnapshot(
  row: typeof runtimeSnapshot.$inferSelect
): DailyKanjiRuntimeSnapshot {
  return {
    buildDurationMs: row.buildDurationMs,
    generatedAt: row.generatedAt,
    payloadBytes: row.payloadBytes,
    payloadEtag: row.payloadEtag,
    payloadJson: row.payloadJson,
    refreshNotBefore: row.refreshNotBefore,
    schemaVersion: row.schemaVersion
  };
}

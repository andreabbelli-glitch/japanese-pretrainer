import { db, type DatabaseClient } from "@/db";
import {
  countKanjiClashAutomaticNewPairIntroductions,
  listEligibleKanjiClashSubjects,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries";

import { loadManualKanjiClashQueueSnapshot } from "./manual-queue-loader.ts";
import { buildKanjiClashQueueSnapshot } from "./queue.ts";
import { generateKanjiClashCandidates } from "./pairing.ts";
import type {
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashSessionMode,
  KanjiClashScope
} from "./types.ts";

export type LoadKanjiClashQueueSnapshotInput = {
  dailyNewLimit?: number | null;
  database?: DatabaseClient;
  mediaIds?: string[];
  mode: KanjiClashSessionMode;
  now?: Date;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
};

export async function loadKanjiClashQueueSnapshot(
  input: LoadKanjiClashQueueSnapshotInput
): Promise<KanjiClashQueueSnapshot> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const eligibleSubjects = await listEligibleKanjiClashSubjects(database, {
    mediaIds: input.mediaIds
  });

  if (input.mode === "manual") {
    return loadManualKanjiClashQueueSnapshot({
      database,
      eligibleSubjects,
      now,
      requestedSize: input.requestedSize,
      scope: input.scope,
      seenPairKeys: input.seenPairKeys
    });
  }

  return loadAutomaticKanjiClashQueueSnapshot({
    dailyNewLimit: input.dailyNewLimit,
    database,
    eligibleSubjects,
    mode: input.mode,
    now,
    requestedSize: input.requestedSize,
    scope: input.scope,
    seenPairKeys: input.seenPairKeys
  });
}

async function loadAutomaticKanjiClashQueueSnapshot(input: {
  dailyNewLimit?: number | null;
  database: DatabaseClient;
  eligibleSubjects: Awaited<ReturnType<typeof listEligibleKanjiClashSubjects>>;
  mode: KanjiClashSessionMode;
  now: Date;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
}): Promise<KanjiClashQueueSnapshot> {
  const candidates = generateKanjiClashCandidates(input.eligibleSubjects);
  const pairStates =
    candidates.length > 0
      ? await listKanjiClashPairStatesByPairKeys(
          input.database,
          candidates.map((candidate) => candidate.pairKey)
        )
      : new Map<string, KanjiClashPairState>();
  const introducedTodayCount =
    await countKanjiClashAutomaticNewPairIntroductions({
      database: input.database,
      endAt: startOfNextLocalDay(input.now).toISOString(),
      startAt: startOfLocalDay(input.now).toISOString()
    });

  return buildKanjiClashQueueSnapshot({
    candidates,
    dailyNewLimit: input.dailyNewLimit,
    mode: input.mode,
    newIntroducedTodayCount: introducedTodayCount,
    now: input.now,
    pairStates,
    requestedSize: input.requestedSize,
    scope: input.scope,
    seenPairKeys: input.seenPairKeys
  });
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfNextLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

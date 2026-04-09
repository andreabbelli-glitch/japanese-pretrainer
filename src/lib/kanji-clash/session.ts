import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  db,
  kanjiClashPairLog,
  kanjiClashPairState,
  type DatabaseClient
} from "@/db";
import {
  countKanjiClashAutomaticNewPairIntroductions,
  listKanjiClashDuePairStates,
  listEligibleKanjiClashSubjects,
  listKanjiClashPairStatesBySubjectKeys,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries";

import {
  advanceKanjiClashQueueSnapshot,
  buildKanjiClashQueueSnapshot,
  getKanjiClashCurrentRound
} from "./queue.ts";
import {
  buildKanjiClashCandidate,
  generateKanjiClashCandidates
} from "./pairing.ts";
import {
  createInitialKanjiClashPairState,
  transitionKanjiClashPairState
} from "./scheduler.ts";
import type {
  KanjiClashCandidate,
  KanjiClashEligibleSubject,
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashSessionActionResult,
  KanjiClashSessionMode,
  KanjiClashSessionRound,
  KanjiClashScope
} from "./types.ts";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

const MANUAL_DUE_PAGE_SIZE_MULTIPLIER = 4;
const MANUAL_FRONTIER_EXPANSION_MULTIPLIER = 4;
const MANUAL_FRONTIER_MULTIPLIER = 6;
const MANUAL_FRONTIER_MIN_SIZE = 16;

type LoadKanjiClashQueueSnapshotInput = {
  dailyNewLimit?: number | null;
  database?: DatabaseClient;
  mediaIds?: string[];
  mode: KanjiClashSessionMode;
  now?: Date;
  requestedSize?: number | null;
  scope: KanjiClashScope;
  seenPairKeys?: string[];
};

type ApplyKanjiClashSessionActionInput = {
  chosenSubjectKey: string;
  database?: DatabaseClient;
  expectedPairStateUpdatedAt?: string | null;
  now?: Date;
  queue: KanjiClashQueueSnapshot;
  responseMs?: number | null;
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
      eligibleSubjects,
      input,
      now
    });
  }

  const candidates = generateKanjiClashCandidates(eligibleSubjects);
  const candidatePairKeySet = new Set(
    candidates.map((candidate) => candidate.pairKey)
  );
  const candidatePairStates = await listKanjiClashPairStatesBySubjectKeys(
    database,
    eligibleSubjects.map((subject) => subject.subjectKey)
  );
  const pairStates = new Map(
    [...candidatePairStates].filter(([pairKey]) =>
      candidatePairKeySet.has(pairKey)
    )
  );
  const introducedTodayCount =
    await countKanjiClashAutomaticNewPairIntroductions({
      database,
      endAt: startOfNextLocalDay(now).toISOString(),
      startAt: startOfLocalDay(now).toISOString()
    });

  return buildKanjiClashQueueSnapshot({
    candidates,
    dailyNewLimit: input.dailyNewLimit,
    mode: input.mode,
    newIntroducedTodayCount: introducedTodayCount,
    now,
    pairStates,
    requestedSize: input.requestedSize,
    scope: input.scope,
    seenPairKeys: input.seenPairKeys
  });
}

async function loadManualKanjiClashQueueSnapshot(input: {
  eligibleSubjects: KanjiClashEligibleSubject[];
  input: LoadKanjiClashQueueSnapshotInput;
  now: Date;
}): Promise<KanjiClashQueueSnapshot> {
  const database = input.input.database ?? db;
  const requestedSize = normalizePositiveInteger(input.input.requestedSize, 20);
  const seenPairKeys = dedupeStable(input.input.seenPairKeys ?? []);

  if (requestedSize <= 0) {
    return buildKanjiClashQueueSnapshot({
      candidates: [],
      mode: "manual",
      newIntroducedTodayCount: 0,
      now: input.now,
      pairStates: new Map<string, KanjiClashPairState>(),
      requestedSize,
      scope: input.input.scope,
      seenPairKeys
    });
  }

  const eligibleSubjectsByKey = new Map(
    input.eligibleSubjects.map((subject) => [subject.subjectKey, subject])
  );
  // Manual mode keeps due pairs exact, then fills the rest from a deterministic frontier.
  const dueSeed = await collectManualDueCandidates({
    database,
    eligibleSubjectsByKey,
    now: input.now,
    requestedSize,
    seenPairKeys
  });
  const combinedCandidates: KanjiClashCandidate[] = [...dueSeed.candidates];
  const combinedPairStates = new Map(dueSeed.pairStates);
  const combinedPairKeySet = new Set([
    ...seenPairKeys,
    ...dueSeed.candidates.map((candidate) => candidate.pairKey)
  ]);
  let frontierSize = Math.min(
    input.eligibleSubjects.length,
    Math.max(
      requestedSize * MANUAL_FRONTIER_MULTIPLIER,
      MANUAL_FRONTIER_MIN_SIZE
    )
  );

  if (combinedCandidates.length < requestedSize) {
    while (true) {
      // The frontier grows only as far as needed to satisfy the requested session size.
      const frontierSubjects = input.eligibleSubjects.slice(0, frontierSize);
      const frontierCandidates = generateKanjiClashCandidates(
        frontierSubjects
      ).filter((candidate) => !combinedPairKeySet.has(candidate.pairKey));

      if (frontierCandidates.length > 0) {
        const frontierPairStates = await listKanjiClashPairStatesByPairKeys(
          database,
          frontierCandidates.map((candidate) => candidate.pairKey)
        );

        for (const [pairKey, pairState] of frontierPairStates) {
          combinedPairStates.set(pairKey, pairState);
        }

        for (const candidate of frontierCandidates) {
          combinedCandidates.push(candidate);
          combinedPairKeySet.add(candidate.pairKey);
        }
      }

      const queue = buildKanjiClashQueueSnapshot({
        candidates: combinedCandidates,
        mode: "manual",
        newIntroducedTodayCount: 0,
        now: input.now,
        pairStates: combinedPairStates,
        requestedSize,
        scope: input.input.scope,
        seenPairKeys
      });

      if (
        queue.totalCount >= requestedSize ||
        frontierSize >= input.eligibleSubjects.length
      ) {
        return queue;
      }

      const nextFrontierSize = Math.min(
        input.eligibleSubjects.length,
        frontierSize +
          Math.max(
            requestedSize * MANUAL_FRONTIER_EXPANSION_MULTIPLIER,
            MANUAL_FRONTIER_MIN_SIZE
          )
      );

      if (nextFrontierSize <= frontierSize) {
        return queue;
      }

      frontierSize = nextFrontierSize;
    }
  }

  return buildKanjiClashQueueSnapshot({
    candidates: combinedCandidates,
    mode: "manual",
    newIntroducedTodayCount: 0,
    now: input.now,
    pairStates: combinedPairStates,
    requestedSize,
    scope: input.input.scope,
    seenPairKeys
  });
}

async function collectManualDueCandidates(input: {
  database: DatabaseClient;
  eligibleSubjectsByKey: Map<string, KanjiClashEligibleSubject>;
  now: Date;
  requestedSize: number;
  seenPairKeys: string[];
}): Promise<{
  candidates: KanjiClashCandidate[];
  pairStates: Map<string, KanjiClashPairState>;
}> {
  const candidates: KanjiClashCandidate[] = [];
  const pairStates = new Map<string, KanjiClashPairState>();
  const seenPairKeySet = new Set(
    input.seenPairKeys.filter((pairKey) => pairKey.length > 0)
  );
  const pageSize = Math.max(
    MANUAL_FRONTIER_MIN_SIZE,
    input.requestedSize * MANUAL_DUE_PAGE_SIZE_MULTIPLIER
  );

  for (
    let offset = 0;
    candidates.length < input.requestedSize;
    offset += pageSize
  ) {
    const duePairStates = await listKanjiClashDuePairStates(input.database, {
      limit: pageSize,
      now: input.now.toISOString(),
      offset
    });

    if (duePairStates.length === 0) {
      break;
    }

    for (const pairState of duePairStates) {
      if (seenPairKeySet.has(pairState.pairKey)) {
        continue;
      }

      const left = input.eligibleSubjectsByKey.get(pairState.leftSubjectKey);
      const right = input.eligibleSubjectsByKey.get(pairState.rightSubjectKey);

      if (!left || !right) {
        continue;
      }

      const candidate = buildKanjiClashCandidate(left, right);

      if (!candidate || seenPairKeySet.has(candidate.pairKey)) {
        continue;
      }

      seenPairKeySet.add(candidate.pairKey);
      candidates.push(candidate);
      pairStates.set(candidate.pairKey, pairState);

      if (candidates.length >= input.requestedSize) {
        break;
      }
    }

    if (duePairStates.length < pageSize) {
      break;
    }
  }

  return {
    candidates,
    pairStates
  };
}

export async function applyKanjiClashSessionAction(
  input: ApplyKanjiClashSessionActionInput
): Promise<KanjiClashSessionActionResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const currentRound = getKanjiClashCurrentRound(input.queue);

  if (!currentRound) {
    throw new Error("Kanji Clash session is already complete.");
  }

  if (
    input.chosenSubjectKey !== currentRound.leftSubjectKey &&
    input.chosenSubjectKey !== currentRound.rightSubjectKey
  ) {
    throw new Error("Selected option is not part of the current round.");
  }

  const isCorrect = input.chosenSubjectKey === currentRound.correctSubjectKey;
  const result = isCorrect ? "good" : "again";
  const expectedPairStateUpdatedAt =
    input.expectedPairStateUpdatedAt ?? currentRound.pairState?.updatedAt ?? null;

  return database.transaction(async (tx) => {
    const persistedPairState = await resolveCurrentKanjiClashPairState(tx, {
      currentRound,
      expectedPairStateUpdatedAt
    });
    const currentState =
      persistedPairState ??
      createInitialKanjiClashPairState({
        leftSubjectKey: currentRound.candidate.leftSubjectKey,
        now,
        pairKey: currentRound.pairKey,
        rightSubjectKey: currentRound.candidate.rightSubjectKey
      });
    const canonicalRound = {
      ...currentRound,
      pairState: persistedPairState
    };
    const transition = transitionKanjiClashPairState({
      current: currentState,
      now,
      result
    });

    const persisted = persistedPairState
      ? await updateKanjiClashPairStateIfCurrent(tx, {
          expectedUpdatedAt: currentState.updatedAt,
          nextState: transition.next
        })
      : await insertKanjiClashPairStateIfAbsent(tx, {
          createdAt: currentState.createdAt,
          nextState: transition.next
        });

    if (!persisted) {
      throw new Error("Kanji Clash round is out of date.");
    }

    const logId = `kanji_clash_pair_log_${randomUUID()}`;

    await tx.insert(kanjiClashPairLog).values({
      answeredAt: now.toISOString(),
      chosenSubjectKey: input.chosenSubjectKey,
      correctSubjectKey: currentRound.correctSubjectKey,
      elapsedDays: transition.scheduled.elapsedDays,
      id: logId,
      leftSubjectKey: currentRound.leftSubjectKey,
      mode: input.queue.mode,
      newState: transition.next.state,
      pairKey: currentRound.pairKey,
      previousState: transition.previous.state,
      responseMs: input.responseMs ?? null,
      result,
      rightSubjectKey: currentRound.rightSubjectKey,
      scheduledDueAt: transition.scheduled.dueAt,
      schedulerVersion: transition.scheduled.schedulerVersion,
      targetSubjectKey: currentRound.targetSubjectKey
    });

    const nextQueue = advanceKanjiClashQueueSnapshot(
      input.queue,
      currentRound.pairKey,
      {
        awaitingConfirmation: !isCorrect
      }
    );

    return {
      answeredRound: canonicalRound,
      isCorrect,
      logId,
      nextQueue,
      nextRound: getKanjiClashCurrentRound(nextQueue),
      pairState: transition.next,
      previousPairState: transition.previous,
      result,
      scheduled: transition.scheduled,
      selectedSubjectKey: input.chosenSubjectKey
    };
  });
}

async function resolveCurrentKanjiClashPairState(
  tx: DatabaseTransaction,
  input: {
    currentRound: KanjiClashSessionRound;
    expectedPairStateUpdatedAt: string | null;
  }
) {
  if (!input.expectedPairStateUpdatedAt) {
    return null;
  }

  const row = await tx.query.kanjiClashPairState.findFirst({
    where: and(
      eq(kanjiClashPairState.pairKey, input.currentRound.pairKey),
      eq(kanjiClashPairState.updatedAt, input.expectedPairStateUpdatedAt)
    )
  });

  if (!row) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (
    row.leftSubjectKey !== input.currentRound.candidate.leftSubjectKey ||
    row.rightSubjectKey !== input.currentRound.candidate.rightSubjectKey
  ) {
    throw new Error("Kanji Clash round is out of date.");
  }

  return {
    createdAt: row.createdAt,
    difficulty: row.difficulty ?? null,
    dueAt: row.dueAt ?? null,
    lapses: row.lapses,
    lastInteractionAt: row.lastInteractionAt,
    lastReviewedAt: row.lastReviewedAt ?? null,
    learningSteps: row.learningSteps,
    leftSubjectKey: row.leftSubjectKey,
    pairKey: row.pairKey,
    reps: row.reps,
    rightSubjectKey: row.rightSubjectKey,
    scheduledDays: row.scheduledDays,
    schedulerVersion: row.schedulerVersion,
    stability: row.stability ?? null,
    state: row.state,
    updatedAt: row.updatedAt
  } satisfies KanjiClashPairState;
}

async function updateKanjiClashPairStateIfCurrent(
  tx: DatabaseTransaction,
  input: {
    expectedUpdatedAt: string;
    nextState: KanjiClashPairState;
  }
) {
  const [updatedRow] = await tx
    .update(kanjiClashPairState)
    .set(getKanjiClashPairStateUpdateValues(input.nextState))
    .where(
      and(
        eq(kanjiClashPairState.pairKey, input.nextState.pairKey),
        eq(kanjiClashPairState.updatedAt, input.expectedUpdatedAt)
      )
    )
    .returning({
      pairKey: kanjiClashPairState.pairKey
    });

  return Boolean(updatedRow);
}

async function insertKanjiClashPairStateIfAbsent(
  tx: DatabaseTransaction,
  input: {
    createdAt: string;
    nextState: KanjiClashPairState;
  }
) {
  const [insertedRow] = await tx
    .insert(kanjiClashPairState)
    .values({
      ...input.nextState,
      createdAt: input.createdAt
    })
    .onConflictDoNothing({
      target: kanjiClashPairState.pairKey
    })
    .returning({
      pairKey: kanjiClashPairState.pairKey
    });

  return Boolean(insertedRow);
}

function getKanjiClashPairStateUpdateValues(nextState: KanjiClashPairState) {
  return {
    difficulty: nextState.difficulty,
    dueAt: nextState.dueAt,
    lapses: nextState.lapses,
    lastInteractionAt: nextState.lastInteractionAt,
    lastReviewedAt: nextState.lastReviewedAt,
    learningSteps: nextState.learningSteps,
    leftSubjectKey: nextState.leftSubjectKey,
    reps: nextState.reps,
    rightSubjectKey: nextState.rightSubjectKey,
    scheduledDays: nextState.scheduledDays,
    schedulerVersion: nextState.schedulerVersion,
    stability: nextState.stability,
    state: nextState.state,
    updatedAt: nextState.updatedAt
  };
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfNextLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

function normalizePositiveInteger(
  value: number | null | undefined,
  fallback: number
) {
  if (!Number.isFinite(value)) {
    return Math.max(0, Math.trunc(fallback));
  }

  return Math.max(0, Math.trunc(value ?? fallback));
}

function dedupeStable(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

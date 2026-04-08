import { randomUUID } from "node:crypto";

import {
  db,
  kanjiClashPairLog,
  kanjiClashPairState,
  type DatabaseClient
} from "@/db";
import {
  countKanjiClashAutomaticNewPairIntroductions,
  getKanjiClashPairStateByPairKey,
  listEligibleKanjiClashSubjects,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries";

import {
  advanceKanjiClashQueueSnapshot,
  buildKanjiClashQueueSnapshot,
  getKanjiClashCurrentRound
} from "./queue.ts";
import { generateKanjiClashCandidates } from "./pairing.ts";
import {
  createInitialKanjiClashPairState,
  transitionKanjiClashPairState
} from "./scheduler.ts";
import type {
  KanjiClashPairState,
  KanjiClashQueueSnapshot,
  KanjiClashSessionActionResult,
  KanjiClashSessionMode,
  KanjiClashScope
} from "./types.ts";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

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
  const candidates = generateKanjiClashCandidates(eligibleSubjects);
  const pairKeys = candidates.map((candidate) => candidate.pairKey);
  const pairStates = await listKanjiClashPairStatesByPairKeys(
    database,
    pairKeys
  );
  const introducedTodayCount =
    input.mode === "automatic"
      ? await countKanjiClashAutomaticNewPairIntroductions({
          database,
          endAt: startOfNextLocalDay(now).toISOString(),
          pairKeys,
          startAt: startOfLocalDay(now).toISOString()
        })
      : 0;

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

  return database.transaction(async (tx) => {
    const currentState =
      (await getKanjiClashPairStateByPairKey(tx, currentRound.pairKey)) ??
      createInitialKanjiClashPairState({
        leftSubjectKey: currentRound.candidate.leftSubjectKey,
        now,
        pairKey: currentRound.pairKey,
        rightSubjectKey: currentRound.candidate.rightSubjectKey
      });
    const transition = transitionKanjiClashPairState({
      current: currentState,
      now,
      result
    });

    await upsertKanjiClashPairState(tx, {
      createdAt: currentState.createdAt,
      nextState: transition.next
    });

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
      answeredRound: currentRound,
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

async function upsertKanjiClashPairState(
  tx: DatabaseTransaction,
  input: {
    createdAt: string;
    nextState: KanjiClashPairState;
  }
) {
  await tx
    .insert(kanjiClashPairState)
    .values({
      ...input.nextState,
      createdAt: input.createdAt
    })
    .onConflictDoUpdate({
      target: kanjiClashPairState.pairKey,
      set: {
        difficulty: input.nextState.difficulty,
        dueAt: input.nextState.dueAt,
        lapses: input.nextState.lapses,
        lastInteractionAt: input.nextState.lastInteractionAt,
        lastReviewedAt: input.nextState.lastReviewedAt,
        learningSteps: input.nextState.learningSteps,
        leftSubjectKey: input.nextState.leftSubjectKey,
        reps: input.nextState.reps,
        rightSubjectKey: input.nextState.rightSubjectKey,
        scheduledDays: input.nextState.scheduledDays,
        schedulerVersion: input.nextState.schedulerVersion,
        stability: input.nextState.stability,
        state: input.nextState.state,
        updatedAt: input.nextState.updatedAt
      }
    });
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfNextLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
}

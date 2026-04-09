import { randomUUID } from "node:crypto";

import { db, type DatabaseClient } from "@/db";
import {
  createKanjiClashPairLog,
  getKanjiClashPairStateByPairKeyAndUpdatedAt,
  insertKanjiClashPairStateIfAbsent,
  updateKanjiClashPairStateIfCurrent
} from "@/db/queries";

import {
  advanceKanjiClashQueueSnapshot,
  getKanjiClashCurrentRound
} from "./queue.ts";
import { createKanjiClashQueueToken } from "./queue-token.ts";
import {
  createInitialKanjiClashPairState,
  transitionKanjiClashPairState
} from "./scheduler.ts";
import type {
  KanjiClashSessionActionResult,
  KanjiClashQueueSnapshot
} from "./types.ts";

export type ApplyKanjiClashSessionActionInput = {
  chosenSubjectKey: string;
  database?: DatabaseClient;
  expectedPairStateUpdatedAt?: string | null;
  now?: Date;
  queue: KanjiClashQueueSnapshot;
  responseMs?: number | null;
};

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
    const persistedPairState = await loadCurrentPairState(tx, {
      expectedPairStateUpdatedAt,
      pairKey: currentRound.pairKey,
      leftSubjectKey: currentRound.candidate.leftSubjectKey,
      rightSubjectKey: currentRound.candidate.rightSubjectKey
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

    await createKanjiClashPairLog(tx, {
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
      nextQueueToken: createKanjiClashQueueToken(nextQueue),
      nextRound: getKanjiClashCurrentRound(nextQueue),
      pairState: transition.next,
      previousPairState: transition.previous,
      result,
      scheduled: transition.scheduled,
      selectedSubjectKey: input.chosenSubjectKey
    };
  });
}

async function loadCurrentPairState(
  database: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
  input: {
    expectedPairStateUpdatedAt: string | null;
    leftSubjectKey: string;
    pairKey: string;
    rightSubjectKey: string;
  }
) {
  if (!input.expectedPairStateUpdatedAt) {
    return null;
  }

  const pairState = await getKanjiClashPairStateByPairKeyAndUpdatedAt(database, {
    pairKey: input.pairKey,
    updatedAt: input.expectedPairStateUpdatedAt
  });

  if (!pairState) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (
    pairState.leftSubjectKey !== input.leftSubjectKey ||
    pairState.rightSubjectKey !== input.rightSubjectKey
  ) {
    throw new Error("Kanji Clash round is out of date.");
  }

  return pairState;
}

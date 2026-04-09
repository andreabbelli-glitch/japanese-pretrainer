"use server";

import {
  db,
  type DatabaseClient
} from "@/db";
import { getKanjiClashPairStateByPairKey } from "@/db/queries";
import {
  applyKanjiClashSessionAction,
  buildKanjiClashPairKey,
  getKanjiClashCurrentRound,
  materializeKanjiClashSessionRound,
  type KanjiClashAnswerSubmissionPayload,
  type KanjiClashPairState,
  type KanjiClashQueueSnapshot,
  type KanjiClashSessionActionResult,
  type KanjiClashSessionRound
} from "@/lib/kanji-clash";

type SubmitKanjiClashAnswerActionInput = KanjiClashAnswerSubmissionPayload & {
  database?: DatabaseClient;
  responseMs?: number | null;
};

export async function submitKanjiClashAnswerAction(
  input: SubmitKanjiClashAnswerActionInput
): Promise<KanjiClashSessionActionResult> {
  const chosenSubjectKey = input.chosenSubjectKey.trim();
  const expectedPairKey = input.expectedPairKey.trim();
  const expectedPairStateUpdatedAt = normalizeOptionalString(
    input.expectedPairStateUpdatedAt
  );
  const database = input.database ?? db;
  const queue = validateSubmittedQueueSnapshot(input);

  if (!chosenSubjectKey) {
    throw new Error("Missing Kanji Clash selection.");
  }

  if (!expectedPairKey) {
    throw new Error("Missing Kanji Clash pair key.");
  }

  const currentRound = getKanjiClashCurrentRound(queue);

  if (!currentRound) {
    throw new Error("Kanji Clash session is already complete.");
  }

  if (currentRound.pairKey !== expectedPairKey) {
    throw new Error("Kanji Clash round is out of date.");
  }

  const persistedPairState = await getKanjiClashPairStateByPairKey(
    database,
    expectedPairKey
  );

  if ((persistedPairState?.updatedAt ?? null) !== expectedPairStateUpdatedAt) {
    throw new Error("Kanji Clash round is out of date.");
  }

  const canonicalQueue = replaceCurrentRound(
    queue,
    rebuildCurrentRound(queue, currentRound, persistedPairState)
  );
  const canonicalCurrentRound = getKanjiClashCurrentRound(canonicalQueue);

  if (!canonicalCurrentRound) {
    throw new Error("Kanji Clash session is already complete.");
  }

  assertRoundCoherence(canonicalCurrentRound);

  if (
    chosenSubjectKey !== canonicalCurrentRound.leftSubjectKey &&
    chosenSubjectKey !== canonicalCurrentRound.rightSubjectKey
  ) {
    throw new Error("Selected option is not part of the current Kanji Clash round.");
  }

  return applyKanjiClashSessionAction({
    chosenSubjectKey,
    database,
    queue: canonicalQueue,
    responseMs: normalizeResponseMs(input.responseMs)
  });
}

function assertRoundCoherence(round: KanjiClashSessionRound) {
  if (round.candidate.pairKey !== round.pairKey) {
    throw new Error("Kanji Clash round payload is inconsistent.");
  }

  if (round.left.subjectKey !== round.leftSubjectKey) {
    throw new Error("Kanji Clash left option payload is inconsistent.");
  }

  if (round.right.subjectKey !== round.rightSubjectKey) {
    throw new Error("Kanji Clash right option payload is inconsistent.");
  }

  if (
    round.correctSubjectKey !== round.leftSubjectKey &&
    round.correctSubjectKey !== round.rightSubjectKey
  ) {
    throw new Error("Kanji Clash correct option payload is inconsistent.");
  }

  if (round.correctSubjectKey !== round.targetSubjectKey) {
    throw new Error("Kanji Clash target payload is inconsistent.");
  }
}

function normalizeResponseMs(value?: number | null) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value ?? 0));
}

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function validateSubmittedQueueSnapshot(
  input: SubmitKanjiClashAnswerActionInput
) {
  parseKanjiClashSnapshotAtIso(input.snapshotAtIso);

  if (input.queue.snapshotAtIso !== input.snapshotAtIso) {
    throw new Error("Kanji Clash snapshot time is invalid.");
  }

  if (input.queue.mode !== input.mode || input.queue.scope !== input.scope) {
    throw new Error("Kanji Clash queue payload is inconsistent.");
  }

  if (input.queue.requestedSize !== input.requestedSize) {
    throw new Error("Kanji Clash queue payload is inconsistent.");
  }

  if (input.queue.dailyNewLimit !== input.dailyNewLimit) {
    throw new Error("Kanji Clash queue payload is inconsistent.");
  }

  if (!sameStringList(input.queue.seenPairKeys, input.seenPairKeys)) {
    throw new Error("Kanji Clash queue payload is inconsistent.");
  }

  return input.queue;
}

function rebuildCurrentRound(
  queue: KanjiClashQueueSnapshot,
  round: KanjiClashSessionRound,
  pairState: KanjiClashPairState | null
) {
  if (
    round.candidate.left.subjectKey !== round.candidate.leftSubjectKey ||
    round.candidate.right.subjectKey !== round.candidate.rightSubjectKey
  ) {
    throw new Error("Kanji Clash round payload is inconsistent.");
  }

  if (
    buildKanjiClashPairKey(
      round.candidate.leftSubjectKey,
      round.candidate.rightSubjectKey
    ) !== round.candidate.pairKey
  ) {
    throw new Error("Kanji Clash round payload is inconsistent.");
  }

  return materializeKanjiClashSessionRound(
    {
      candidate: round.candidate,
      pairState,
      source: round.source
    },
    queue.currentRoundIndex
  );
}

function replaceCurrentRound(
  queue: KanjiClashQueueSnapshot,
  currentRound: KanjiClashSessionRound
) {
  const rounds = [...queue.rounds];
  rounds[queue.currentRoundIndex] = currentRound;

  return {
    ...queue,
    rounds
  };
}

function sameStringList(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function parseKanjiClashSnapshotAtIso(snapshotAtIso: string) {
  const snapshotAt = new Date(snapshotAtIso.trim());

  if (Number.isNaN(snapshotAt.getTime())) {
    throw new Error("Kanji Clash snapshot time is invalid.");
  }

  return snapshotAt;
}

"use server";

import {
  db,
  type DatabaseClient
} from "@/db";
import {
  applyKanjiClashSessionAction,
  getKanjiClashCurrentRound,
  type KanjiClashAnswerSubmissionPayload,
  type KanjiClashSessionActionResult,
  type KanjiClashSessionRound,
  verifyKanjiClashQueueToken
} from "@/lib/kanji-clash";

type SubmitKanjiClashAnswerActionInput = KanjiClashAnswerSubmissionPayload & {
  database?: DatabaseClient;
  responseMs?: number | null;
};

export async function submitKanjiClashAnswerAction(
  input: SubmitKanjiClashAnswerActionInput
): Promise<KanjiClashSessionActionResult> {
  const expectedPairKey = input.expectedPairKey.trim();
  const expectedPairStateUpdatedAt = normalizeOptionalString(
    input.expectedPairStateUpdatedAt
  );
  const database = input.database ?? db;
  const queue = validateSubmittedQueueToken(input.queueToken);

  if (!isRoundSide(input.selectedSide)) {
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

  if ((currentRound.pairState?.updatedAt ?? null) !== expectedPairStateUpdatedAt) {
    throw new Error("Kanji Clash queue payload is inconsistent.");
  }

  assertRoundCoherence(currentRound);

  const chosenSubjectKey =
    input.selectedSide === "left"
      ? currentRound.leftSubjectKey
      : currentRound.rightSubjectKey;

  return applyKanjiClashSessionAction({
    chosenSubjectKey,
    database,
    expectedPairStateUpdatedAt,
    queue,
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

function isRoundSide(value: string): value is "left" | "right" {
  return value === "left" || value === "right";
}

function validateSubmittedQueueToken(queueToken: string) {
  const queue = verifyKanjiClashQueueToken(queueToken.trim());

  if (!queue) {
    throw new Error("Kanji Clash queue token is invalid.");
  }

  return queue;
}

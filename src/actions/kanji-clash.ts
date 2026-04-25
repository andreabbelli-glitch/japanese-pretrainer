"use server";

import { db, type DatabaseClient } from "@/db";
import { invalidateKanjiClashManualContrastChanged } from "@/lib/cache-invalidation-policy";
import { getKanjiClashCurrentRound } from "@/features/kanji-clash/model/queue";
import {
  archiveKanjiClashManualContrast,
  applyKanjiClashSessionAction,
  restoreKanjiClashManualContrast,
  verifyKanjiClashQueueToken
} from "@/features/kanji-clash/server";
import type {
  KanjiClashAnswerSubmissionPayload,
  KanjiClashSessionActionResult,
  KanjiClashSessionRound
} from "@/features/kanji-clash/types";

type SubmitKanjiClashAnswerActionInput = KanjiClashAnswerSubmissionPayload & {
  database?: DatabaseClient;
  responseMs?: number | null;
};

export async function submitKanjiClashAnswerAction(
  input: SubmitKanjiClashAnswerActionInput
): Promise<KanjiClashSessionActionResult> {
  const expectedPairKey = input.expectedPairKey.trim();
  const expectedRoundKey = normalizeOptionalString(input.expectedRoundKey);
  const expectedPairStateUpdatedAt = normalizeOptionalString(
    input.expectedPairStateUpdatedAt
  );
  const database = input.database ?? db;
  const queue = validateSubmittedQueueToken(input.queueToken);

  if (!isRoundSide(input.selectedSide)) {
    throw new Error("Missing Kanji Clash selection.");
  }

  if (!expectedPairKey && !expectedRoundKey) {
    throw new Error("Missing Kanji Clash round key.");
  }

  const currentRound = getKanjiClashCurrentRound(queue);

  if (!currentRound) {
    throw new Error("Kanji Clash session is already complete.");
  }

  if (expectedPairKey && currentRound.pairKey !== expectedPairKey) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (expectedRoundKey && currentRound.roundKey !== expectedRoundKey) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (
    (currentRound.pairState?.updatedAt ?? null) !== expectedPairStateUpdatedAt
  ) {
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

  if (
    round.candidate.roundOverride &&
    (round.candidate.roundOverride.roundKey !== round.roundKey ||
      round.candidate.roundOverride.targetSubjectKey !==
        round.targetSubjectKey ||
      JSON.stringify(round.candidate.roundOverride.origin) !==
        JSON.stringify(round.origin))
  ) {
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

export async function archiveKanjiClashManualContrastAction(input: {
  contrastKey: string;
  database?: DatabaseClient;
  now?: Date;
}) {
  const contrastKey = input.contrastKey.trim();

  if (!contrastKey) {
    throw new Error("Missing Kanji Clash manual contrast key.");
  }

  await archiveKanjiClashManualContrast({
    contrastKey,
    database: input.database ?? db,
    now: input.now
  });
  invalidateKanjiClashManualContrastChanged();
}

export async function restoreKanjiClashManualContrastAction(input: {
  contrastKey: string;
  database?: DatabaseClient;
  now?: Date;
}) {
  const contrastKey = input.contrastKey.trim();

  if (!contrastKey) {
    throw new Error("Missing Kanji Clash manual contrast key.");
  }

  await restoreKanjiClashManualContrast({
    contrastKey,
    database: input.database ?? db,
    now: input.now
  });
  invalidateKanjiClashManualContrastChanged();
}

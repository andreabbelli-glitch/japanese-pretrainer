"use server";

import type { DatabaseClient } from "@/db";
import {
  applyKanjiClashSessionAction,
  getKanjiClashCurrentRound,
  type KanjiClashQueueSnapshot,
  type KanjiClashSessionActionResult,
  type KanjiClashSessionRound
} from "@/lib/kanji-clash";

type SubmitKanjiClashAnswerActionInput = {
  chosenSubjectKey: string;
  database?: DatabaseClient;
  expectedPairKey: string;
  queue: KanjiClashQueueSnapshot;
  responseMs?: number | null;
};

export async function submitKanjiClashAnswerAction(
  input: SubmitKanjiClashAnswerActionInput
): Promise<KanjiClashSessionActionResult> {
  const chosenSubjectKey = input.chosenSubjectKey.trim();
  const expectedPairKey = input.expectedPairKey.trim();

  if (!chosenSubjectKey) {
    throw new Error("Missing Kanji Clash selection.");
  }

  if (!expectedPairKey) {
    throw new Error("Missing Kanji Clash pair key.");
  }

  const currentRound = getKanjiClashCurrentRound(input.queue);

  if (!currentRound) {
    throw new Error("Kanji Clash session is already complete.");
  }

  assertRoundCoherence(currentRound);

  if (currentRound.pairKey !== expectedPairKey) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (
    chosenSubjectKey !== currentRound.leftSubjectKey &&
    chosenSubjectKey !== currentRound.rightSubjectKey
  ) {
    throw new Error("Selected option is not part of the current Kanji Clash round.");
  }

  return applyKanjiClashSessionAction({
    chosenSubjectKey,
    database: input.database,
    queue: input.queue,
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

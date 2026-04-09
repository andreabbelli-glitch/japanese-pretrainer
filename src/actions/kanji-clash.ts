"use server";

import type { DatabaseClient } from "@/db";
import {
  applyKanjiClashSessionAction,
  loadKanjiClashQueueSnapshot,
  getKanjiClashCurrentRound,
  type KanjiClashAnswerSubmissionPayload,
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
  const snapshotAt = parseKanjiClashSnapshotAtIso(input.snapshotAtIso);

  if (!chosenSubjectKey) {
    throw new Error("Missing Kanji Clash selection.");
  }

  if (!expectedPairKey) {
    throw new Error("Missing Kanji Clash pair key.");
  }

  const queue = await loadKanjiClashQueueSnapshot({
    dailyNewLimit: input.dailyNewLimit,
    database: input.database,
    mediaIds: input.mediaIds.length > 0 ? input.mediaIds : undefined,
    mode: input.mode,
    now: snapshotAt,
    requestedSize: input.requestedSize,
    scope: input.scope,
    seenPairKeys: input.seenPairKeys
  });

  const currentRound = getKanjiClashCurrentRound(queue);

  if (!currentRound) {
    throw new Error("Kanji Clash session is already complete.");
  }

  assertRoundCoherence(currentRound);

  if (currentRound.pairKey !== expectedPairKey) {
    throw new Error("Kanji Clash round is out of date.");
  }

  if (
    (currentRound.pairState?.updatedAt ?? null) !== expectedPairStateUpdatedAt
  ) {
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

function parseKanjiClashSnapshotAtIso(snapshotAtIso: string) {
  const snapshotAt = new Date(snapshotAtIso.trim());

  if (Number.isNaN(snapshotAt.getTime())) {
    throw new Error("Kanji Clash snapshot time is invalid.");
  }

  return snapshotAt;
}

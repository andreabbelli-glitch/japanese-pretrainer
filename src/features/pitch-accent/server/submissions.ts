import { db, type DatabaseClient } from "@/db";
import {
  getPitchAccentAttemptLogByTrialId,
  getPitchAccentSessionRow,
  getPitchAccentTrialRow,
  insertPitchAccentAttemptLogIfAbsent,
  updatePitchAccentTrialAnswered
} from "@/db/queries";

import type { SubmitPitchAccentAnswerResult } from "./contracts";
import { refreshPitchAccentSessionRollup } from "./rollups";

export async function submitPitchAccentAnswer(input: {
  readonly chosenOptionId: string;
  readonly database?: DatabaseClient;
  readonly inputMethod?: string | null;
  readonly now?: Date;
  readonly responseMs: number;
  readonly sessionId: string;
  readonly trialId: string;
}): Promise<SubmitPitchAccentAnswerResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const responseMs = Math.max(0, Math.round(input.responseMs));

  return database.transaction(async (transaction) => {
    const session = await getPitchAccentSessionRow(
      transaction,
      input.sessionId
    );
    if (!session) {
      throw new Error("Pitch accent session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Pitch accent session is not active.");
    }

    const trial = await getPitchAccentTrialRow(transaction, {
      sessionId: input.sessionId,
      trialId: input.trialId
    });
    if (!trial) {
      throw new Error("Pitch accent trial was not found.");
    }

    const existingAttempt = await getPitchAccentAttemptLogByTrialId(
      transaction,
      input.trialId
    );
    if (existingAttempt) {
      return {
        idempotent: true,
        isCorrect: existingAttempt.isCorrect === 1
      };
    }

    if (trial.status !== "planned") {
      throw new Error("Pitch accent trial is not answerable.");
    }

    const isCorrect = input.chosenOptionId === trial.correctOptionId;
    const inserted = await insertPitchAccentAttemptLogIfAbsent(transaction, {
      chosenOptionId: input.chosenOptionId,
      correctOptionId: trial.correctOptionId,
      createdAt: nowIso,
      id: `pitch-accent-attempt-${input.trialId}`,
      inputMethod: input.inputMethod?.trim() || null,
      isCorrect: isCorrect ? 1 : 0,
      kana: trial.kana,
      pairId: trial.pairId,
      patternKey: trial.correctPatternKey,
      responseMs,
      sessionId: input.sessionId,
      sortOrder: trial.sortOrder,
      trialId: input.trialId
    });

    if (!inserted) {
      const attempt = await getPitchAccentAttemptLogByTrialId(
        transaction,
        input.trialId
      );

      return {
        idempotent: true,
        isCorrect: attempt?.isCorrect === 1
      };
    }

    await updatePitchAccentTrialAnswered(transaction, {
      answeredAt: nowIso,
      trialId: input.trialId
    });
    await refreshPitchAccentSessionRollup(transaction, {
      sessionId: input.sessionId,
      status: "active",
      updatedAt: nowIso
    });

    return {
      idempotent: false,
      isCorrect
    };
  });
}

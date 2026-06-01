import { db, type DatabaseClient } from "@/db";
import {
  getKatakanaAttemptLogByTrialId,
  getKatakanaExerciseBlockRow,
  getKatakanaExerciseResultRow,
  getKatakanaSessionRow,
  getKatakanaTrialRow,
  insertKatakanaAttemptLogIfAbsent,
  insertKatakanaConfusionEdgeIfAbsent,
  insertKatakanaExerciseResultIfAbsent,
  listKatakanaTrialRowsByBlock,
  updateKatakanaTrialAnswered,
  updateKatakanaTrialsAnsweredByBlock
} from "@/db/queries";

import {
  getKatakanaSpeedItemById,
  getKatakanaSpeedItemBySurface
} from "../model/catalog";
import { isKatakanaSpeedAnswerCorrect } from "../model/scoring";
import { classifyKatakanaSpeedError } from "../model/errors";
import type { KatakanaSpeedErrorTag } from "../types";
import type {
  AggregateKatakanaSpeedExerciseResult,
  KatakanaSpeedSelfRating,
  SubmitKatakanaSpeedAnswerResult,
  SubmitKatakanaSpeedSelfCheckResult
} from "./contracts";
import {
  assertKatakanaSelfRating,
  assertKatakanaExerciseResultIdentity,
  assertKatakanaSpeedTrialMode,
  exerciseFamilyForTrialMode,
  normalizeMetricsJson,
  normalizeRanGridMetricsJson,
  normalizeSelfCheckMetrics,
  parseJsonArray,
  parseJsonObject,
  parseKatakanaSelfRating,
  parseKatakanaSpeedTrialMode,
  selfRatingErrorTags
} from "./codecs";
import { snapshotKatakanaTrialRow, type KatakanaTrialRow } from "./mappers";
import { updateItemStateAfterAttempt } from "./rollups";

const selfCheckTrialModes = new Set([
  "word_naming",
  "pseudoword_sprint",
  "sentence_sprint"
]);

export async function submitKatakanaSpeedAnswer(input: {
  database?: DatabaseClient;
  inputMethod?: string | null;
  now?: Date;
  responseMs: number;
  sessionId: string;
  trialId: string;
  userAnswer: string;
}): Promise<SubmitKatakanaSpeedAnswerResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const responseMs = Math.max(0, Math.round(input.responseMs));

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Katakana Speed session is not active.");
    }

    const trial = await getKatakanaTrialRow(transaction, {
      sessionId: input.sessionId,
      trialId: input.trialId
    });
    if (!trial) {
      throw new Error("Katakana Speed trial was not found.");
    }
    assertKatakanaSpeedTrialMode(trial.mode);

    const existingAttempt = await getKatakanaAttemptLogByTrialId(
      transaction,
      input.trialId
    );
    if (existingAttempt) {
      return {
        errorTags: parseJsonArray<KatakanaSpeedErrorTag>(
          existingAttempt.errorTagsJson
        ),
        idempotent: true,
        isCorrect: existingAttempt.isCorrect === 1
      };
    }

    if (trial.status !== "planned") {
      throw new Error("Katakana Speed trial is not answerable.");
    }

    const expectedAnswer =
      trial.expectedSurface ??
      getKatakanaSpeedItemById(trial.correctItemId)?.surface ??
      trial.promptSurface;
    const userAnswer = input.userAnswer.trim();
    const trialFeatures = parseJsonObject(trial.featuresJson);
    const isCorrect = isKatakanaSpeedAnswerCorrect({
      expectedSurface: expectedAnswer,
      interaction: trialFeatures.interaction,
      userAnswer
    });
    const errorTags = classifyKatakanaSpeedError({
      actualSurface: isCorrect ? expectedAnswer : userAnswer,
      expectedSurface: expectedAnswer,
      responseMs,
      targetRtMs: trial.targetRtMs
    });
    const confusedWithItemId = !isCorrect
      ? (getKatakanaSpeedItemBySurface(userAnswer)?.id ?? null)
      : null;
    const trialSnapshot = snapshotKatakanaTrialRow(trial);

    const inserted = await insertKatakanaAttemptLogIfAbsent(transaction, {
      blockId: trial.blockId,
      confusedWithItemId,
      createdAt: nowIso,
      errorTagsJson: JSON.stringify(errorTags),
      exerciseId: trial.exerciseId,
      expectedAnswer,
      expectedSurface: trialSnapshot.expectedSurface,
      exposureMs: trial.exposureMs,
      featuresJson: JSON.stringify({
        ...trialSnapshot.features,
        correctnessSource:
          typeof trialSnapshot.features.correctnessSource === "string"
            ? trialSnapshot.features.correctnessSource
            : "objective"
      }),
      focusChunksJson: JSON.stringify(trialSnapshot.focusChunks),
      id: `katakana-speed-attempt-${input.trialId}`,
      inputMethod: input.inputMethod?.trim() || null,
      isCorrect: isCorrect ? 1 : 0,
      itemId: trial.itemId,
      itemType: trialSnapshot.itemType,
      metricsJson: JSON.stringify(trialSnapshot.metrics),
      mode: trial.mode,
      promptSurface: trial.promptSurface,
      responseMs,
      sortOrder: trial.sortOrder,
      sessionId: input.sessionId,
      trialId: input.trialId,
      userAnswer,
      wasPseudo: trialSnapshot.wasPseudo ? 1 : 0,
      wasRepair: trialSnapshot.wasRepair ? 1 : 0,
      wasTransfer: trialSnapshot.wasTransfer ? 1 : 0
    });

    if (!inserted) {
      const attempt = await getKatakanaAttemptLogByTrialId(
        transaction,
        input.trialId
      );
      return {
        errorTags: parseJsonArray<KatakanaSpeedErrorTag>(
          attempt?.errorTagsJson ?? "[]"
        ),
        idempotent: true,
        isCorrect: attempt?.isCorrect === 1
      };
    }

    await updateKatakanaTrialAnswered(transaction, {
      answeredAt: nowIso,
      trialId: input.trialId
    });
    if (!isCorrect && confusedWithItemId) {
      await insertKatakanaConfusionEdgeIfAbsent(transaction, {
        blockId: trial.blockId,
        confusionCount: 1,
        createdAt: nowIso,
        edgeId: `katakana-speed-confusion-${input.trialId}`,
        exerciseId: trial.exerciseId,
        expectedItemId: trial.correctItemId,
        metricsJson: JSON.stringify({
          inputMethod: input.inputMethod?.trim() || null,
          responseMs
        }),
        observedItemId: confusedWithItemId,
        sessionId: input.sessionId,
        sortOrder: trial.sortOrder,
        updatedAt: nowIso
      });
    }
    await updateItemStateAfterAttempt(transaction, {
      correctnessSource: "objective",
      errorTags,
      isCorrect,
      itemId: trial.itemId,
      nowIso,
      responseMs
    });

    return {
      errorTags,
      idempotent: false,
      isCorrect
    };
  });
}

export async function submitKatakanaSpeedSelfCheck(input: {
  database?: DatabaseClient;
  metricsJson?: unknown;
  now?: Date;
  responseMs: number;
  selfRating: KatakanaSpeedSelfRating;
  sessionId: string;
  trialId: string;
}): Promise<SubmitKatakanaSpeedSelfCheckResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const responseMs = Math.max(0, Math.round(input.responseMs));
  assertKatakanaSelfRating(input.selfRating);

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Katakana Speed session is not active.");
    }

    const trial = await getKatakanaTrialRow(transaction, {
      sessionId: input.sessionId,
      trialId: input.trialId
    });
    if (!trial) {
      throw new Error("Katakana Speed trial was not found.");
    }
    const trialMode = parseKatakanaSpeedTrialMode(trial.mode);
    if (!trialMode) {
      throw new Error("Unsupported Katakana Speed trial mode.");
    }
    if (!selfCheckTrialModes.has(trialMode)) {
      throw new Error("Katakana Speed trial does not accept self-check.");
    }

    const existingAttempt = await getKatakanaAttemptLogByTrialId(
      transaction,
      input.trialId
    );
    if (existingAttempt) {
      return {
        idempotent: true,
        isCorrect: existingAttempt.isCorrect === 1,
        selfRating:
          parseKatakanaSelfRating(existingAttempt.selfRating) ?? "wrong"
      };
    }

    if (trial.status !== "planned") {
      throw new Error("Katakana Speed trial is not answerable.");
    }

    const trialSnapshot = snapshotKatakanaTrialRow(trial);
    const metrics = normalizeSelfCheckMetrics({
      inputMetrics: input.metricsJson,
      responseMs,
      selfRating: input.selfRating,
      targetRtMs: trial.targetRtMs,
      trialMetrics: trialSnapshot.metrics
    });
    const isCorrect = input.selfRating !== "wrong";
    const errorTags = selfRatingErrorTags({
      selfRating: input.selfRating,
      slowCorrect: Boolean(metrics.slowCorrect)
    });
    const metricsJson = JSON.stringify(metrics);
    const expectedAnswer = trial.expectedSurface ?? trial.promptSurface;

    const inserted = await insertKatakanaAttemptLogIfAbsent(transaction, {
      blockId: trial.blockId,
      confusedWithItemId: null,
      createdAt: nowIso,
      errorTagsJson: JSON.stringify(errorTags),
      exerciseId: trial.exerciseId,
      expectedAnswer,
      expectedSurface: trialSnapshot.expectedSurface,
      exposureMs: trial.exposureMs,
      featuresJson: JSON.stringify({
        ...trialSnapshot.features,
        correctnessSource: "self_report",
        exerciseFamily:
          typeof trialSnapshot.features.exerciseFamily === "string"
            ? trialSnapshot.features.exerciseFamily
            : exerciseFamilyForTrialMode(trialMode),
        showReadingDuringTrial: false
      }),
      focusChunksJson: JSON.stringify(trialSnapshot.focusChunks),
      id: `katakana-speed-attempt-${input.trialId}`,
      inputMethod: "self_check",
      isCorrect: isCorrect ? 1 : 0,
      itemId: trial.itemId,
      itemType: trialSnapshot.itemType,
      metricsJson,
      mode: trialMode,
      promptSurface: trial.promptSurface,
      responseMs,
      selfRating: input.selfRating,
      sessionId: input.sessionId,
      sortOrder: trial.sortOrder,
      trialId: input.trialId,
      userAnswer: input.selfRating,
      wasPseudo: trialSnapshot.wasPseudo ? 1 : 0,
      wasRepair: trialSnapshot.wasRepair ? 1 : 0,
      wasTransfer: trialSnapshot.wasTransfer ? 1 : 0
    });

    if (!inserted) {
      const attempt = await getKatakanaAttemptLogByTrialId(
        transaction,
        input.trialId
      );
      return {
        idempotent: true,
        isCorrect: attempt?.isCorrect === 1,
        selfRating: parseKatakanaSelfRating(attempt?.selfRating) ?? "wrong"
      };
    }

    await updateKatakanaTrialAnswered(transaction, {
      answeredAt: nowIso,
      metricsJson,
      selfRating: input.selfRating,
      trialId: input.trialId
    });
    await updateItemStateAfterAttempt(transaction, {
      correctnessSource: "self_report",
      errorTags,
      isCorrect,
      itemId: trial.itemId,
      nowIso,
      responseMs
    });

    return {
      idempotent: false,
      isCorrect,
      selfRating: input.selfRating
    };
  });
}

export async function aggregateKatakanaSpeedExerciseResult(input: {
  blockId?: string | null;
  database?: DatabaseClient;
  exerciseId: string;
  metricsJson?: unknown;
  now?: Date;
  resultId: string;
  selfRating?: KatakanaSpeedSelfRating | null;
  sessionId: string;
  sortOrder?: number;
  trialId?: string | null;
}): Promise<AggregateKatakanaSpeedExerciseResult> {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();
  const resultId = input.resultId.trim();
  if (!resultId) {
    throw new Error("Missing Katakana Speed result id.");
  }
  const blockId = input.blockId?.trim();
  if (!blockId) {
    throw new Error("Katakana Speed exercise block is required.");
  }
  if (input.selfRating) {
    assertKatakanaSelfRating(input.selfRating);
  }

  return database.transaction(async (transaction) => {
    const session = await getKatakanaSessionRow(transaction, input.sessionId);
    if (!session) {
      throw new Error("Katakana Speed session was not found.");
    }
    if (session.status !== "active") {
      throw new Error("Katakana Speed session is not active.");
    }

    const block = await getKatakanaExerciseBlockRow(transaction, blockId);
    if (!block || block.sessionId !== input.sessionId) {
      throw new Error("Katakana Speed exercise block was not found.");
    }
    if (block.exerciseId !== input.exerciseId) {
      throw new Error("Katakana Speed exercise block does not match.");
    }
    if (block.mode !== "ran_grid") {
      throw new Error("Katakana Speed exercise does not accept aggregates.");
    }

    const existingResult = await getKatakanaExerciseResultRow(
      transaction,
      resultId
    );
    if (existingResult) {
      assertKatakanaExerciseResultIdentity(existingResult, {
        blockId,
        exerciseId: input.exerciseId,
        sessionId: input.sessionId
      });

      return {
        idempotent: true,
        resultId
      };
    }

    let aggregateTrial: KatakanaTrialRow | null = null;
    if (input.trialId) {
      const trial = await getKatakanaTrialRow(transaction, {
        sessionId: input.sessionId,
        trialId: input.trialId
      });
      if (!trial) {
        throw new Error("Katakana Speed trial was not found.");
      }
      if (trial.blockId !== blockId) {
        throw new Error("Katakana Speed trial block does not match.");
      }
      if (trial.exerciseId !== input.exerciseId) {
        throw new Error("Katakana Speed trial exercise does not match.");
      }
      aggregateTrial = trial;
    } else if (block.mode === "ran_grid") {
      const blockTrials = await listKatakanaTrialRowsByBlock(
        transaction,
        blockId
      );
      aggregateTrial =
        blockTrials.find((trial) => trial.mode === "ran_grid") ??
        blockTrials[0] ??
        null;
    }

    const metricsJson =
      block.mode === "ran_grid"
        ? normalizeRanGridMetricsJson(input.metricsJson, aggregateTrial)
        : normalizeMetricsJson(input.metricsJson);

    const inserted = await insertKatakanaExerciseResultIfAbsent(transaction, {
      blockId,
      createdAt: nowIso,
      exerciseId: input.exerciseId,
      isCorrect:
        input.selfRating === undefined || input.selfRating === null
          ? null
          : input.selfRating === "wrong"
            ? 0
            : 1,
      metricsJson,
      resultId,
      selfRating: input.selfRating ?? null,
      sessionId: input.sessionId,
      sortOrder: input.sortOrder ?? 0,
      trialId: input.trialId?.trim() || null
    });

    if (!inserted) {
      const conflictingResult = await getKatakanaExerciseResultRow(
        transaction,
        resultId
      );
      if (!conflictingResult) {
        throw new Error("Katakana Speed result could not be persisted.");
      }
      assertKatakanaExerciseResultIdentity(conflictingResult, {
        blockId,
        exerciseId: input.exerciseId,
        sessionId: input.sessionId
      });
    }
    await updateKatakanaTrialsAnsweredByBlock(transaction, {
      answeredAt: nowIso,
      blockId,
      metricsJson,
      selfRating: input.selfRating ?? null
    });

    return {
      idempotent: !inserted,
      resultId
    };
  });
}

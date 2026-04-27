"use server";

import { db, type DatabaseClient } from "@/db";
import {
  aggregateKatakanaSpeedExerciseResult,
  abandonKatakanaSpeedSession,
  completeKatakanaSpeedSession,
  startKatakanaSpeedSession,
  submitKatakanaSpeedAnswer,
  submitKatakanaSpeedSelfCheck,
  type KatakanaSpeedManualExercise,
  type KatakanaSpeedSelfRating,
  type KatakanaSpeedSessionMode
} from "@/features/katakana-speed/server";

export async function startKatakanaSpeedSessionAction(input: {
  count?: number;
  database?: DatabaseClient;
  manualExercise?: KatakanaSpeedManualExercise;
  mode?: KatakanaSpeedSessionMode;
  now?: Date;
  seed?: string;
}) {
  return startKatakanaSpeedSession({
    count: input.count,
    database: input.database ?? db,
    manualExercise: input.manualExercise,
    mode: input.mode,
    now: input.now,
    seed: input.seed
  });
}

export async function submitKatakanaSpeedAnswerAction(input: {
  database?: DatabaseClient;
  inputMethod?: string | null;
  now?: Date;
  responseMs: number;
  sessionId: string;
  trialId: string;
  userAnswer: string;
}) {
  const sessionId = input.sessionId.trim();
  const trialId = input.trialId.trim();

  if (!sessionId) {
    throw new Error("Missing Katakana Speed session id.");
  }
  if (!trialId) {
    throw new Error("Missing Katakana Speed trial id.");
  }

  return submitKatakanaSpeedAnswer({
    database: input.database ?? db,
    inputMethod: input.inputMethod,
    now: input.now,
    responseMs: input.responseMs,
    sessionId,
    trialId,
    userAnswer: input.userAnswer
  });
}

export async function submitKatakanaSpeedSelfCheckAction(input: {
  database?: DatabaseClient;
  metricsJson?: unknown;
  now?: Date;
  responseMs: number;
  selfRating: KatakanaSpeedSelfRating;
  sessionId: string;
  trialId: string;
}) {
  const sessionId = input.sessionId.trim();
  const trialId = input.trialId.trim();

  if (!sessionId) {
    throw new Error("Missing Katakana Speed session id.");
  }
  if (!trialId) {
    throw new Error("Missing Katakana Speed trial id.");
  }

  return submitKatakanaSpeedSelfCheck({
    database: input.database ?? db,
    metricsJson: input.metricsJson,
    now: input.now,
    responseMs: input.responseMs,
    selfRating: input.selfRating,
    sessionId,
    trialId
  });
}

export async function aggregateKatakanaSpeedExerciseResultAction(input: {
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
}) {
  const sessionId = input.sessionId.trim();
  const exerciseId = input.exerciseId.trim();
  const resultId = input.resultId.trim();

  if (!sessionId) {
    throw new Error("Missing Katakana Speed session id.");
  }
  if (!exerciseId) {
    throw new Error("Missing Katakana Speed exercise id.");
  }
  if (!resultId) {
    throw new Error("Missing Katakana Speed result id.");
  }

  return aggregateKatakanaSpeedExerciseResult({
    blockId: input.blockId?.trim() || null,
    database: input.database ?? db,
    exerciseId,
    metricsJson: input.metricsJson,
    now: input.now,
    resultId,
    selfRating: input.selfRating,
    sessionId,
    sortOrder: input.sortOrder,
    trialId: input.trialId?.trim() || null
  });
}

export async function completeKatakanaSpeedSessionAction(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
}) {
  return completeKatakanaSpeedSession({
    database: input.database ?? db,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

export async function abandonKatakanaSpeedSessionAction(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
}) {
  return abandonKatakanaSpeedSession({
    database: input.database ?? db,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

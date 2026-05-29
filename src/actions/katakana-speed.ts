"use server";

import {
  aggregateKatakanaSpeedExerciseResult,
  abandonKatakanaSpeedSession,
  completeKatakanaSpeedSession,
  startKatakanaSpeedSession,
  submitKatakanaSpeedAnswer,
  submitKatakanaSpeedSelfCheck,
  type KatakanaSpeedSelfRating
} from "@/features/katakana-speed/server";

type StartKatakanaSpeedSessionActionInput = Parameters<
  typeof startKatakanaSpeedSession
>[0];
type SubmitKatakanaSpeedAnswerActionInput = Parameters<
  typeof submitKatakanaSpeedAnswer
>[0];
type SubmitKatakanaSpeedSelfCheckActionInput = Parameters<
  typeof submitKatakanaSpeedSelfCheck
>[0];
type AggregateKatakanaSpeedExerciseResultActionInput = Parameters<
  typeof aggregateKatakanaSpeedExerciseResult
>[0];
type CompleteKatakanaSpeedSessionActionInput = Parameters<
  typeof completeKatakanaSpeedSession
>[0];
type AbandonKatakanaSpeedSessionActionInput = Parameters<
  typeof abandonKatakanaSpeedSession
>[0];

export async function startKatakanaSpeedSessionAction(
  input: StartKatakanaSpeedSessionActionInput
) {
  return startKatakanaSpeedSession(input);
}

export async function submitKatakanaSpeedAnswerAction(
  input: SubmitKatakanaSpeedAnswerActionInput
) {
  const sessionId = input.sessionId.trim();
  const trialId = input.trialId.trim();

  if (!sessionId) {
    throw new Error("Missing Katakana Speed session id.");
  }
  if (!trialId) {
    throw new Error("Missing Katakana Speed trial id.");
  }

  return submitKatakanaSpeedAnswer({
    database: input.database,
    inputMethod: input.inputMethod,
    now: input.now,
    responseMs: input.responseMs,
    sessionId,
    trialId,
    userAnswer: input.userAnswer
  });
}

export async function submitKatakanaSpeedSelfCheckAction(
  input: SubmitKatakanaSpeedSelfCheckActionInput
) {
  const sessionId = input.sessionId.trim();
  const trialId = input.trialId.trim();

  if (!sessionId) {
    throw new Error("Missing Katakana Speed session id.");
  }
  if (!trialId) {
    throw new Error("Missing Katakana Speed trial id.");
  }

  return submitKatakanaSpeedSelfCheck({
    database: input.database,
    metricsJson: input.metricsJson,
    now: input.now,
    responseMs: input.responseMs,
    selfRating: input.selfRating,
    sessionId,
    trialId
  });
}

export async function aggregateKatakanaSpeedExerciseResultAction(input: {
  selfRating?: KatakanaSpeedSelfRating | null;
} & AggregateKatakanaSpeedExerciseResultActionInput) {
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
    database: input.database,
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

export async function completeKatakanaSpeedSessionAction(
  input: CompleteKatakanaSpeedSessionActionInput
) {
  return completeKatakanaSpeedSession({
    database: input.database,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

export async function abandonKatakanaSpeedSessionAction(
  input: AbandonKatakanaSpeedSessionActionInput
) {
  return abandonKatakanaSpeedSession({
    database: input.database,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

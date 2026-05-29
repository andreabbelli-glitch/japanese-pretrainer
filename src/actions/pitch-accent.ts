"use server";

import {
  abandonPitchAccentSession,
  completePitchAccentSession,
  startPitchAccentSession,
  submitPitchAccentAnswer
} from "@/features/pitch-accent/server";

type StartPitchAccentSessionActionInput = Parameters<
  typeof startPitchAccentSession
>[0];
type SubmitPitchAccentAnswerActionInput = Parameters<
  typeof submitPitchAccentAnswer
>[0];
type CompletePitchAccentSessionActionInput = Parameters<
  typeof completePitchAccentSession
>[0];
type AbandonPitchAccentSessionActionInput = Parameters<
  typeof abandonPitchAccentSession
>[0];

export async function startPitchAccentSessionAction(
  input: StartPitchAccentSessionActionInput = {}
) {
  return startPitchAccentSession(input);
}

export async function submitPitchAccentAnswerAction(
  input: SubmitPitchAccentAnswerActionInput
) {
  const sessionId = input.sessionId.trim();
  const trialId = input.trialId.trim();
  const chosenOptionId = input.chosenOptionId.trim();

  if (!sessionId) {
    throw new Error("Missing pitch accent session id.");
  }
  if (!trialId) {
    throw new Error("Missing pitch accent trial id.");
  }
  if (!chosenOptionId) {
    throw new Error("Missing pitch accent answer.");
  }

  return submitPitchAccentAnswer({
    chosenOptionId,
    database: input.database,
    inputMethod: input.inputMethod,
    now: input.now,
    responseMs: input.responseMs,
    sessionId,
    trialId
  });
}

export async function completePitchAccentSessionAction(
  input: CompletePitchAccentSessionActionInput
) {
  return completePitchAccentSession({
    database: input.database,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

export async function abandonPitchAccentSessionAction(
  input: AbandonPitchAccentSessionActionInput
) {
  return abandonPitchAccentSession({
    database: input.database,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

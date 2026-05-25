"use server";

import { db, type DatabaseClient } from "@/db";
import {
  abandonPitchAccentSession,
  completePitchAccentSession,
  startPitchAccentSession,
  submitPitchAccentAnswer,
  type PitchAccentPatternFilter
} from "@/features/pitch-accent/server";

export async function startPitchAccentSessionAction(input: {
  database?: DatabaseClient;
  filters?: Partial<PitchAccentPatternFilter>;
  now?: Date;
  seed?: string;
}) {
  return startPitchAccentSession({
    database: input.database ?? db,
    filters: input.filters,
    now: input.now,
    seed: input.seed
  });
}

export async function submitPitchAccentAnswerAction(input: {
  chosenOptionId: string;
  database?: DatabaseClient;
  inputMethod?: string | null;
  now?: Date;
  responseMs: number;
  sessionId: string;
  trialId: string;
}) {
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
    database: input.database ?? db,
    inputMethod: input.inputMethod,
    now: input.now,
    responseMs: input.responseMs,
    sessionId,
    trialId
  });
}

export async function completePitchAccentSessionAction(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
}) {
  return completePitchAccentSession({
    database: input.database ?? db,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

export async function abandonPitchAccentSessionAction(input: {
  database?: DatabaseClient;
  now?: Date;
  sessionId: string;
}) {
  return abandonPitchAccentSession({
    database: input.database ?? db,
    now: input.now,
    sessionId: input.sessionId.trim()
  });
}

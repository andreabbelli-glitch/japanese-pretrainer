import { randomUUID } from "node:crypto";

import { db, type DatabaseClient } from "@/db";
import {
  getPitchAccentSessionRow,
  insertPitchAccentSession,
  insertPitchAccentTrials
} from "@/db/queries";

import {
  normalizePitchAccentFilters,
  planPitchAccentSessionTrials,
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPairsCorpus,
  type PitchAccentPatternFilter
} from "../model";
import { loadPitchAccentMinimalPairsCorpus } from "./corpus";
import type { StartPitchAccentSessionResult } from "./contracts";
import { refreshPitchAccentSessionRollup } from "./rollups";

const DEFAULT_SESSION_COUNT = 20;

export async function startPitchAccentSession(
  input: {
    readonly corpus?: PitchAccentMinimalPairsCorpus;
    readonly count?: number;
    readonly database?: DatabaseClient;
    readonly filters?: Partial<PitchAccentPatternFilter>;
    readonly now?: Date;
    readonly seed?: string;
  } = {}
): Promise<StartPitchAccentSessionResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const sessionId = `pitch-accent-session-${input.seed ?? randomUUID()}`;
  const filters = normalizePitchAccentFilters(input.filters);
  const corpus = input.corpus ?? (await loadPitchAccentMinimalPairsCorpus());
  const validation = validatePitchAccentMinimalPairsCorpus(corpus);

  if (!validation.ok) {
    throw new Error(
      `Pitch accent corpus is invalid: ${validation.errors.join("; ")}`
    );
  }

  const trials = planPitchAccentSessionTrials({
    corpus,
    count: input.count ?? DEFAULT_SESSION_COUNT,
    filters,
    seed: input.seed ?? sessionId,
    sessionId
  });

  if (trials.length === 0) {
    throw new Error(
      "No pitch accent minimal pairs match the selected filters."
    );
  }

  await database.transaction(async (transaction) => {
    await insertPitchAccentSession(transaction, {
      correctAttempts: 0,
      createdAt: nowIso,
      filtersJson: JSON.stringify(filters),
      id: sessionId,
      patternStatsJson: "{}",
      startedAt: nowIso,
      status: "active",
      totalAttempts: 0,
      totalTrials: trials.length,
      updatedAt: nowIso
    });
    await insertPitchAccentTrials(
      transaction,
      trials.map((trial) => ({
        correctOptionId: trial.correctOptionId,
        correctPatternKey: trial.correctPatternKey,
        createdAt: nowIso,
        kana: trial.kana,
        optionsJson: JSON.stringify(trial.options),
        pairId: trial.pairId,
        sessionId,
        sortOrder: trial.sortOrder,
        status: "planned",
        trialId: trial.trialId
      }))
    );
  });

  return {
    sessionId,
    trials
  };
}

export async function completePitchAccentSession(input: {
  readonly database?: DatabaseClient;
  readonly now?: Date;
  readonly sessionId: string;
}) {
  await finalizePitchAccentSession({
    database: input.database,
    now: input.now,
    sessionId: input.sessionId,
    status: "completed"
  });
}

export async function abandonPitchAccentSession(input: {
  readonly database?: DatabaseClient;
  readonly now?: Date;
  readonly sessionId: string;
}) {
  await finalizePitchAccentSession({
    database: input.database,
    now: input.now,
    sessionId: input.sessionId,
    status: "abandoned"
  });
}

async function finalizePitchAccentSession(input: {
  readonly database?: DatabaseClient;
  readonly now?: Date;
  readonly sessionId: string;
  readonly status: "completed" | "abandoned";
}) {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const session = await getPitchAccentSessionRow(database, input.sessionId);

  if (!session) {
    throw new Error("Pitch accent session was not found.");
  }
  if (session.status !== "active") {
    return;
  }

  await refreshPitchAccentSessionRollup(database, {
    durationMs: Math.max(
      0,
      now.getTime() - new Date(session.startedAt).getTime()
    ),
    endedAt: now.toISOString(),
    expectedStatus: "active",
    sessionId: input.sessionId,
    status: input.status,
    updatedAt: now.toISOString()
  });
}

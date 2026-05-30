import { db, type DatabaseClient } from "@/db";
import {
  getPitchAccentSessionRow,
  listPitchAccentAttemptLogsBySession,
  listPitchAccentTrialRowsBySession,
  listRecentPitchAccentSessionRows
} from "@/db/queries";

import { loadPitchAccentMinimalPairsCorpus } from "./corpus";
import type {
  PitchAccentPageData,
  PitchAccentRecapPageData,
  PitchAccentSessionPageData
} from "./contracts";
import {
  mapPitchAccentAttemptRow,
  mapPitchAccentSessionSummary,
  mapPitchAccentTrialRow
} from "./mappers";
import { getAvailablePitchAccentMoraCounts } from "../model";

export async function getPitchAccentPageData(
  input: {
    readonly corpusPairCount?: number;
    readonly database?: DatabaseClient;
  } = {}
): Promise<PitchAccentPageData> {
  const database = input.database ?? db;
  const [recentSessions, corpus] = await Promise.all([
    listRecentPitchAccentSessionRows(database, 1),
    input.corpusPairCount === undefined
      ? loadPitchAccentMinimalPairsCorpus()
      : Promise.resolve(null)
  ]);

  return {
    availableMoraCounts: corpus
      ? getAvailablePitchAccentMoraCounts(corpus)
      : [],
    corpusPairCount: input.corpusPairCount ?? corpus?.pairs.length ?? 0,
    recentSession: recentSessions[0]
      ? mapPitchAccentSessionSummary(recentSessions[0])
      : null
  };
}

export async function getPitchAccentSessionPageData(input: {
  readonly database?: DatabaseClient;
  readonly sessionId: string;
}): Promise<PitchAccentSessionPageData | null> {
  const database = input.database ?? db;
  const session = await getPitchAccentSessionRow(database, input.sessionId);
  if (!session) {
    return null;
  }

  const trials = await listPitchAccentTrialRowsBySession(
    database,
    input.sessionId
  );

  return {
    answeredCount: trials.filter((trial) => trial.status === "answered").length,
    filters: mapPitchAccentSessionSummary(session).filters,
    sessionId: session.id,
    startedAt: session.startedAt,
    status: session.status,
    trials: trials.map(mapPitchAccentTrialRow)
  };
}

export async function getPitchAccentRecapPageData(input: {
  readonly database?: DatabaseClient;
  readonly sessionId: string;
}): Promise<PitchAccentRecapPageData | null> {
  const database = input.database ?? db;
  const session = await getPitchAccentSessionRow(database, input.sessionId);
  if (!session) {
    return null;
  }

  const attempts = await listPitchAccentAttemptLogsBySession(
    database,
    input.sessionId
  );

  return {
    attempts: attempts.map(mapPitchAccentAttemptRow),
    session: mapPitchAccentSessionSummary(session)
  };
}

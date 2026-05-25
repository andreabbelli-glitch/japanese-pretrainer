import { db, type DatabaseClient } from "@/db";
import {
  getPitchAccentSessionRow,
  listPitchAccentAttemptLogsBySession,
  listPitchAccentTrialRowsBySession,
  listRecentPitchAccentSessionRows
} from "@/db/queries";
import type { PitchAccentAudioPitchGraph } from "@/features/pitch-accent/model";

import {
  loadPitchAccentMinimalPairsCorpus,
  loadPitchAccentPitchGraphs
} from "./corpus";
import type {
  PitchAccentPageData,
  PitchAccentRecapPageData,
  PitchAccentSessionPageData,
  PitchAccentTrialSnapshot
} from "./contracts";
import {
  mapPitchAccentAttemptRow,
  mapPitchAccentSessionSummary,
  mapPitchAccentTrialRow
} from "./mappers";

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

  const [trials, pitchGraphsByAudioSrc] = await Promise.all([
    listPitchAccentTrialRowsBySession(database, input.sessionId),
    loadPitchAccentPitchGraphs()
  ]);
  const trialSnapshots = trials.map(mapPitchAccentTrialRow);

  return {
    answeredCount: trials.filter((trial) => trial.status === "answered").length,
    filters: mapPitchAccentSessionSummary(session).filters,
    pitchGraphsByAudioSrc: pickSessionPitchGraphs(
      trialSnapshots,
      pitchGraphsByAudioSrc
    ),
    sessionId: session.id,
    startedAt: session.startedAt,
    status: session.status,
    trials: trialSnapshots
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

function pickSessionPitchGraphs(
  trials: readonly PitchAccentTrialSnapshot[],
  pitchGraphsByAudioSrc: Readonly<Record<string, PitchAccentAudioPitchGraph>>
) {
  const graphs: Record<string, PitchAccentAudioPitchGraph> = {};

  for (const trial of trials) {
    for (const option of trial.options) {
      const graph = pitchGraphsByAudioSrc[option.audioSrc];

      if (graph) {
        graphs[option.audioSrc] = graph;
      }
    }
  }

  return graphs;
}

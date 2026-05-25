import { and, asc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  pitchAccentAttemptLog,
  pitchAccentSession,
  pitchAccentTrial
} from "../schema/pitch-accent.ts";

export type PitchAccentMutationClient =
  | Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0]
  | DatabaseClient;

export async function insertPitchAccentSession(
  database: PitchAccentMutationClient,
  input: typeof pitchAccentSession.$inferInsert
) {
  await database.insert(pitchAccentSession).values(input);
}

export async function insertPitchAccentTrials(
  database: PitchAccentMutationClient,
  input: (typeof pitchAccentTrial.$inferInsert)[]
) {
  if (input.length === 0) {
    return;
  }

  await database.insert(pitchAccentTrial).values(input);
}

export async function getPitchAccentSessionRow(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.pitchAccentSession.findFirst({
    where: eq(pitchAccentSession.id, sessionId)
  });
}

export async function getPitchAccentTrialRow(
  database: DatabaseQueryClient,
  input: {
    readonly sessionId: string;
    readonly trialId: string;
  }
) {
  return database.query.pitchAccentTrial.findFirst({
    where: (table, { and }) =>
      and(
        eq(table.sessionId, input.sessionId),
        eq(table.trialId, input.trialId)
      )
  });
}

export async function listPitchAccentTrialRowsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.pitchAccentTrial.findMany({
    orderBy: [asc(pitchAccentTrial.sortOrder)],
    where: eq(pitchAccentTrial.sessionId, sessionId)
  });
}

export async function getPitchAccentAttemptLogByTrialId(
  database: DatabaseQueryClient,
  trialId: string
) {
  return database.query.pitchAccentAttemptLog.findFirst({
    where: eq(pitchAccentAttemptLog.trialId, trialId)
  });
}

export async function insertPitchAccentAttemptLogIfAbsent(
  database: PitchAccentMutationClient,
  input: typeof pitchAccentAttemptLog.$inferInsert
) {
  const [insertedRow] = await database
    .insert(pitchAccentAttemptLog)
    .values(input)
    .onConflictDoNothing({
      target: pitchAccentAttemptLog.trialId
    })
    .returning({
      id: pitchAccentAttemptLog.id
    });

  return Boolean(insertedRow);
}

export async function updatePitchAccentTrialAnswered(
  database: PitchAccentMutationClient,
  input: {
    readonly answeredAt: string;
    readonly trialId: string;
  }
) {
  await database
    .update(pitchAccentTrial)
    .set({
      answeredAt: input.answeredAt,
      status: "answered"
    })
    .where(eq(pitchAccentTrial.trialId, input.trialId));
}

export async function updatePitchAccentSessionRollup(
  database: PitchAccentMutationClient,
  input: {
    readonly correctAttempts: number;
    readonly durationMs?: number | null;
    readonly endedAt?: string | null;
    readonly id: string;
    readonly patternStatsJson: string;
    readonly expectedStatus?: "active" | "completed" | "abandoned";
    readonly status?: "active" | "completed" | "abandoned";
    readonly totalAttempts: number;
    readonly updatedAt: string;
  }
) {
  const whereClause = input.expectedStatus
    ? and(
        eq(pitchAccentSession.id, input.id),
        eq(pitchAccentSession.status, input.expectedStatus)
      )
    : eq(pitchAccentSession.id, input.id);
  const [updatedRow] = await database
    .update(pitchAccentSession)
    .set({
      correctAttempts: input.correctAttempts,
      durationMs: input.durationMs,
      endedAt: input.endedAt,
      patternStatsJson: input.patternStatsJson,
      status: input.status ?? "active",
      totalAttempts: input.totalAttempts,
      updatedAt: input.updatedAt
    })
    .where(whereClause)
    .returning({
      id: pitchAccentSession.id
    });

  return Boolean(updatedRow);
}

export async function listPitchAccentAttemptLogsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.pitchAccentAttemptLog.findMany({
    orderBy: [asc(pitchAccentAttemptLog.sortOrder)],
    where: eq(pitchAccentAttemptLog.sessionId, sessionId)
  });
}

export async function listPitchAccentAttemptLogsBySessions(
  database: DatabaseQueryClient,
  sessionIds: readonly string[]
) {
  if (sessionIds.length === 0) {
    return [];
  }

  return database.query.pitchAccentAttemptLog.findMany({
    where: inArray(pitchAccentAttemptLog.sessionId, sessionIds)
  });
}

export async function listRecentPitchAccentSessionRows(
  database: DatabaseQueryClient,
  limit = 5
) {
  return database.query.pitchAccentSession.findMany({
    limit,
    orderBy: (table, { desc }) => [desc(table.startedAt)]
  });
}

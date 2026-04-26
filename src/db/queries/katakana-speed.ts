import { and, asc, eq } from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  katakanaAttemptLog,
  katakanaConfusionEdge,
  katakanaExerciseBlock,
  katakanaExerciseResult,
  katakanaItemState,
  katakanaSession,
  katakanaTrial
} from "../schema/katakana-speed.ts";

export type KatakanaSpeedMutationClient =
  | Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0]
  | DatabaseClient;

export async function listKatakanaItemStateRows(database: DatabaseQueryClient) {
  return database.query.katakanaItemState.findMany();
}

export async function getKatakanaSessionRow(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.katakanaSession.findFirst({
    where: eq(katakanaSession.id, sessionId)
  });
}

export async function getKatakanaTrialRow(
  database: DatabaseQueryClient,
  input: {
    sessionId: string;
    trialId: string;
  }
) {
  return database.query.katakanaTrial.findFirst({
    where: and(
      eq(katakanaTrial.sessionId, input.sessionId),
      eq(katakanaTrial.trialId, input.trialId)
    )
  });
}

export async function listKatakanaTrialRowsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.katakanaTrial.findMany({
    orderBy: [asc(katakanaTrial.sortOrder)],
    where: eq(katakanaTrial.sessionId, sessionId)
  });
}

export async function listKatakanaTrialRowsByBlock(
  database: DatabaseQueryClient,
  blockId: string
) {
  return database.query.katakanaTrial.findMany({
    orderBy: [asc(katakanaTrial.sortOrder)],
    where: eq(katakanaTrial.blockId, blockId)
  });
}

export async function getKatakanaAttemptLogByTrialId(
  database: DatabaseQueryClient,
  trialId: string
) {
  return database.query.katakanaAttemptLog.findFirst({
    where: eq(katakanaAttemptLog.trialId, trialId)
  });
}

export async function insertKatakanaSession(
  database: KatakanaSpeedMutationClient,
  input: typeof katakanaSession.$inferInsert
) {
  await database.insert(katakanaSession).values(input);
}

export async function insertKatakanaTrials(
  database: KatakanaSpeedMutationClient,
  input: (typeof katakanaTrial.$inferInsert)[]
) {
  if (input.length === 0) {
    return;
  }

  await database.insert(katakanaTrial).values(input);
}

export async function insertKatakanaAttemptLogIfAbsent(
  database: KatakanaSpeedMutationClient,
  input: typeof katakanaAttemptLog.$inferInsert
) {
  const [insertedRow] = await database
    .insert(katakanaAttemptLog)
    .values(input)
    .onConflictDoNothing({
      target: katakanaAttemptLog.trialId
    })
    .returning({
      id: katakanaAttemptLog.id
    });

  return Boolean(insertedRow);
}

export async function insertKatakanaExerciseBlocks(
  database: KatakanaSpeedMutationClient,
  input: (typeof katakanaExerciseBlock.$inferInsert)[]
) {
  if (input.length === 0) {
    return;
  }

  await database.insert(katakanaExerciseBlock).values(input);
}

export async function listKatakanaExerciseBlockRowsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.katakanaExerciseBlock.findMany({
    orderBy: [asc(katakanaExerciseBlock.sortOrder)],
    where: eq(katakanaExerciseBlock.sessionId, sessionId)
  });
}

export async function getKatakanaExerciseBlockRow(
  database: DatabaseQueryClient,
  blockId: string
) {
  return database.query.katakanaExerciseBlock.findFirst({
    where: eq(katakanaExerciseBlock.blockId, blockId)
  });
}

export async function listKatakanaExerciseBlockRowsByExercise(
  database: DatabaseQueryClient,
  exerciseId: string
) {
  return database.query.katakanaExerciseBlock.findMany({
    orderBy: [asc(katakanaExerciseBlock.sortOrder)],
    where: eq(katakanaExerciseBlock.exerciseId, exerciseId)
  });
}

export async function insertKatakanaExerciseResults(
  database: KatakanaSpeedMutationClient,
  input: (typeof katakanaExerciseResult.$inferInsert)[]
) {
  if (input.length === 0) {
    return;
  }

  await database.insert(katakanaExerciseResult).values(input);
}

export async function getKatakanaExerciseResultRow(
  database: DatabaseQueryClient,
  resultId: string
) {
  return database.query.katakanaExerciseResult.findFirst({
    where: eq(katakanaExerciseResult.resultId, resultId)
  });
}

export async function insertKatakanaExerciseResultIfAbsent(
  database: KatakanaSpeedMutationClient,
  input: typeof katakanaExerciseResult.$inferInsert
) {
  const [insertedRow] = await database
    .insert(katakanaExerciseResult)
    .values(input)
    .onConflictDoNothing({
      target: katakanaExerciseResult.resultId
    })
    .returning({
      resultId: katakanaExerciseResult.resultId
    });

  return Boolean(insertedRow);
}

export async function listKatakanaExerciseResultRowsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.katakanaExerciseResult.findMany({
    orderBy: [asc(katakanaExerciseResult.sortOrder)],
    where: eq(katakanaExerciseResult.sessionId, sessionId)
  });
}

export async function listKatakanaExerciseResultRowsByExercise(
  database: DatabaseQueryClient,
  exerciseId: string
) {
  return database.query.katakanaExerciseResult.findMany({
    orderBy: [asc(katakanaExerciseResult.sortOrder)],
    where: eq(katakanaExerciseResult.exerciseId, exerciseId)
  });
}

export async function insertKatakanaConfusionEdges(
  database: KatakanaSpeedMutationClient,
  input: (typeof katakanaConfusionEdge.$inferInsert)[]
) {
  if (input.length === 0) {
    return;
  }

  await database.insert(katakanaConfusionEdge).values(input);
}

export async function insertKatakanaConfusionEdgeIfAbsent(
  database: KatakanaSpeedMutationClient,
  input: typeof katakanaConfusionEdge.$inferInsert
) {
  const [insertedRow] = await database
    .insert(katakanaConfusionEdge)
    .values(input)
    .onConflictDoNothing({
      target: katakanaConfusionEdge.edgeId
    })
    .returning({
      edgeId: katakanaConfusionEdge.edgeId
    });

  return Boolean(insertedRow);
}

export async function listKatakanaConfusionEdgeRowsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.katakanaConfusionEdge.findMany({
    orderBy: [asc(katakanaConfusionEdge.sortOrder)],
    where: eq(katakanaConfusionEdge.sessionId, sessionId)
  });
}

export async function listKatakanaConfusionEdgeRowsByExercise(
  database: DatabaseQueryClient,
  exerciseId: string
) {
  return database.query.katakanaConfusionEdge.findMany({
    orderBy: [asc(katakanaConfusionEdge.sortOrder)],
    where: eq(katakanaConfusionEdge.exerciseId, exerciseId)
  });
}

export async function upsertKatakanaItemState(
  database: KatakanaSpeedMutationClient,
  input: typeof katakanaItemState.$inferInsert
) {
  await database
    .insert(katakanaItemState)
    .values(input)
    .onConflictDoUpdate({
      target: katakanaItemState.itemId,
      set: {
        bestRtMs: input.bestRtMs ?? null,
        correctCount: input.correctCount ?? 0,
        correctStreak: input.correctStreak ?? 0,
        lapses: input.lapses ?? 0,
        lastAttemptAt: input.lastAttemptAt ?? null,
        lastCorrectAt: input.lastCorrectAt ?? null,
        lastErrorTagsJson: input.lastErrorTagsJson ?? "[]",
        lastResponseMs: input.lastResponseMs ?? null,
        recentResponseMsJson: input.recentResponseMsJson ?? "[]",
        reps: input.reps ?? 0,
        seenCount: input.seenCount ?? 0,
        slowCorrectCount: input.slowCorrectCount ?? 0,
        slowStreak: input.slowStreak ?? 0,
        status: input.status,
        updatedAt: input.updatedAt,
        wrongCount: input.wrongCount ?? 0
      }
    });
}

export async function updateKatakanaTrialAnswered(
  database: KatakanaSpeedMutationClient,
  input: {
    answeredAt: string;
    metricsJson?: string;
    selfRating?: string;
    trialId: string;
  }
) {
  await database
    .update(katakanaTrial)
    .set({
      answeredAt: input.answeredAt,
      metricsJson: input.metricsJson,
      selfRating: input.selfRating,
      status: "answered"
    })
    .where(eq(katakanaTrial.trialId, input.trialId));
}

export async function updateKatakanaTrialsAnsweredByBlock(
  database: KatakanaSpeedMutationClient,
  input: {
    answeredAt: string;
    blockId: string;
    metricsJson?: string;
    selfRating?: string | null;
  }
) {
  await database
    .update(katakanaTrial)
    .set({
      answeredAt: input.answeredAt,
      metricsJson: input.metricsJson,
      selfRating: input.selfRating ?? undefined,
      status: "answered"
    })
    .where(eq(katakanaTrial.blockId, input.blockId));
}

export async function updateKatakanaSessionRollup(
  database: KatakanaSpeedMutationClient,
  input: {
    correctAttempts: number;
    durationMs?: number | null;
    endedAt?: string | null;
    id: string;
    mainConfusionsJson: string;
    mainErrorTagsJson: string;
    medianRtMs: number | null;
    p90RtMs: number | null;
    recommendedFocusJson: string;
    slowCorrectCount: number;
    status?: "active" | "completed" | "abandoned";
    totalAttempts: number;
    updatedAt: string;
  }
) {
  await database
    .update(katakanaSession)
    .set({
      correctAttempts: input.correctAttempts,
      durationMs: input.durationMs,
      endedAt: input.endedAt,
      mainConfusionsJson: input.mainConfusionsJson,
      mainErrorTagsJson: input.mainErrorTagsJson,
      medianRtMs: input.medianRtMs,
      p90RtMs: input.p90RtMs,
      recommendedFocusJson: input.recommendedFocusJson,
      slowCorrectCount: input.slowCorrectCount,
      status: input.status ?? "active",
      totalAttempts: input.totalAttempts,
      updatedAt: input.updatedAt
    })
    .where(eq(katakanaSession.id, input.id));
}

export async function listKatakanaAttemptLogsBySession(
  database: DatabaseQueryClient,
  sessionId: string
) {
  return database.query.katakanaAttemptLog.findMany({
    where: eq(katakanaAttemptLog.sessionId, sessionId)
  });
}

export async function listRecentKatakanaSessionRows(
  database: DatabaseQueryClient,
  limit = 5
) {
  return database.query.katakanaSession.findMany({
    limit,
    orderBy: (table, { desc }) => [desc(table.startedAt)]
  });
}

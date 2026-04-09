import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql
} from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  kanjiClashPairLog,
  kanjiClashPairState
} from "../schema/kanji-clash.ts";
import type { KanjiClashPairState } from "../../lib/kanji-clash/types.ts";
import { quoteSqlString } from "./review-query-helpers.ts";

const KANJI_CLASH_PAIR_STATE_QUERY_CHUNK_SIZE = 400;
export type KanjiClashPairStateMutationClient = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export async function getKanjiClashPairStateByPairKey(
  database: DatabaseQueryClient,
  pairKey: string
): Promise<KanjiClashPairState | null> {
  const row = await database.query.kanjiClashPairState.findFirst({
    where: eq(kanjiClashPairState.pairKey, pairKey)
  });

  return row ? mapKanjiClashPairStateRow(row) : null;
}

export async function listKanjiClashPairStatesByPairKeys(
  database: DatabaseQueryClient,
  pairKeys: string[]
): Promise<Map<string, KanjiClashPairState>> {
  const normalizedPairKeys = dedupeStable(
    pairKeys.filter((pairKey) => pairKey.length > 0)
  );

  if (normalizedPairKeys.length === 0) {
    return new Map<string, KanjiClashPairState>();
  }

  const pairStates = new Map<string, KanjiClashPairState>();

  for (
    let start = 0;
    start < normalizedPairKeys.length;
    start += KANJI_CLASH_PAIR_STATE_QUERY_CHUNK_SIZE
  ) {
    const chunk = normalizedPairKeys.slice(
      start,
      start + KANJI_CLASH_PAIR_STATE_QUERY_CHUNK_SIZE
    );
    const rows = await database.query.kanjiClashPairState.findMany({
      where: inArray(kanjiClashPairState.pairKey, chunk)
    });

    for (const row of rows) {
      pairStates.set(row.pairKey, mapKanjiClashPairStateRow(row));
    }
  }

  return pairStates;
}

export async function listKanjiClashPairStatesBySubjectKeys(
  database: DatabaseQueryClient,
  subjectKeys: string[]
): Promise<Map<string, KanjiClashPairState>> {
  const normalizedSubjectKeys = dedupeStable(
    subjectKeys.filter((subjectKey) => subjectKey.length > 0)
  );

  if (normalizedSubjectKeys.length === 0) {
    return new Map<string, KanjiClashPairState>();
  }

  const subjectKeyValuesSql = normalizedSubjectKeys
    .map((subjectKey) => `(${quoteSqlString(subjectKey)})`)
    .join(", ");
  const rows = await database.all<typeof kanjiClashPairState.$inferSelect>(`
    WITH eligible_subject_keys(subject_key) AS (
      VALUES ${subjectKeyValuesSql}
    )
    SELECT
      ps.pair_key AS pairKey,
      ps.left_subject_key AS leftSubjectKey,
      ps.right_subject_key AS rightSubjectKey,
      ps.state AS state,
      ps.stability AS stability,
      ps.difficulty AS difficulty,
      ps.due_at AS dueAt,
      ps.last_reviewed_at AS lastReviewedAt,
      ps.last_interaction_at AS lastInteractionAt,
      ps.scheduled_days AS scheduledDays,
      ps.learning_steps AS learningSteps,
      ps.lapses AS lapses,
      ps.reps AS reps,
      ps.scheduler_version AS schedulerVersion,
      ps.created_at AS createdAt,
      ps.updated_at AS updatedAt
    FROM kanji_clash_pair_state ps
    INNER JOIN eligible_subject_keys left_keys
      ON left_keys.subject_key = ps.left_subject_key
    INNER JOIN eligible_subject_keys right_keys
      ON right_keys.subject_key = ps.right_subject_key
    ORDER BY ps.pair_key ASC
  `);

  return new Map(
    rows.map((row) => [row.pairKey, mapKanjiClashPairStateRow(row)])
  );
}

export async function listKanjiClashDuePairStates(
  database: DatabaseQueryClient,
  input: {
    limit?: number;
    now: string;
    offset?: number;
  }
): Promise<KanjiClashPairState[]> {
  const rows = await database.query.kanjiClashPairState.findMany({
    where: and(
      ne(kanjiClashPairState.state, "new"),
      or(
        isNull(kanjiClashPairState.dueAt),
        lte(kanjiClashPairState.dueAt, input.now)
      )
    ),
    orderBy: [asc(kanjiClashPairState.dueAt), asc(kanjiClashPairState.pairKey)],
    limit: input.limit,
    offset: input.offset
  });

  return rows.map(mapKanjiClashPairStateRow);
}

export async function getKanjiClashPairStateByPairKeyAndUpdatedAt(
  database: DatabaseQueryClient,
  input: {
    pairKey: string;
    updatedAt: string;
  }
): Promise<KanjiClashPairState | null> {
  const row = await database.query.kanjiClashPairState.findFirst({
    where: and(
      eq(kanjiClashPairState.pairKey, input.pairKey),
      eq(kanjiClashPairState.updatedAt, input.updatedAt)
    )
  });

  return row ? mapKanjiClashPairStateRow(row) : null;
}

export async function updateKanjiClashPairStateIfCurrent(
  database: KanjiClashPairStateMutationClient,
  input: {
    expectedUpdatedAt: string;
    nextState: KanjiClashPairState;
  }
) {
  const [updatedRow] = await database
    .update(kanjiClashPairState)
    .set(getKanjiClashPairStateUpdateValues(input.nextState))
    .where(
      and(
        eq(kanjiClashPairState.pairKey, input.nextState.pairKey),
        eq(kanjiClashPairState.updatedAt, input.expectedUpdatedAt)
      )
    )
    .returning({
      pairKey: kanjiClashPairState.pairKey
    });

  return Boolean(updatedRow);
}

export async function insertKanjiClashPairStateIfAbsent(
  database: KanjiClashPairStateMutationClient,
  input: {
    createdAt: string;
    nextState: KanjiClashPairState;
  }
) {
  const [insertedRow] = await database
    .insert(kanjiClashPairState)
    .values({
      ...input.nextState,
      createdAt: input.createdAt
    })
    .onConflictDoNothing({
      target: kanjiClashPairState.pairKey
    })
    .returning({
      pairKey: kanjiClashPairState.pairKey
    });

  return Boolean(insertedRow);
}

export async function createKanjiClashPairLog(
  database: KanjiClashPairStateMutationClient,
  input: typeof kanjiClashPairLog.$inferInsert
) {
  await database.insert(kanjiClashPairLog).values(input);
}

export async function countKanjiClashAutomaticNewPairIntroductions(input: {
  database: DatabaseQueryClient;
  endAt: string;
  startAt: string;
}) {
  const [row] = await input.database
    .select({
      count: sql<number>`count(distinct ${kanjiClashPairLog.pairKey})`
    })
    .from(kanjiClashPairLog)
    .where(
      and(
        eq(kanjiClashPairLog.mode, "automatic"),
        eq(kanjiClashPairLog.previousState, "new"),
        gte(kanjiClashPairLog.answeredAt, input.startAt),
        lt(kanjiClashPairLog.answeredAt, input.endAt)
      )
    );

  return Number(row?.count ?? 0);
}

function mapKanjiClashPairStateRow(
  row: typeof kanjiClashPairState.$inferSelect
): KanjiClashPairState {
  return {
    createdAt: row.createdAt,
    difficulty: row.difficulty ?? null,
    dueAt: row.dueAt ?? null,
    lapses: row.lapses,
    lastInteractionAt: row.lastInteractionAt,
    lastReviewedAt: row.lastReviewedAt ?? null,
    learningSteps: row.learningSteps,
    leftSubjectKey: row.leftSubjectKey,
    pairKey: row.pairKey,
    reps: row.reps,
    rightSubjectKey: row.rightSubjectKey,
    scheduledDays: row.scheduledDays,
    schedulerVersion: row.schedulerVersion,
    stability: row.stability ?? null,
    state: row.state,
    updatedAt: row.updatedAt
  };
}

function getKanjiClashPairStateUpdateValues(nextState: KanjiClashPairState) {
  return {
    difficulty: nextState.difficulty,
    dueAt: nextState.dueAt,
    lapses: nextState.lapses,
    lastInteractionAt: nextState.lastInteractionAt,
    lastReviewedAt: nextState.lastReviewedAt,
    learningSteps: nextState.learningSteps,
    leftSubjectKey: nextState.leftSubjectKey,
    reps: nextState.reps,
    rightSubjectKey: nextState.rightSubjectKey,
    scheduledDays: nextState.scheduledDays,
    schedulerVersion: nextState.schedulerVersion,
    stability: nextState.stability,
    state: nextState.state,
    updatedAt: nextState.updatedAt
  };
}

function dedupeStable(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

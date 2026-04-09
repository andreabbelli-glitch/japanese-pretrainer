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

import type { DatabaseQueryClient } from "../client.ts";
import {
  kanjiClashPairLog,
  kanjiClashPairState
} from "../schema/kanji-clash.ts";
import type { KanjiClashPairState } from "../../lib/kanji-clash/types.ts";

const KANJI_CLASH_PAIR_STATE_QUERY_CHUNK_SIZE = 400;

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

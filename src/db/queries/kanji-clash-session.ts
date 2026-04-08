import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import type { DatabaseQueryClient } from "../client.ts";
import {
  kanjiClashPairLog,
  kanjiClashPairState
} from "../schema/kanji-clash.ts";
import type { KanjiClashPairState } from "../../lib/kanji-clash/types.ts";

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
) {
  const normalizedPairKeys = dedupeStable(
    pairKeys.filter((pairKey) => pairKey.length > 0)
  );

  if (normalizedPairKeys.length === 0) {
    return new Map<string, KanjiClashPairState>();
  }

  const rows = await database.query.kanjiClashPairState.findMany({
    where: inArray(kanjiClashPairState.pairKey, normalizedPairKeys)
  });

  return new Map(
    rows.map((row) => [row.pairKey, mapKanjiClashPairStateRow(row)] as const)
  );
}

export async function countKanjiClashAutomaticNewPairIntroductions(input: {
  database: DatabaseQueryClient;
  endAt: string;
  pairKeys: string[];
  startAt: string;
}) {
  const normalizedPairKeys = dedupeStable(
    input.pairKeys.filter((pairKey) => pairKey.length > 0)
  );

  if (normalizedPairKeys.length === 0) {
    return 0;
  }

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
        lt(kanjiClashPairLog.answeredAt, input.endAt),
        inArray(kanjiClashPairLog.pairKey, normalizedPairKeys)
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

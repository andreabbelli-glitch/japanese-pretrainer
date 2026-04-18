import {
  and,
  eq,
  inArray
} from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundLog,
  kanjiClashManualContrastRoundState
} from "../schema/kanji-clash.ts";

const MANUAL_CONTRAST_QUERY_CHUNK_SIZE = 400;

export type KanjiClashManualContrastRoundStateMutationClient = Pick<
  DatabaseClient,
  "insert" | "update"
>;

export async function getKanjiClashManualContrastByContrastKey(
  database: DatabaseQueryClient,
  contrastKey: string
) {
  return database.query.kanjiClashManualContrast.findFirst({
    where: eq(kanjiClashManualContrast.contrastKey, contrastKey)
  });
}

export async function listKanjiClashManualContrastsByContrastKeys(
  database: DatabaseQueryClient,
  contrastKeys: string[]
) {
  const normalizedContrastKeys = dedupeStable(
    contrastKeys.filter((contrastKey) => contrastKey.length > 0)
  );

  if (normalizedContrastKeys.length === 0) {
    return new Map<string, typeof kanjiClashManualContrast.$inferSelect>();
  }

  const contrasts = new Map<string, typeof kanjiClashManualContrast.$inferSelect>();

  for (
    let start = 0;
    start < normalizedContrastKeys.length;
    start += MANUAL_CONTRAST_QUERY_CHUNK_SIZE
  ) {
    const chunk = normalizedContrastKeys.slice(
      start,
      start + MANUAL_CONTRAST_QUERY_CHUNK_SIZE
    );
    const rows = await database.query.kanjiClashManualContrast.findMany({
      where: inArray(kanjiClashManualContrast.contrastKey, chunk)
    });

    for (const row of rows) {
      contrasts.set(row.contrastKey, row);
    }
  }

  return contrasts;
}

export async function getKanjiClashManualContrastRoundStateByRoundKey(
  database: DatabaseQueryClient,
  roundKey: string
) {
  return database.query.kanjiClashManualContrastRoundState.findFirst({
    where: eq(kanjiClashManualContrastRoundState.roundKey, roundKey)
  });
}

export async function listKanjiClashManualContrastRoundStatesByRoundKeys(
  database: DatabaseQueryClient,
  roundKeys: string[]
) {
  const normalizedRoundKeys = dedupeStable(
    roundKeys.filter((roundKey) => roundKey.length > 0)
  );

  if (normalizedRoundKeys.length === 0) {
    return new Map<string, typeof kanjiClashManualContrastRoundState.$inferSelect>();
  }

  const roundStates = new Map<
    string,
    typeof kanjiClashManualContrastRoundState.$inferSelect
  >();

  for (
    let start = 0;
    start < normalizedRoundKeys.length;
    start += MANUAL_CONTRAST_QUERY_CHUNK_SIZE
  ) {
    const chunk = normalizedRoundKeys.slice(
      start,
      start + MANUAL_CONTRAST_QUERY_CHUNK_SIZE
    );
    const rows = await database.query.kanjiClashManualContrastRoundState.findMany(
      {
        where: inArray(kanjiClashManualContrastRoundState.roundKey, chunk)
      }
    );

    for (const row of rows) {
      roundStates.set(row.roundKey, row);
    }
  }

  return roundStates;
}

export async function updateKanjiClashManualContrastRoundStateIfCurrent(
  database: KanjiClashManualContrastRoundStateMutationClient,
  input: {
    expectedUpdatedAt: string;
    nextState: typeof kanjiClashManualContrastRoundState.$inferInsert;
  }
) {
  const [updatedRow] = await database
    .update(kanjiClashManualContrastRoundState)
    .set(input.nextState)
    .where(
      and(
        eq(
          kanjiClashManualContrastRoundState.roundKey,
          input.nextState.roundKey
        ),
        eq(
          kanjiClashManualContrastRoundState.updatedAt,
          input.expectedUpdatedAt
        )
      )
    )
    .returning({
      roundKey: kanjiClashManualContrastRoundState.roundKey
    });

  return Boolean(updatedRow);
}

export async function insertKanjiClashManualContrastRoundStateIfAbsent(
  database: KanjiClashManualContrastRoundStateMutationClient,
  input: {
    createdAt: string;
    nextState: typeof kanjiClashManualContrastRoundState.$inferInsert;
  }
) {
  const [insertedRow] = await database
    .insert(kanjiClashManualContrastRoundState)
    .values({
      ...input.nextState,
      createdAt: input.createdAt
    })
    .onConflictDoNothing({
      target: kanjiClashManualContrastRoundState.roundKey
    })
    .returning({
      roundKey: kanjiClashManualContrastRoundState.roundKey
    });

  return Boolean(insertedRow);
}

export async function createKanjiClashManualContrastRoundLog(
  database: KanjiClashManualContrastRoundStateMutationClient,
  input: typeof kanjiClashManualContrastRoundLog.$inferInsert
) {
  await database.insert(kanjiClashManualContrastRoundLog).values(input);
}

function dedupeStable<T>(values: T[]) {
  const seen = new Set<T>();
  const result: T[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

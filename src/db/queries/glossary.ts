import { and, asc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  entryStatus,
  type EntryType,
  grammarPattern,
  term
} from "../schema/index.ts";

async function getEntryStatusMap(
  database: DatabaseClient,
  entryType: EntryType,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return new Map<string, typeof entryStatus.$inferSelect>();
  }

  const rows = await database.query.entryStatus.findMany({
    where: and(
      eq(entryStatus.entryType, entryType),
      inArray(entryStatus.entryId, entryIds)
    )
  });

  return new Map(rows.map((row) => [row.entryId, row]));
}

export async function listTermEntriesByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  const rows = await database.query.term.findMany({
    where: eq(term.mediaId, mediaId),
    with: {
      aliases: true,
      segment: true
    },
    orderBy: [asc(term.lemma), asc(term.reading)]
  });

  const statusMap = await getEntryStatusMap(
    database,
    "term",
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    ...row,
    status: statusMap.get(row.id) ?? null
  }));
}

export async function listGrammarEntriesByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  const rows = await database.query.grammarPattern.findMany({
    where: eq(grammarPattern.mediaId, mediaId),
    with: {
      aliases: true,
      segment: true
    },
    orderBy: [asc(grammarPattern.pattern), asc(grammarPattern.title)]
  });

  const statusMap = await getEntryStatusMap(
    database,
    "grammar",
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    ...row,
    status: statusMap.get(row.id) ?? null
  }));
}

export type TermGlossaryEntry = Awaited<
  ReturnType<typeof listTermEntriesByMediaId>
>[number];
export type GrammarGlossaryEntry = Awaited<
  ReturnType<typeof listGrammarEntriesByMediaId>
>[number];

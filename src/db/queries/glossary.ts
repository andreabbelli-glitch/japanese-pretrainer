import { and, asc, eq, inArray, or } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  entryStatus,
  grammarPattern,
  lesson,
  reviewState,
  segment,
  type EntryType,
  term
} from "../schema/index.ts";

export type GlossaryEntryRef = {
  entryId: string;
  entryType: EntryType;
};

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

export async function listGlossarySegmentsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.segment.findMany({
    where: eq(segment.mediaId, mediaId),
    orderBy: [asc(segment.orderIndex), asc(segment.title)]
  });
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

export async function getTermEntriesByIds(
  database: DatabaseClient,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return [];
  }

  const rows = await database.query.term.findMany({
    where: inArray(term.id, entryIds),
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

export async function getGrammarEntriesByIds(
  database: DatabaseClient,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return [];
  }

  const rows = await database.query.grammarPattern.findMany({
    where: inArray(grammarPattern.id, entryIds),
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

export async function getTermEntryById(
  database: DatabaseClient,
  entryId: string
) {
  const [entry] = await getTermEntriesByIds(database, [entryId]);

  return entry ?? null;
}

export async function getGrammarEntryById(
  database: DatabaseClient,
  entryId: string
) {
  const [entry] = await getGrammarEntriesByIds(database, [entryId]);

  return entry ?? null;
}

export async function listEntryLessonConnections(
  database: DatabaseClient,
  entries: GlossaryEntryRef[]
) {
  if (entries.length === 0) {
    return [];
  }

  return database
    .select({
      entryType: entryLink.entryType,
      entryId: entryLink.entryId,
      linkRole: entryLink.linkRole,
      sortOrder: entryLink.sortOrder,
      lessonId: lesson.id,
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      lessonSummary: lesson.summary,
      lessonOrderIndex: lesson.orderIndex,
      segmentId: segment.id,
      segmentTitle: segment.title
    })
    .from(entryLink)
    .innerJoin(
      lesson,
      and(eq(entryLink.sourceType, "lesson"), eq(entryLink.sourceId, lesson.id))
    )
    .leftJoin(segment, eq(segment.id, lesson.segmentId))
    .where(
      and(
        eq(lesson.status, "active"),
        or(
          ...entries.map((entry) =>
            and(
              eq(entryLink.entryType, entry.entryType),
              eq(entryLink.entryId, entry.entryId)
            )
          )
        )
      )
    )
    .orderBy(
      asc(lesson.orderIndex),
      asc(entryLink.sortOrder),
      asc(entryLink.linkRole),
      asc(lesson.slug)
    );
}

export async function listEntryCardConnections(
  database: DatabaseClient,
  entries: GlossaryEntryRef[]
) {
  if (entries.length === 0) {
    return [];
  }

  return database
    .select({
      entryType: cardEntryLink.entryType,
      entryId: cardEntryLink.entryId,
      relationshipType: cardEntryLink.relationshipType,
      cardId: card.id,
      cardType: card.cardType,
      cardFront: card.front,
      cardBack: card.back,
      cardNotesIt: card.notesIt,
      cardOrderIndex: card.orderIndex,
      segmentId: segment.id,
      segmentTitle: segment.title,
      reviewState: reviewState.state,
      dueAt: reviewState.dueAt,
      manualOverride: reviewState.manualOverride
    })
    .from(cardEntryLink)
    .innerJoin(card, eq(card.id, cardEntryLink.cardId))
    .leftJoin(segment, eq(segment.id, card.segmentId))
    .leftJoin(reviewState, eq(reviewState.cardId, card.id))
    .where(
      and(
        eq(card.status, "active"),
        or(
          ...entries.map((entry) =>
            and(
              eq(cardEntryLink.entryType, entry.entryType),
              eq(cardEntryLink.entryId, entry.entryId)
            )
          )
        )
      )
    )
    .orderBy(asc(card.orderIndex), asc(card.createdAt), asc(card.id));
}

export type GlossarySegment = Awaited<
  ReturnType<typeof listGlossarySegmentsByMediaId>
>[number];
export type TermGlossaryEntry = Awaited<
  ReturnType<typeof listTermEntriesByMediaId>
>[number];
export type GrammarGlossaryEntry = Awaited<
  ReturnType<typeof listGrammarEntriesByMediaId>
>[number];
export type EntryLessonConnection = Awaited<
  ReturnType<typeof listEntryLessonConnections>
>[number];
export type EntryCardConnection = Awaited<
  ReturnType<typeof listEntryCardConnections>
>[number];

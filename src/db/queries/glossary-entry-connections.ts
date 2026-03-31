import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  grammarPattern,
  lesson,
  reviewSubjectState,
  segment,
  term,
  type EntryType
} from "../schema/index.ts";

export type GlossaryEntryRef = {
  entryId: string;
  entryType: EntryType;
};

function splitGlossaryEntryRefs(entries: GlossaryEntryRef[]) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const entry of entries) {
    if (entry.entryType === "term") {
      termIds.add(entry.entryId);
      continue;
    }

    if (entry.entryType === "grammar") {
      grammarIds.add(entry.entryId);
    }
  }

  return {
    grammarIds: [...grammarIds],
    termIds: [...termIds]
  };
}

export async function listEntryLessonConnections(
  database: DatabaseClient,
  entries: GlossaryEntryRef[]
) {
  if (entries.length === 0) {
    return [];
  }

  const { grammarIds, termIds } = splitGlossaryEntryRefs(entries);
  const filters = [];

  if (termIds.length > 0) {
    filters.push(
      and(eq(entryLink.entryType, "term"), inArray(entryLink.entryId, termIds))
    );
  }

  if (grammarIds.length > 0) {
    filters.push(
      and(
        eq(entryLink.entryType, "grammar"),
        inArray(entryLink.entryId, grammarIds)
      )
    );
  }

  if (filters.length === 0) {
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
        filters.length === 1 ? filters[0]! : or(...filters)
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

  const { grammarIds, termIds } = splitGlossaryEntryRefs(entries);
  const filters = [];

  if (termIds.length > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "term"),
        inArray(cardEntryLink.entryId, termIds)
      )
    );
  }

  if (grammarIds.length > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "grammar"),
        inArray(cardEntryLink.entryId, grammarIds)
      )
    );
  }

  if (filters.length === 0) {
    return [];
  }

  return database
    .select({
      entryType: cardEntryLink.entryType,
      entryId: cardEntryLink.entryId,
      relationshipType: cardEntryLink.relationshipType,
      cardId: card.id,
      cardStatus: card.status,
      cardType: card.cardType,
      cardFront: card.front,
      cardBack: card.back,
      cardNotesIt: card.notesIt,
      cardOrderIndex: card.orderIndex,
      segmentId: segment.id,
      segmentTitle: segment.title,
      reviewState: reviewSubjectState.state,
      dueAt: reviewSubjectState.dueAt,
      manualOverride: reviewSubjectState.manualOverride
    })
    .from(cardEntryLink)
    .innerJoin(card, eq(card.id, cardEntryLink.cardId))
    .leftJoin(segment, eq(segment.id, card.segmentId))
    .leftJoin(
      term,
      and(
        eq(cardEntryLink.entryType, "term"),
        eq(term.id, cardEntryLink.entryId)
      )
    )
    .leftJoin(
      grammarPattern,
      and(
        eq(cardEntryLink.entryType, "grammar"),
        eq(grammarPattern.id, cardEntryLink.entryId)
      )
    )
    .leftJoin(
      reviewSubjectState,
      sql`
        ${reviewSubjectState.entryType} = ${cardEntryLink.entryType}
        AND (
          (
            ${cardEntryLink.entryType} = 'term'
            AND (
              (
                ${term.crossMediaGroupId} IS NOT NULL
                AND ${reviewSubjectState.crossMediaGroupId} = ${term.crossMediaGroupId}
              )
              OR (
                ${term.crossMediaGroupId} IS NULL
                AND ${reviewSubjectState.entryId} = ${cardEntryLink.entryId}
              )
            )
          )
          OR (
            ${cardEntryLink.entryType} = 'grammar'
            AND (
              (
                ${grammarPattern.crossMediaGroupId} IS NOT NULL
                AND ${reviewSubjectState.crossMediaGroupId} = ${grammarPattern.crossMediaGroupId}
              )
              OR (
                ${grammarPattern.crossMediaGroupId} IS NULL
                AND ${reviewSubjectState.entryId} = ${cardEntryLink.entryId}
              )
            )
          )
        )
      `
    )
    .where(
      and(
        ne(card.status, "archived"),
        filters.length === 1 ? filters[0]! : or(...filters)
      )
    )
    .orderBy(asc(card.orderIndex), asc(card.createdAt), asc(card.id));
}

export async function listEntryCardCounts(
  database: DatabaseClient,
  entries: GlossaryEntryRef[]
) {
  if (entries.length === 0) {
    return [];
  }

  const { grammarIds, termIds } = splitGlossaryEntryRefs(entries);
  const filters = [];

  if (termIds.length > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "term"),
        inArray(cardEntryLink.entryId, termIds)
      )
    );
  }

  if (grammarIds.length > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "grammar"),
        inArray(cardEntryLink.entryId, grammarIds)
      )
    );
  }

  if (filters.length === 0) {
    return [];
  }

  return database
    .select({
      entryType: cardEntryLink.entryType,
      entryId: cardEntryLink.entryId,
      cardCount: sql<number>`cast(count(*) as integer)`
    })
    .from(cardEntryLink)
    .innerJoin(card, eq(card.id, cardEntryLink.cardId))
    .where(
      and(
        ne(card.status, "archived"),
        filters.length === 1 ? filters[0]! : or(...filters)
      )
    )
    .groupBy(cardEntryLink.entryType, cardEntryLink.entryId);
}

export type EntryLessonConnection = Awaited<
  ReturnType<typeof listEntryLessonConnections>
>[number];
export type EntryCardConnection = Awaited<
  ReturnType<typeof listEntryCardConnections>
>[number];
export type EntryCardCount = Awaited<
  ReturnType<typeof listEntryCardCounts>
>[number];

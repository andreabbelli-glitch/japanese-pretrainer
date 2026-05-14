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

export type GlossaryStudySignalRef = GlossaryEntryRef & {
  crossMediaGroupId: string | null;
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

export async function listEntryStudySignals(
  database: DatabaseClient,
  entries: GlossaryStudySignalRef[]
) {
  if (entries.length === 0) {
    return [];
  }

  const valuesSql = entries.map(() => "(?, ?, ?)").join(", ");
  const args = entries.flatMap((entry) => [
    entry.entryType,
    entry.entryId,
    entry.crossMediaGroupId
  ]);
  const result = await database.$client.execute({
    sql: `
      with requested(entryType, entryId, crossMediaGroupId) as (
        values ${valuesSql}
      ),
      active_requested as (
        select distinct
          requested.entryType as entryType,
          requested.entryId as entryId,
          requested.crossMediaGroupId as crossMediaGroupId
        from requested
        inner join card_entry_link
          on card_entry_link.entry_type = requested.entryType
          and card_entry_link.entry_id = requested.entryId
        inner join card
          on card.id = card_entry_link.card_id
          and card.status = 'active'
      )
      select distinct
        active_requested.entryId as entryId,
        active_requested.entryType as entryType,
        review_subject_state.state as reviewState,
        review_subject_state.manual_override as manualOverride
      from active_requested
      left join review_subject_state
        on review_subject_state.entry_type = active_requested.entryType
        and review_subject_state.cross_media_group_id =
          active_requested.crossMediaGroupId
      where active_requested.crossMediaGroupId is not null
      union all
      select distinct
        active_requested.entryId as entryId,
        active_requested.entryType as entryType,
        review_subject_state.state as reviewState,
        review_subject_state.manual_override as manualOverride
      from active_requested
      left join review_subject_state
        on review_subject_state.entry_type = active_requested.entryType
        and review_subject_state.cross_media_group_id is null
        and review_subject_state.entry_id = active_requested.entryId
      where active_requested.crossMediaGroupId is null
    `,
    args
  });

  return result.rows.map((row) => ({
    entryId: String(row.entryId),
    entryType: row.entryType as EntryType,
    manualOverride:
      row.manualOverride === null || row.manualOverride === undefined
        ? null
        : Boolean(row.manualOverride),
    reviewState:
      typeof row.reviewState === "string" ? row.reviewState : null
  }));
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

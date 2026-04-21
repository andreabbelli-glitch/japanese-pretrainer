import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  grammarPattern,
  reviewSubjectState,
  term,
  userSetting
} from "../schema/index.ts";

const lessonEntryLinkColumns = {
  entryId: true,
  entryType: true
} as const;

export async function listLessonEntryLinks(
  database: DatabaseClient,
  lessonId: string
) {
  return database.query.entryLink.findMany({
    columns: lessonEntryLinkColumns,
    where: and(eq(entryLink.sourceType, "lesson"), eq(entryLink.sourceId, lessonId)),
    orderBy: [asc(entryLink.sortOrder), asc(entryLink.entryType), asc(entryLink.entryId)]
  });
}

export async function getUserSettingValue(
  database: DatabaseClient,
  key: (typeof userSetting.$inferSelect)["key"]
) {
  const row = await database.query.userSetting.findFirst({
    where: eq(userSetting.key, key)
  });

  return row ?? null;
}

export async function listEntryStudySignals(
  database: DatabaseClient,
  entries: Array<{
    entryId: string;
    entryType: "term" | "grammar";
  }>
) {
  if (entries.length === 0) {
    return [];
  }

  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const entry of entries) {
    if (entry.entryType === "term") {
      termIds.add(entry.entryId);
      continue;
    }

    grammarIds.add(entry.entryId);
  }

  const filters = [];

  if (termIds.size > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "term"),
        inArray(cardEntryLink.entryId, [...termIds])
      )
    );
  }

  if (grammarIds.size > 0) {
    filters.push(
      and(
        eq(cardEntryLink.entryType, "grammar"),
        inArray(cardEntryLink.entryId, [...grammarIds])
      )
    );
  }

  if (filters.length === 0) {
    return [];
  }

  return database
    .select({
      entryId: cardEntryLink.entryId,
      entryType: cardEntryLink.entryType,
      reviewState: reviewSubjectState.state,
      manualOverride: reviewSubjectState.manualOverride
    })
    .from(cardEntryLink)
    .innerJoin(card, eq(card.id, cardEntryLink.cardId))
    .leftJoin(
      term,
      and(eq(cardEntryLink.entryType, "term"), eq(term.id, cardEntryLink.entryId))
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
    .where(and(eq(card.status, "active"), or(...filters)));
}

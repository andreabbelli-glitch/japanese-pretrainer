import { asc, eq, inArray, sql } from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  crossMediaGroup,
  grammarPattern,
  media,
  segment,
  term,
  type EntryType
} from "../schema/index.ts";
export type CrossMediaGroupRecord = typeof crossMediaGroup.$inferSelect;

export type CrossMediaSibling = {
  entryId: string;
  groupId: string;
  groupKey: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  sourceId: string;
  kind: EntryType;
  label: string;
  reading: string | null;
  meaningIt: string;
  notesIt: string | null;
  segmentTitle: string | null;
  romaji?: string;
  title?: string;
};

export type CrossMediaFamily = {
  group: CrossMediaGroupRecord | null;
  siblings: CrossMediaSibling[];
};

export async function listCrossMediaFamiliesByEntryIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryIds: string[]
): Promise<Map<string, CrossMediaFamily>> {
  const requestedEntryIds = [...new Set(entryIds)];

  if (requestedEntryIds.length === 0) {
    return new Map();
  }

  const families = new Map<string, CrossMediaFamily>(
    requestedEntryIds.map((entryId) => [
      entryId,
      {
        group: null,
        siblings: []
      }
    ])
  );
  const rows =
    kind === "term"
      ? await database
          .select({ id: term.id, crossMediaGroupId: term.crossMediaGroupId })
          .from(term)
          .where(inArray(term.id, requestedEntryIds))
      : await database
          .select({
            id: grammarPattern.id,
            crossMediaGroupId: grammarPattern.crossMediaGroupId
          })
          .from(grammarPattern)
          .where(inArray(grammarPattern.id, requestedEntryIds));
  const groupIdByEntryId = new Map<string, string>();
  const groupIds = new Set<string>();

  for (const row of rows) {
    if (!row.crossMediaGroupId) {
      continue;
    }

    groupIdByEntryId.set(row.id, row.crossMediaGroupId);
    groupIds.add(row.crossMediaGroupId);
  }

  if (groupIds.size === 0) {
    return families;
  }

  const groups = await database.query.crossMediaGroup.findMany({
    where: inArray(crossMediaGroup.id, [...groupIds])
  });
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const validGroupIds = [...groupsById.keys()];

  if (validGroupIds.length === 0) {
    return families;
  }

  const siblings =
    kind === "term"
      ? (
          await database
            .select({
              entryId: term.id,
              groupId: crossMediaGroup.id,
              groupKey: crossMediaGroup.groupKey,
              mediaId: media.id,
              mediaSlug: media.slug,
              mediaTitle: media.title,
              sourceId: term.sourceId,
              label: term.lemma,
              reading: term.reading,
              romaji: term.romaji,
              meaningIt: term.meaningIt,
              notesIt: term.notesIt,
              segmentTitle: segment.title
            })
            .from(term)
            .innerJoin(
              crossMediaGroup,
              eq(crossMediaGroup.id, term.crossMediaGroupId)
            )
            .innerJoin(media, eq(media.id, term.mediaId))
            .leftJoin(segment, eq(segment.id, term.segmentId))
            .where(inArray(term.crossMediaGroupId, validGroupIds))
            .orderBy(asc(media.title), asc(term.lemma), asc(term.reading))
        ).map((row) => ({
          ...row,
          kind: "term" as const
        }))
      : (
          await database
            .select({
              entryId: grammarPattern.id,
              groupId: crossMediaGroup.id,
              groupKey: crossMediaGroup.groupKey,
              mediaId: media.id,
              mediaSlug: media.slug,
              mediaTitle: media.title,
              sourceId: grammarPattern.sourceId,
              label: grammarPattern.pattern,
              title: grammarPattern.title,
              reading: grammarPattern.reading,
              meaningIt: grammarPattern.meaningIt,
              notesIt: grammarPattern.notesIt,
              segmentTitle: segment.title
            })
            .from(grammarPattern)
            .innerJoin(
              crossMediaGroup,
              eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
            )
            .innerJoin(media, eq(media.id, grammarPattern.mediaId))
            .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
            .where(inArray(grammarPattern.crossMediaGroupId, validGroupIds))
            .orderBy(
              asc(media.title),
              asc(grammarPattern.pattern),
              asc(grammarPattern.title)
            )
        ).map((row) => ({
          ...row,
          kind: "grammar" as const
        }));
  const siblingsByGroupId = new Map<string, CrossMediaSibling[]>();

  for (const sibling of siblings) {
    const groupedSiblings = siblingsByGroupId.get(sibling.groupId);

    if (groupedSiblings) {
      groupedSiblings.push(sibling);
      continue;
    }

    siblingsByGroupId.set(sibling.groupId, [sibling]);
  }

  for (const [entryId, groupId] of groupIdByEntryId.entries()) {
    const group = groupsById.get(groupId);

    if (!group) {
      continue;
    }

    families.set(entryId, {
      group,
      siblings: (siblingsByGroupId.get(groupId) ?? []).filter(
        (sibling) => sibling.entryId !== entryId
      )
    });
  }

  return families;
}

export async function getCrossMediaFamilyByEntryId(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryId: string
): Promise<CrossMediaFamily> {
  return (
    (await listCrossMediaFamiliesByEntryIds(database, kind, [entryId])).get(
      entryId
    ) ?? {
      group: null,
      siblings: []
    }
  );
}

export async function getCrossMediaSiblingCounts(
  database: DatabaseClient,
  kind: EntryType,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return new Map<string, number>();
  }

  const table = kind === "term" ? term : grammarPattern;
  const entryRows = await database
    .select({
      id: table.id,
      crossMediaGroupId: table.crossMediaGroupId
    })
    .from(table)
    .where(inArray(table.id, entryIds));
  const groupIds = [
    ...new Set(
      entryRows
        .map((row) => row.crossMediaGroupId)
        .filter((value): value is string => typeof value === "string")
    )
  ];

  if (groupIds.length === 0) {
    return new Map<string, number>();
  }

  const countRows = await database
    .select({
      groupId: table.crossMediaGroupId,
      count: sql<number>`count(*)`
    })
    .from(table)
    .where(inArray(table.crossMediaGroupId, groupIds))
    .groupBy(table.crossMediaGroupId);
  const countsByGroup = new Map(
    countRows
      .filter(
        (row): row is typeof row & { groupId: string } =>
          row.groupId !== null
      )
      .map((row) => [row.groupId, Number(row.count)])
  );

  return new Map(
    entryRows.map((row) => [
      row.id,
      row.crossMediaGroupId
        ? Math.max((countsByGroup.get(row.crossMediaGroupId) ?? 1) - 1, 0)
        : 0
    ])
  );
}

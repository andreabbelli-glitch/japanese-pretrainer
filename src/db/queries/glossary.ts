import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  cardEntryLink,
  crossMediaGroup,
  entryLink,
  entryStatus,
  grammarPattern,
  lesson,
  media,
  reviewState,
  segment,
  type EntryType,
  term
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

export type CrossMediaGroupRecord = typeof crossMediaGroup.$inferSelect;

export type CrossMediaTermSibling = {
  entryId: string;
  groupId: string;
  groupKey: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  sourceId: string;
  lemma: string;
  reading: string;
  romaji: string;
  meaningIt: string;
  notesIt: string | null;
  segmentTitle: string | null;
};

export type CrossMediaGrammarSibling = {
  entryId: string;
  groupId: string;
  groupKey: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  sourceId: string;
  pattern: string;
  title: string;
  reading: string | null;
  meaningIt: string;
  notesIt: string | null;
  segmentTitle: string | null;
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

type ListGlossaryEntriesOptions = {
  mediaId?: string;
  mediaIds?: string[];
};

function buildMediaScopeFilter(
  column: typeof term.mediaId | typeof grammarPattern.mediaId,
  options: ListGlossaryEntriesOptions
) {
  if (options.mediaId) {
    return eq(column, options.mediaId);
  }

  if (options.mediaIds && options.mediaIds.length > 0) {
    return inArray(column, options.mediaIds);
  }

  return undefined;
}

async function listTermGlossaryEntries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  const rows = await database.query.term.findMany({
    where: buildMediaScopeFilter(term.mediaId, options),
    with: {
      aliases: true,
      crossMediaGroup: true,
      media: true,
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

async function listGrammarGlossaryEntries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  const rows = await database.query.grammarPattern.findMany({
    where: buildMediaScopeFilter(grammarPattern.mediaId, options),
    with: {
      aliases: true,
      crossMediaGroup: true,
      media: true,
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
  return listTermGlossaryEntries(database, {
    mediaId
  });
}

export async function listGrammarEntriesByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return listGrammarGlossaryEntries(database, {
    mediaId
  });
}

export async function listTermEntries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return listTermGlossaryEntries(database, options);
}

export async function listTermEntrySummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select({
      id: term.id,
      sourceId: term.sourceId,
      crossMediaGroupId: term.crossMediaGroupId,
      mediaId: term.mediaId,
      segmentId: term.segmentId,
      lemma: term.lemma,
      reading: term.reading,
      romaji: term.romaji,
      meaningIt: term.meaningIt,
      levelHint: term.levelHint,
      audioSrc: term.audioSrc,
      audioSource: term.audioSource,
      audioSpeaker: term.audioSpeaker,
      audioLicense: term.audioLicense,
      audioAttribution: term.audioAttribution,
      audioPageUrl: term.audioPageUrl,
      pitchAccent: term.pitchAccent,
      pitchAccentSource: term.pitchAccentSource,
      pitchAccentPageUrl: term.pitchAccentPageUrl,
      searchLemmaNorm: term.searchLemmaNorm,
      searchReadingNorm: term.searchReadingNorm,
      searchRomajiNorm: term.searchRomajiNorm,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey,
      entryStatus: entryStatus.status
    })
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .leftJoin(
      entryStatus,
      and(eq(entryStatus.entryId, term.id), eq(entryStatus.entryType, "term"))
    )
    .where(buildMediaScopeFilter(term.mediaId, options))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listGrammarEntries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return listGrammarGlossaryEntries(database, options);
}

export async function listGrammarEntrySummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select({
      id: grammarPattern.id,
      sourceId: grammarPattern.sourceId,
      crossMediaGroupId: grammarPattern.crossMediaGroupId,
      mediaId: grammarPattern.mediaId,
      segmentId: grammarPattern.segmentId,
      pattern: grammarPattern.pattern,
      title: grammarPattern.title,
      reading: grammarPattern.reading,
      meaningIt: grammarPattern.meaningIt,
      levelHint: grammarPattern.levelHint,
      audioSrc: grammarPattern.audioSrc,
      audioSource: grammarPattern.audioSource,
      audioSpeaker: grammarPattern.audioSpeaker,
      audioLicense: grammarPattern.audioLicense,
      audioAttribution: grammarPattern.audioAttribution,
      audioPageUrl: grammarPattern.audioPageUrl,
      pitchAccent: grammarPattern.pitchAccent,
      pitchAccentSource: grammarPattern.pitchAccentSource,
      pitchAccentPageUrl: grammarPattern.pitchAccentPageUrl,
      searchPatternNorm: grammarPattern.searchPatternNorm,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey,
      entryStatus: entryStatus.status
    })
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .leftJoin(
      entryStatus,
      and(
        eq(entryStatus.entryId, grammarPattern.id),
        eq(entryStatus.entryType, "grammar")
      )
    )
    .where(buildMediaScopeFilter(grammarPattern.mediaId, options))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
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
      crossMediaGroup: true,
      media: true,
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
      crossMediaGroup: true,
      media: true,
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

export async function getTermEntryBySourceId(
  database: DatabaseClient,
  mediaId: string,
  sourceId: string
) {
  const row = await database.query.term.findFirst({
    where: and(eq(term.mediaId, mediaId), eq(term.sourceId, sourceId)),
    with: {
      aliases: true,
      crossMediaGroup: true,
      media: true,
      segment: true
    }
  });

  if (!row) {
    return null;
  }

  const statusMap = await getEntryStatusMap(database, "term", [row.id]);

  return {
    ...row,
    status: statusMap.get(row.id) ?? null
  };
}

export async function getGrammarEntryById(
  database: DatabaseClient,
  entryId: string
) {
  const [entry] = await getGrammarEntriesByIds(database, [entryId]);

  return entry ?? null;
}

export async function getGrammarEntryBySourceId(
  database: DatabaseClient,
  mediaId: string,
  sourceId: string
) {
  const row = await database.query.grammarPattern.findFirst({
    where: and(
      eq(grammarPattern.mediaId, mediaId),
      eq(grammarPattern.sourceId, sourceId)
    ),
    with: {
      aliases: true,
      crossMediaGroup: true,
      media: true,
      segment: true
    }
  });

  if (!row) {
    return null;
  }

  const statusMap = await getEntryStatusMap(database, "grammar", [row.id]);

  return {
    ...row,
    status: statusMap.get(row.id) ?? null
  };
}

export async function getTermCrossMediaFamilyByEntryId(
  database: DatabaseClient,
  entryId: string
): Promise<{
  group: CrossMediaGroupRecord | null;
  siblings: CrossMediaTermSibling[];
}> {
  const row = await database.query.term.findFirst({
    where: eq(term.id, entryId)
  });

  if (!row?.crossMediaGroupId) {
    return {
      group: null,
      siblings: []
    };
  }

  const group = await database.query.crossMediaGroup.findFirst({
    where: eq(crossMediaGroup.id, row.crossMediaGroupId)
  });

  if (!group) {
    return {
      group: null,
      siblings: []
    };
  }

  const siblings = await database
    .select({
      entryId: term.id,
      groupId: crossMediaGroup.id,
      groupKey: crossMediaGroup.groupKey,
      mediaId: media.id,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      sourceId: term.sourceId,
      lemma: term.lemma,
      reading: term.reading,
      romaji: term.romaji,
      meaningIt: term.meaningIt,
      notesIt: term.notesIt,
      segmentTitle: segment.title
    })
    .from(term)
    .innerJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .where(
      and(
        eq(term.crossMediaGroupId, row.crossMediaGroupId),
        ne(term.id, entryId)
      )
    )
    .orderBy(asc(media.title), asc(term.lemma), asc(term.reading));

  return {
    group,
    siblings
  };
}

export async function getGrammarCrossMediaFamilyByEntryId(
  database: DatabaseClient,
  entryId: string
): Promise<{
  group: CrossMediaGroupRecord | null;
  siblings: CrossMediaGrammarSibling[];
}> {
  const row = await database.query.grammarPattern.findFirst({
    where: eq(grammarPattern.id, entryId)
  });

  if (!row?.crossMediaGroupId) {
    return {
      group: null,
      siblings: []
    };
  }

  const group = await database.query.crossMediaGroup.findFirst({
    where: eq(crossMediaGroup.id, row.crossMediaGroupId)
  });

  if (!group) {
    return {
      group: null,
      siblings: []
    };
  }

  const siblings = await database
    .select({
      entryId: grammarPattern.id,
      groupId: crossMediaGroup.id,
      groupKey: crossMediaGroup.groupKey,
      mediaId: media.id,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      sourceId: grammarPattern.sourceId,
      pattern: grammarPattern.pattern,
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
    .where(
      and(
        eq(grammarPattern.crossMediaGroupId, row.crossMediaGroupId),
        ne(grammarPattern.id, entryId)
      )
    )
    .orderBy(
      asc(media.title),
      asc(grammarPattern.pattern),
      asc(grammarPattern.title)
    );

  return {
    group,
    siblings
  };
}

export async function getTermCrossMediaSiblingCounts(
  database: DatabaseClient,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await database.query.term.findMany({
    where: inArray(term.id, entryIds)
  });
  const groupIds = [
    ...new Set(
      rows
        .map((row) => row.crossMediaGroupId)
        .filter((value): value is string => typeof value === "string")
    )
  ];

  if (groupIds.length === 0) {
    return new Map<string, number>();
  }

  const groupedRows = await database.query.term.findMany({
    where: inArray(term.crossMediaGroupId, groupIds)
  });
  const countsByGroup = new Map<string, number>();

  for (const row of groupedRows) {
    if (!row.crossMediaGroupId) {
      continue;
    }

    countsByGroup.set(
      row.crossMediaGroupId,
      (countsByGroup.get(row.crossMediaGroupId) ?? 0) + 1
    );
  }

  return new Map(
    rows.map((row) => [
      row.id,
      row.crossMediaGroupId
        ? Math.max((countsByGroup.get(row.crossMediaGroupId) ?? 1) - 1, 0)
        : 0
    ])
  );
}

export async function getGrammarCrossMediaSiblingCounts(
  database: DatabaseClient,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await database.query.grammarPattern.findMany({
    where: inArray(grammarPattern.id, entryIds)
  });
  const groupIds = [
    ...new Set(
      rows
        .map((row) => row.crossMediaGroupId)
        .filter((value): value is string => typeof value === "string")
    )
  ];

  if (groupIds.length === 0) {
    return new Map<string, number>();
  }

  const groupedRows = await database.query.grammarPattern.findMany({
    where: inArray(grammarPattern.crossMediaGroupId, groupIds)
  });
  const countsByGroup = new Map<string, number>();

  for (const row of groupedRows) {
    if (!row.crossMediaGroupId) {
      continue;
    }

    countsByGroup.set(
      row.crossMediaGroupId,
      (countsByGroup.get(row.crossMediaGroupId) ?? 0) + 1
    );
  }

  return new Map(
    rows.map((row) => [
      row.id,
      row.crossMediaGroupId
        ? Math.max((countsByGroup.get(row.crossMediaGroupId) ?? 1) - 1, 0)
        : 0
    ])
  );
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
export type EntryCardCount = Awaited<ReturnType<typeof listEntryCardCounts>>[number];
export type TermGlossaryEntrySummary = Awaited<
  ReturnType<typeof listTermEntrySummaries>
>[number];
export type GrammarGlossaryEntrySummary = Awaited<
  ReturnType<typeof listGrammarEntrySummaries>
>[number];

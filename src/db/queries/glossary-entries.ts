import { and, asc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import { quoteSqlString } from "./review-query-helpers.ts";
import {
  card,
  cardEntryLink,
  crossMediaGroup,
  entryLink,
  grammarAlias,
  grammarPattern,
  lesson,
  media,
  reviewSubjectState,
  segment,
  termAlias,
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

const glossaryEntryRelations = {
  aliases: true,
  crossMediaGroup: true,
  media: true,
  segment: true
} as const;

type TermGlossaryRow = typeof term.$inferSelect & {
  aliases: (typeof termAlias.$inferSelect)[];
  crossMediaGroup: typeof crossMediaGroup.$inferSelect | null;
  media: typeof media.$inferSelect;
  segment: typeof segment.$inferSelect | null;
};

type GrammarGlossaryRow = typeof grammarPattern.$inferSelect & {
  aliases: (typeof grammarAlias.$inferSelect)[];
  crossMediaGroup: typeof crossMediaGroup.$inferSelect | null;
  media: typeof media.$inferSelect;
  segment: typeof segment.$inferSelect | null;
};

type GlossaryRowByKind = {
  grammar: GrammarGlossaryRow;
  term: TermGlossaryRow;
};

type GlossaryQueryLoader<K extends EntryType> = {
  findFirst: (
    where?: SQL<unknown>
  ) => Promise<GlossaryRowByKind[K] | undefined>;
  findMany: (where?: SQL<unknown>) => Promise<GlossaryRowByKind[K][]>;
};

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

function buildGlossaryMediaScopeFilter(
  kind: EntryType,
  options: ListGlossaryEntriesOptions
) {
  return buildMediaScopeFilter(
    kind === "term" ? term.mediaId : grammarPattern.mediaId,
    options
  );
}

function buildGlossaryIdsFilter(kind: EntryType, entryIds: string[]) {
  return inArray(kind === "term" ? term.id : grammarPattern.id, entryIds);
}

function buildGlossaryCrossMediaGroupFilter(
  kind: EntryType,
  groupIds: string[]
) {
  return inArray(
    kind === "term" ? term.crossMediaGroupId : grammarPattern.crossMediaGroupId,
    groupIds
  );
}

function buildGlossarySourceFilter(
  kind: EntryType,
  mediaId: string,
  sourceId: string
) {
  return and(
    eq(kind === "term" ? term.mediaId : grammarPattern.mediaId, mediaId),
    eq(kind === "term" ? term.sourceId : grammarPattern.sourceId, sourceId)
  );
}

function getGlossaryQueryLoader<K extends EntryType>(
  database: DatabaseQueryClient,
  kind: K
): GlossaryQueryLoader<K>;
function getGlossaryQueryLoader<K extends EntryType>(
  database: DatabaseQueryClient,
  kind: K
) {
  if (kind === "term") {
    return {
      findFirst: (where?: SQL<unknown>) =>
        database.query.term.findFirst({
          where,
          with: glossaryEntryRelations
        }),
      findMany: (where?: SQL<unknown>) =>
        database.query.term.findMany({
          where,
          with: glossaryEntryRelations,
          orderBy: [asc(term.lemma), asc(term.reading)]
        })
    } as unknown as GlossaryQueryLoader<K>;
  }

  return {
    findFirst: (where?: SQL<unknown>) =>
      database.query.grammarPattern.findFirst({
        where,
        with: glossaryEntryRelations
      }),
    findMany: (where?: SQL<unknown>) =>
      database.query.grammarPattern.findMany({
        where,
        with: glossaryEntryRelations,
        orderBy: [asc(grammarPattern.pattern), asc(grammarPattern.title)]
      })
  } as unknown as GlossaryQueryLoader<K>;
}

async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: "term",
  where?: SQL<unknown>
): Promise<TermGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: "grammar",
  where?: SQL<unknown>
): Promise<GrammarGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
): Promise<TermGlossaryRow[] | GrammarGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
) {
  return getGlossaryQueryLoader(database, kind).findMany(where) as Promise<
    TermGlossaryRow[] | GrammarGlossaryRow[]
  >;
}

async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: "term",
  where?: SQL<unknown>
): Promise<TermGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: "grammar",
  where?: SQL<unknown>
): Promise<GrammarGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
): Promise<TermGlossaryRow | GrammarGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
) {
  return (
    (await getGlossaryQueryLoader(database, kind).findFirst(where)) ?? null
  );
}

export async function listGlossaryEntriesByKind(
  database: DatabaseClient,
  kind: "term",
  options: ListGlossaryEntriesOptions
): Promise<TermGlossaryRow[]>;
export async function listGlossaryEntriesByKind(
  database: DatabaseClient,
  kind: "grammar",
  options: ListGlossaryEntriesOptions
): Promise<GrammarGlossaryRow[]>;
export async function listGlossaryEntriesByKind(
  database: DatabaseClient,
  kind: EntryType,
  options: ListGlossaryEntriesOptions = {}
) {
  return queryGlossaryEntries(
    database,
    kind,
    buildGlossaryMediaScopeFilter(kind, options)
  );
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

function buildTermSummaryBaseSelection() {
  return {
    id: term.id,
    sourceId: term.sourceId,
    crossMediaGroupId: term.crossMediaGroupId,
    mediaId: term.mediaId,
    segmentId: term.segmentId,
    lemma: term.lemma,
    reading: term.reading,
    romaji: term.romaji,
    meaningIt: term.meaningIt,
    audioSrc: term.audioSrc,
    audioSource: term.audioSource,
    audioSpeaker: term.audioSpeaker,
    audioLicense: term.audioLicense,
    audioAttribution: term.audioAttribution,
    audioPageUrl: term.audioPageUrl,
    pitchAccent: term.pitchAccent,
    pitchAccentSource: term.pitchAccentSource,
    pitchAccentPageUrl: term.pitchAccentPageUrl,
    mediaSlug: media.slug,
    mediaTitle: media.title,
    segmentTitle: segment.title,
    crossMediaGroupKey: crossMediaGroup.groupKey
  };
}

function buildTermSummarySelection(includeExtendedFields: true): ReturnType<
  typeof buildTermSummaryBaseSelection
> & {
  levelHint: typeof term.levelHint;
  searchLemmaNorm: typeof term.searchLemmaNorm;
  searchReadingNorm: typeof term.searchReadingNorm;
  searchRomajiNorm: typeof term.searchRomajiNorm;
};
function buildTermSummarySelection(includeExtendedFields: false): ReturnType<
  typeof buildTermSummaryBaseSelection
>;
function buildTermSummarySelection(includeExtendedFields: boolean) {
  const selection = buildTermSummaryBaseSelection();

  if (includeExtendedFields) {
    return {
      ...selection,
      levelHint: term.levelHint,
      searchLemmaNorm: term.searchLemmaNorm,
      searchReadingNorm: term.searchReadingNorm,
      searchRomajiNorm: term.searchRomajiNorm
    };
  }

  return selection;
}

function buildGrammarSummaryBaseSelection() {
  return {
    id: grammarPattern.id,
    sourceId: grammarPattern.sourceId,
    crossMediaGroupId: grammarPattern.crossMediaGroupId,
    mediaId: grammarPattern.mediaId,
    segmentId: grammarPattern.segmentId,
    pattern: grammarPattern.pattern,
    title: grammarPattern.title,
    reading: grammarPattern.reading,
    meaningIt: grammarPattern.meaningIt,
    audioSrc: grammarPattern.audioSrc,
    audioSource: grammarPattern.audioSource,
    audioSpeaker: grammarPattern.audioSpeaker,
    audioLicense: grammarPattern.audioLicense,
    audioAttribution: grammarPattern.audioAttribution,
    audioPageUrl: grammarPattern.audioPageUrl,
    pitchAccent: grammarPattern.pitchAccent,
    pitchAccentSource: grammarPattern.pitchAccentSource,
    pitchAccentPageUrl: grammarPattern.pitchAccentPageUrl,
    mediaSlug: media.slug,
    mediaTitle: media.title,
    segmentTitle: segment.title,
    crossMediaGroupKey: crossMediaGroup.groupKey
  };
}

function buildGrammarSummarySelection(includeExtendedFields: true): ReturnType<
  typeof buildGrammarSummaryBaseSelection
> & {
  levelHint: typeof grammarPattern.levelHint;
  searchPatternNorm: typeof grammarPattern.searchPatternNorm;
  searchRomajiNorm: typeof grammarPattern.searchRomajiNorm;
};
function buildGrammarSummarySelection(includeExtendedFields: false): ReturnType<
  typeof buildGrammarSummaryBaseSelection
>;
function buildGrammarSummarySelection(includeExtendedFields: boolean) {
  const selection = buildGrammarSummaryBaseSelection();

  if (includeExtendedFields) {
    return {
      ...selection,
      levelHint: grammarPattern.levelHint,
      searchPatternNorm: grammarPattern.searchPatternNorm,
      searchRomajiNorm: grammarPattern.searchRomajiNorm
    };
  }

  return selection;
}

export async function listTermEntrySummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildTermSummarySelection(true))
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .where(buildMediaScopeFilter(term.mediaId, options))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listTermEntryReviewSummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildTermSummarySelection(false))
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .where(buildMediaScopeFilter(term.mediaId, options))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listGrammarEntrySummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildGrammarSummarySelection(true))
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .where(buildMediaScopeFilter(grammarPattern.mediaId, options))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export async function listGrammarEntryReviewSummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildGrammarSummarySelection(false))
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .where(buildMediaScopeFilter(grammarPattern.mediaId, options))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: "term",
  entryIds: string[]
): Promise<TermGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: "grammar",
  entryIds: string[]
): Promise<GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryIds: string[]
): Promise<TermGlossaryRow[] | GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return [];
  }

  return queryGlossaryEntries(
    database,
    kind,
    buildGlossaryIdsFilter(kind, entryIds)
  );
}

export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseQueryClient,
  kind: "term",
  groupIds: string[]
): Promise<TermGlossaryRow[]>;
export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseQueryClient,
  kind: "grammar",
  groupIds: string[]
): Promise<GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  groupIds: string[]
) {
  if (groupIds.length === 0) {
    return [];
  }

  return queryGlossaryEntries(
    database,
    kind,
    buildGlossaryCrossMediaGroupFilter(kind, groupIds)
  );
}
export async function getGlobalGlossaryAggregateStats(
  database: DatabaseClient
) {
  const [
    termEntryCountResult,
    grammarEntryCountResult,
    termCrossMediaCountResult,
    grammarCrossMediaCountResult,
    termWithCardsCountResult,
    grammarWithCardsCountResult
  ] = await Promise.all([
    database.$client.execute(
      "select cast(count(distinct coalesce(cross_media_group_id, id)) as integer) as count from term"
    ),
    database.$client.execute(
      "select cast(count(distinct coalesce(cross_media_group_id, id)) as integer) as count from grammar_pattern"
    ),
    database.$client.execute(`
      select cast(count(*) as integer) as count
      from (
        select cross_media_group_id
        from term
        where cross_media_group_id is not null
        group by cross_media_group_id
        having count(*) > 1
      ) grouped
    `),
    database.$client.execute(`
      select cast(count(*) as integer) as count
      from (
        select cross_media_group_id
        from grammar_pattern
        where cross_media_group_id is not null
        group by cross_media_group_id
        having count(*) > 1
      ) grouped
    `),
    database.$client.execute(`
      select cast(count(distinct coalesce(term.cross_media_group_id, term.id)) as integer) as count
      from term
      inner join card_entry_link
        on card_entry_link.entry_type = 'term'
        and card_entry_link.entry_id = term.id
      inner join card
        on card.id = card_entry_link.card_id
      where card.status != 'archived'
    `),
    database.$client.execute(`
      select cast(count(distinct coalesce(grammar_pattern.cross_media_group_id, grammar_pattern.id)) as integer) as count
      from grammar_pattern
      inner join card_entry_link
        on card_entry_link.entry_type = 'grammar'
        and card_entry_link.entry_id = grammar_pattern.id
      inner join card
        on card.id = card_entry_link.card_id
      where card.status != 'archived'
    `)
  ]);
  const readCount = (
    result:
      | Awaited<ReturnType<DatabaseClient["$client"]["execute"]>>
      | null
      | undefined
  ) => Number(result?.rows[0]?.count ?? 0);

  return {
    crossMediaCount:
      readCount(termCrossMediaCountResult) +
      readCount(grammarCrossMediaCountResult),
    entryCount:
      readCount(termEntryCountResult) + readCount(grammarEntryCountResult),
    withCardsCount:
      readCount(termWithCardsCountResult) +
      readCount(grammarWithCardsCountResult)
  };
}

export async function getGlossaryEntryById(
  database: DatabaseQueryClient,
  kind: "term",
  entryId: string
): Promise<TermGlossaryRow | null>;
export async function getGlossaryEntryById(
  database: DatabaseQueryClient,
  kind: "grammar",
  entryId: string
): Promise<GrammarGlossaryRow | null>;
export async function getGlossaryEntryById(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryId: string
): Promise<TermGlossaryRow | GrammarGlossaryRow | null> {
  const [entry] = await getGlossaryEntriesByIds(database, kind, [entryId]);

  return entry ?? null;
}

export async function getGlossaryEntryBySourceId(
  database: DatabaseQueryClient,
  kind: "term",
  mediaId: string,
  sourceId: string
): Promise<TermGlossaryRow | null>;
export async function getGlossaryEntryBySourceId(
  database: DatabaseQueryClient,
  kind: "grammar",
  mediaId: string,
  sourceId: string
): Promise<GrammarGlossaryRow | null>;
export async function getGlossaryEntryBySourceId(
  database: DatabaseQueryClient,
  kind: EntryType,
  mediaId: string,
  sourceId: string
) {
  return queryGlossaryEntry(
    database,
    kind,
    buildGlossarySourceFilter(kind, mediaId, sourceId)
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

export type GlossarySegment = Awaited<
  ReturnType<typeof listGlossarySegmentsByMediaId>
>[number];
export type TermGlossaryEntry = TermGlossaryRow;
export type GrammarGlossaryEntry = GrammarGlossaryRow;
export type EntryLessonConnection = Awaited<
  ReturnType<typeof listEntryLessonConnections>
>[number];
export type EntryCardConnection = Awaited<
  ReturnType<typeof listEntryCardConnections>
>[number];
export type EntryCardCount = Awaited<
  ReturnType<typeof listEntryCardCounts>
>[number];
export type TermGlossaryEntrySummary = Awaited<
  ReturnType<typeof listTermEntrySummaries>
>[number];
export type GrammarGlossaryEntrySummary = Awaited<
  ReturnType<typeof listGrammarEntrySummaries>
>[number];
export type TermEntryReviewSummary = Awaited<
  ReturnType<typeof listTermEntryReviewSummaries>
>[number];
export type GrammarEntryReviewSummary = Awaited<
  ReturnType<typeof listGrammarEntryReviewSummaries>
>[number];

// ---------------------------------------------------------------------------
// Shell counts — lightweight SQL-only progress for home / media pages
// ---------------------------------------------------------------------------

export type GlossaryShellCounts = {
  mediaId: string;
  entriesTotal: number;
  entriesCovered: number;
};

export async function listGlossaryShellCounts(
  database: DatabaseClient,
  mediaIds: string[]
): Promise<GlossaryShellCounts[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  const mediaIdList = mediaIds.map(quoteSqlString).join(", ");

  const rows = await database.all<{
    mediaId: string;
    entriesTotal: number | string | null;
    entriesCovered: number | string | null;
  }>(`
    WITH all_entries AS (
      SELECT
        t.id AS entry_id,
        'term' AS entry_type,
        t.media_id AS media_id,
        t.cross_media_group_id AS cross_media_group_id
      FROM term t
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        gp.cross_media_group_id AS cross_media_group_id
      FROM grammar_pattern gp
      WHERE gp.media_id IN (${mediaIdList})
    ),
    entry_signals AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        CASE
          -- "known" via card signal
          WHEN EXISTS (
            SELECT 1
            FROM review_subject_state rss
            WHERE rss.entry_type = ae.entry_type
              AND (
                (
                  ae.cross_media_group_id IS NOT NULL
                  AND rss.cross_media_group_id = ae.cross_media_group_id
                )
                OR (
                  ae.cross_media_group_id IS NULL
                  AND rss.entry_id = ae.entry_id
                )
              )
              AND (rss.state = 'known_manual' OR rss.manual_override = 1)
          ) THEN 1
          -- "learning" via card signal
          WHEN EXISTS (
            SELECT 1
            FROM review_subject_state rss
            WHERE rss.entry_type = ae.entry_type
              AND (
                (
                  ae.cross_media_group_id IS NOT NULL
                  AND rss.cross_media_group_id = ae.cross_media_group_id
                )
                OR (
                  ae.cross_media_group_id IS NULL
                  AND rss.entry_id = ae.entry_id
                )
              )
              AND rss.state = 'learning'
          ) THEN 1
          -- "review" via card signal
          WHEN EXISTS (
            SELECT 1
            FROM review_subject_state rss
            WHERE rss.entry_type = ae.entry_type
              AND (
                (
                  ae.cross_media_group_id IS NOT NULL
                  AND rss.cross_media_group_id = ae.cross_media_group_id
                )
                OR (
                  ae.cross_media_group_id IS NULL
                  AND rss.entry_id = ae.entry_id
                )
              )
              AND rss.state IN ('review', 'relearning')
          ) THEN 1
          ELSE 0
        END AS is_covered
      FROM all_entries ae
    )
    SELECT
      media_id AS mediaId,
      COUNT(*) AS entriesTotal,
      SUM(is_covered) AS entriesCovered
    FROM entry_signals
    GROUP BY media_id
  `);

  return rows.map((row) => ({
    mediaId: row.mediaId,
    entriesTotal: Number(row.entriesTotal ?? 0),
    entriesCovered: Number(row.entriesCovered ?? 0)
  }));
}

export type GlossaryProgressSummary = {
  mediaId: string;
  entriesTotal: number;
  entriesCovered: number;
  known: number;
  learning: number;
  review: number;
  new: number;
  available: number;
};

export async function listGlossaryProgressSummaries(
  database: DatabaseClient,
  mediaIds: string[]
): Promise<GlossaryProgressSummary[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  const mediaIdList = mediaIds.map(quoteSqlString).join(", ");

  const rows = await database.all<{
    mediaId: string;
    entriesTotal: number | string | null;
    entriesCovered: number | string | null;
    knownCount: number | string | null;
    learningCount: number | string | null;
    reviewCount: number | string | null;
    newCount: number | string | null;
    availableCount: number | string | null;
  }>(`
    WITH all_entries AS (
      SELECT
        t.id AS entry_id,
        'term' AS entry_type,
        t.media_id AS media_id,
        t.cross_media_group_id AS cross_media_group_id
      FROM term t
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        gp.cross_media_group_id AS cross_media_group_id
      FROM grammar_pattern gp
      WHERE gp.media_id IN (${mediaIdList})
    ),
    grouped_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id = ae.cross_media_group_id
      WHERE ae.cross_media_group_id IS NOT NULL
    ),
    direct_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id IS NULL
        AND rss.entry_id = ae.entry_id
      WHERE ae.cross_media_group_id IS NULL
    ),
    entry_state_matches AS (
      SELECT * FROM grouped_entry_state_matches
      UNION ALL
      SELECT * FROM direct_entry_state_matches
    ),
    entry_signals AS (
      SELECT
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.cross_media_group_id,
        MAX(
          CASE
            WHEN esm.state = 'known_manual' OR esm.manual_override = 1 THEN 1
            ELSE 0
          END
        ) AS is_known,
        MAX(
          CASE
            WHEN esm.state = 'learning' THEN 1
            ELSE 0
          END
        ) AS is_learning,
        MAX(
          CASE
            WHEN esm.state IN ('review', 'relearning') THEN 1
            ELSE 0
          END
        ) AS is_review,
        MAX(
          CASE
            WHEN esm.state = 'new' THEN 1
            ELSE 0
          END
        ) AS is_new
      FROM entry_state_matches esm
      GROUP BY
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.cross_media_group_id
    ),
    entry_states AS (
      SELECT
        media_id,
        CASE
          WHEN is_known = 1 THEN 'known'
          WHEN is_learning = 1 THEN 'learning'
          WHEN is_review = 1 THEN 'review'
          WHEN is_new = 1 THEN 'new'
          ELSE 'available'
        END AS state
      FROM entry_signals
    )
    SELECT
      media_id AS mediaId,
      COUNT(*) AS entriesTotal,
      SUM(CASE WHEN state IN ('known', 'learning', 'review') THEN 1 ELSE 0 END) AS entriesCovered,
      SUM(CASE WHEN state = 'known' THEN 1 ELSE 0 END) AS knownCount,
      SUM(CASE WHEN state = 'learning' THEN 1 ELSE 0 END) AS learningCount,
      SUM(CASE WHEN state = 'review' THEN 1 ELSE 0 END) AS reviewCount,
      SUM(CASE WHEN state = 'new' THEN 1 ELSE 0 END) AS newCount,
      SUM(CASE WHEN state = 'available' THEN 1 ELSE 0 END) AS availableCount
    FROM entry_states
    GROUP BY media_id
  `);

  return rows.map((row) => ({
    mediaId: row.mediaId,
    entriesTotal: Number(row.entriesTotal ?? 0),
    entriesCovered: Number(row.entriesCovered ?? 0),
    known: Number(row.knownCount ?? 0),
    learning: Number(row.learningCount ?? 0),
    review: Number(row.reviewCount ?? 0),
    new: Number(row.newCount ?? 0),
    available: Number(row.availableCount ?? 0)
  }));
}

export type GlossaryPreviewEntryState = {
  mediaId: string;
  mediaSlug: string;
  sourceId: string;
  kind: "term" | "grammar";
  label: string;
  meaningIt: string;
  reading: string | null;
  segmentTitle: string | null;
  state: "known" | "learning" | "review" | "new" | "available";
};

export async function listGlossaryPreviewEntries(
  database: DatabaseClient,
  mediaIds: string[],
  limitPerMedia = 6
): Promise<GlossaryPreviewEntryState[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  const mediaIdList = mediaIds.map(quoteSqlString).join(", ");

  const rows = await database.all<{
    mediaId: string;
    mediaSlug: string;
    sourceId: string;
    entryType: "term" | "grammar";
    label: string;
    meaningIt: string;
    reading: string | null;
    segmentTitle: string | null;
    state: "known" | "learning" | "review" | "new" | "available";
  }>(`
    WITH all_entries AS (
      SELECT
        t.id AS entry_id,
        'term' AS entry_type,
        t.media_id AS media_id,
        t.cross_media_group_id AS cross_media_group_id,
        t.source_id AS source_id,
        t.lemma AS label,
        t.meaning_it AS meaning_it,
        t.reading AS reading,
        s.title AS segment_title
      FROM term t
      LEFT JOIN segment s ON s.id = t.segment_id
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        gp.cross_media_group_id AS cross_media_group_id,
        gp.source_id AS source_id,
        gp.pattern AS label,
        gp.meaning_it AS meaning_it,
        NULL AS reading,
        s.title AS segment_title
      FROM grammar_pattern gp
      LEFT JOIN segment s ON s.id = gp.segment_id
      WHERE gp.media_id IN (${mediaIdList})
    ),
    grouped_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.source_id,
        ae.label,
        ae.meaning_it,
        ae.reading,
        ae.segment_title,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id = ae.cross_media_group_id
      WHERE ae.cross_media_group_id IS NOT NULL
    ),
    direct_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.source_id,
        ae.label,
        ae.meaning_it,
        ae.reading,
        ae.segment_title,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id IS NULL
        AND rss.entry_id = ae.entry_id
      WHERE ae.cross_media_group_id IS NULL
    ),
    entry_state_matches AS (
      SELECT * FROM grouped_entry_state_matches
      UNION ALL
      SELECT * FROM direct_entry_state_matches
    ),
    entry_signals AS (
      SELECT
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.source_id,
        esm.label,
        esm.meaning_it,
        esm.reading,
        esm.segment_title,
        MAX(
          CASE
            WHEN esm.state = 'known_manual' OR esm.manual_override = 1 THEN 1
            ELSE 0
          END
        ) AS is_known,
        MAX(
          CASE
            WHEN esm.state = 'learning' THEN 1
            ELSE 0
          END
        ) AS is_learning,
        MAX(
          CASE
            WHEN esm.state IN ('review', 'relearning') THEN 1
            ELSE 0
          END
        ) AS is_review,
        MAX(
          CASE
            WHEN esm.state = 'new' THEN 1
            ELSE 0
          END
        ) AS is_new
      FROM entry_state_matches esm
      GROUP BY
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.source_id,
        esm.label,
        esm.meaning_it,
        esm.reading,
        esm.segment_title
    ),
    entry_states AS (
      SELECT
        media_id,
        entry_type,
        source_id,
        label,
        meaning_it,
        reading,
        segment_title,
        CASE
          WHEN is_known = 1 THEN 'known'
          WHEN is_learning = 1 THEN 'learning'
          WHEN is_review = 1 THEN 'review'
          WHEN is_new = 1 THEN 'new'
          ELSE 'available'
        END AS state,
        ROW_NUMBER() OVER(
          PARTITION BY media_id
          ORDER BY entry_type DESC, label ASC
        ) as rn
      FROM entry_signals
    )
    SELECT
      es.media_id AS mediaId,
      m.slug AS mediaSlug,
      es.source_id AS sourceId,
      es.entry_type AS entryType,
      es.label AS label,
      es.meaning_it AS meaningIt,
      es.reading AS reading,
      es.segment_title AS segmentTitle,
      es.state AS state
    FROM entry_states es
    INNER JOIN media m ON m.id = es.media_id
    WHERE es.rn <= ${limitPerMedia}
    ORDER BY es.media_id ASC, es.rn ASC
  `);

  return rows.map((row) => ({
    mediaId: row.mediaId,
    mediaSlug: row.mediaSlug,
    sourceId: row.sourceId,
    kind: row.entryType,
    label: row.label,
    meaningIt: row.meaningIt,
    reading: row.reading,
    segmentTitle: row.segmentTitle,
    state: row.state
  }));
}

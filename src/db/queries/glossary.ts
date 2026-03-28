import { and, asc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  buildGlobalGlossaryBrowseScopeQuery,
  buildGrammarAliasMatchClauses,
  buildGrammarBaseMatchClauses,
  buildTermAliasMatchClauses,
  buildTermBaseMatchClauses,
  type GlossarySearchCandidateInput
} from "./glossary-query-helpers.ts";
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

export type GlossarySearchCandidateRef = GlossaryEntryRef & {
  crossMediaGroupId: string | null;
};

export type GlobalGlossaryBrowseGroupRef = {
  crossMediaGroupId: string | null;
  entryType: EntryType;
  internalId: string;
  resultKey: string;
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
  database: DatabaseClient,
  kind: K
): GlossaryQueryLoader<K>;
function getGlossaryQueryLoader<K extends EntryType>(
  database: DatabaseClient,
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
  database: DatabaseClient,
  kind: "term",
  where?: SQL<unknown>
): Promise<TermGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseClient,
  kind: "grammar",
  where?: SQL<unknown>
): Promise<GrammarGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseClient,
  kind: EntryType,
  where?: SQL<unknown>
): Promise<TermGlossaryRow[] | GrammarGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseClient,
  kind: EntryType,
  where?: SQL<unknown>
) {
  return getGlossaryQueryLoader(database, kind).findMany(where) as Promise<
    TermGlossaryRow[] | GrammarGlossaryRow[]
  >;
}

async function queryGlossaryEntry(
  database: DatabaseClient,
  kind: "term",
  where?: SQL<unknown>
): Promise<TermGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseClient,
  kind: "grammar",
  where?: SQL<unknown>
): Promise<GrammarGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseClient,
  kind: EntryType,
  where?: SQL<unknown>
): Promise<TermGlossaryRow | GrammarGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseClient,
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
      crossMediaGroupKey: crossMediaGroup.groupKey
    })
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
    })
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
      searchRomajiNorm: grammarPattern.searchRomajiNorm,
      mediaSlug: media.slug,
      mediaTitle: media.title,
      segmentTitle: segment.title,
      crossMediaGroupKey: crossMediaGroup.groupKey
    })
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
    })
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

export async function listGlossarySearchCandidateRefs(
  database: DatabaseClient,
  input: GlossarySearchCandidateInput
): Promise<GlossarySearchCandidateRef[]> {
  const termBaseClauses =
    input.entryType === "grammar" ? [] : buildTermBaseMatchClauses(input);
  const termAliasClauses =
    input.entryType === "grammar" ? [] : buildTermAliasMatchClauses(input);
  const grammarBaseClauses =
    input.entryType === "term" ? [] : buildGrammarBaseMatchClauses(input);
  const grammarAliasClauses =
    input.entryType === "term" ? [] : buildGrammarAliasMatchClauses(input);
  const queries: Array<Promise<GlossarySearchCandidateRef[]>> = [];

  if (termBaseClauses.length > 0 || termAliasClauses.length > 0) {
    const termSubqueries: string[] = [];
    const termArgs: string[] = [];

    if (termBaseClauses.length > 0) {
      termSubqueries.push(`
        select
          term.id as entryId,
          term.cross_media_group_id as crossMediaGroupId
        from term
        where ${termBaseClauses.map((clause) => clause.sql).join(" or ")}
      `);
      termArgs.push(...termBaseClauses.flatMap((clause) => clause.args));
    }

    if (termAliasClauses.length > 0) {
      termSubqueries.push(`
        select
          term.id as entryId,
          term.cross_media_group_id as crossMediaGroupId
        from term
        inner join term_alias on term_alias.term_id = term.id
        where ${termAliasClauses.map((clause) => clause.sql).join(" or ")}
      `);
      termArgs.push(...termAliasClauses.flatMap((clause) => clause.args));
    }

    const termSql = `
      select distinct
        entryId,
        'term' as entryType,
        crossMediaGroupId
      from (
        ${termSubqueries.join("\n        union\n")}
      )
    `;

    queries.push(
      database.$client
        .execute({
          sql: termSql,
          args: termArgs
        })
        .then((result) =>
          result.rows.map((row) => ({
            crossMediaGroupId:
              typeof row.crossMediaGroupId === "string"
                ? row.crossMediaGroupId
                : null,
            entryId: String(row.entryId),
            entryType: "term" as const
          }))
        )
    );
  }

  if (grammarBaseClauses.length > 0 || grammarAliasClauses.length > 0) {
    const grammarSubqueries: string[] = [];
    const grammarArgs: string[] = [];

    if (grammarBaseClauses.length > 0) {
      grammarSubqueries.push(`
        select
          grammar_pattern.id as entryId,
          grammar_pattern.cross_media_group_id as crossMediaGroupId
        from grammar_pattern
        where ${grammarBaseClauses.map((clause) => clause.sql).join(" or ")}
      `);
      grammarArgs.push(...grammarBaseClauses.flatMap((clause) => clause.args));
    }

    if (grammarAliasClauses.length > 0) {
      grammarSubqueries.push(`
        select
          grammar_pattern.id as entryId,
          grammar_pattern.cross_media_group_id as crossMediaGroupId
        from grammar_pattern
        inner join grammar_alias on grammar_alias.grammar_id = grammar_pattern.id
        where ${grammarAliasClauses.map((clause) => clause.sql).join(" or ")}
      `);
      grammarArgs.push(...grammarAliasClauses.flatMap((clause) => clause.args));
    }

    const grammarSql = `
      select distinct
        entryId,
        'grammar' as entryType,
        crossMediaGroupId
      from (
        ${grammarSubqueries.join("\n        union\n")}
      )
    `;

    queries.push(
      database.$client
        .execute({
          sql: grammarSql,
          args: grammarArgs
        })
        .then((result) =>
          result.rows.map((row) => ({
            crossMediaGroupId:
              typeof row.crossMediaGroupId === "string"
                ? row.crossMediaGroupId
                : null,
            entryId: String(row.entryId),
            entryType: "grammar" as const
          }))
        )
    );
  }

  if (queries.length === 0) {
    return [];
  }

  return (await Promise.all(queries)).flat();
}

export async function countGlobalGlossaryBrowseGroups(
  database: DatabaseClient,
  input: {
    cards: "all" | "with_cards" | "without_cards";
    entryType?: EntryType;
    mediaSlug?: string;
    study?: "known" | "review" | "learning" | "new" | "available";
  }
) {
  const scope = buildGlobalGlossaryBrowseScopeQuery(input);
  const result = await database.$client.execute({
    sql: `
      ${scope.sql}
      select cast(count(*) as integer) as count
      from matching_groups
    `,
    args: scope.args
  });

  return Number(result.rows[0]?.count ?? 0);
}

export async function listGlobalGlossaryBrowseGroupRefs(
  database: DatabaseClient,
  input: {
    cards: "all" | "with_cards" | "without_cards";
    entryType?: EntryType;
    mediaSlug?: string;
    page: number;
    pageSize: number;
    sort?: "alphabetical" | "lesson_order";
    study?: "known" | "review" | "learning" | "new" | "available";
  }
): Promise<GlobalGlossaryBrowseGroupRef[]> {
  const scope = buildGlobalGlossaryBrowseScopeQuery(input);
  const offset = Math.max(input.page - 1, 0) * input.pageSize;
  const orderByClause =
    input.sort === "lesson_order"
      ? `order by
          segmentOrder,
          label,
          entryType,
          orderMediaCount desc,
          mediaSlug,
          sourceId`
      : `order by
          label,
          entryType,
          orderMediaCount desc,
          mediaSlug,
          sourceId`;
  const result = await database.$client.execute({
    sql: `
      ${scope.sql}
      ,
      best_local_candidates as (
        select
          matching_entries.*,
          row_number() over (
            partition by matching_entries.groupToken
            order by
              case when matching_entries.cardCount > 0 then 0 else 1 end,
              matching_entries.mediaTitle,
              matching_entries.kind,
              matching_entries.label,
              matching_entries.mediaSlug,
              matching_entries.sourceId
          ) as rowNumber
        from matching_entries
      ),
      best_locals as (
        select *
        from best_local_candidates
        where rowNumber = 1
      ),
      all_group_stats as (
        select
          resolved_entries.groupToken as groupToken,
          cast(count(distinct resolved_entries.mediaId) as integer) as mediaCount
        from resolved_entries
        inner join matching_groups
          on matching_groups.groupToken = resolved_entries.groupToken
        group by resolved_entries.groupToken
      ),
      matching_group_stats as (
        select
          matching_entries.groupToken as groupToken,
          cast(count(distinct matching_entries.mediaId) as integer) as mediaCount
        from matching_entries
        group by matching_entries.groupToken
      ),
      ordered_groups as (
        select
          best_locals.resultKey as resultKey,
          best_locals.kind as entryType,
          best_locals.internalId as internalId,
          best_locals.crossMediaGroupId as crossMediaGroupId,
          best_locals.segmentOrder as segmentOrder,
          case
            when ? = 'all'
            then coalesce(all_group_stats.mediaCount, 0)
            else coalesce(matching_group_stats.mediaCount, 0)
          end as orderMediaCount,
          best_locals.mediaSlug as mediaSlug,
          best_locals.sourceId as sourceId,
          best_locals.label as label
        from best_locals
        left join all_group_stats
          on all_group_stats.groupToken = best_locals.groupToken
        left join matching_group_stats
          on matching_group_stats.groupToken = best_locals.groupToken
      )
      select
        resultKey,
        entryType,
        internalId,
        crossMediaGroupId
      from ordered_groups
      ${orderByClause}
      limit ? offset ?
    `,
    args: [...scope.args, input.cards, input.pageSize, offset]
  });

  return result.rows.map((row) => ({
    crossMediaGroupId:
      typeof row.crossMediaGroupId === "string" ? row.crossMediaGroupId : null,
    entryType: row.entryType === "grammar" ? "grammar" : "term",
    internalId: String(row.internalId),
    resultKey: String(row.resultKey)
  }));
}

export async function getGlossaryEntriesByIds(
  database: DatabaseClient,
  kind: "term",
  entryIds: string[]
): Promise<TermGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseClient,
  kind: "grammar",
  entryIds: string[]
): Promise<GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseClient,
  kind: EntryType,
  entryIds: string[]
): Promise<TermGlossaryRow[] | GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseClient,
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
  database: DatabaseClient,
  kind: "term",
  groupIds: string[]
): Promise<TermGlossaryRow[]>;
export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseClient,
  kind: "grammar",
  groupIds: string[]
): Promise<GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseClient,
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
  database: DatabaseClient,
  kind: "term",
  entryId: string
): Promise<TermGlossaryRow | null>;
export async function getGlossaryEntryById(
  database: DatabaseClient,
  kind: "grammar",
  entryId: string
): Promise<GrammarGlossaryRow | null>;
export async function getGlossaryEntryById(
  database: DatabaseClient,
  kind: EntryType,
  entryId: string
): Promise<TermGlossaryRow | GrammarGlossaryRow | null> {
  const [entry] = await getGlossaryEntriesByIds(database, kind, [entryId]);

  return entry ?? null;
}

export async function getGlossaryEntryBySourceId(
  database: DatabaseClient,
  kind: "term",
  mediaId: string,
  sourceId: string
): Promise<TermGlossaryRow | null>;
export async function getGlossaryEntryBySourceId(
  database: DatabaseClient,
  kind: "grammar",
  mediaId: string,
  sourceId: string
): Promise<GrammarGlossaryRow | null>;
export async function getGlossaryEntryBySourceId(
  database: DatabaseClient,
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

export async function listCrossMediaFamiliesByEntryIds(
  database: DatabaseClient,
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
  database: DatabaseClient,
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
    entry_signals AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        MAX(
          CASE
            WHEN rss.state = 'known_manual' OR COALESCE(rss.manual_override, 0) = 1 THEN 1
            ELSE 0
          END
        ) AS is_known,
        MAX(
          CASE
            WHEN rss.state = 'learning' THEN 1
            ELSE 0
          END
        ) AS is_learning,
        MAX(
          CASE
            WHEN rss.state IN ('review', 'relearning') THEN 1
            ELSE 0
          END
        ) AS is_review,
        MAX(
          CASE
            WHEN rss.state = 'new' THEN 1
            ELSE 0
          END
        ) AS is_new
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
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
      GROUP BY ae.entry_id, ae.entry_type, ae.media_id, ae.cross_media_group_id
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
    entry_signals AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.source_id,
        ae.label,
        ae.meaning_it,
        ae.reading,
        ae.segment_title,
        MAX(
          CASE
            WHEN rss.state = 'known_manual' OR COALESCE(rss.manual_override, 0) = 1 THEN 1
            ELSE 0
          END
        ) AS is_known,
        MAX(
          CASE
            WHEN rss.state = 'learning' THEN 1
            ELSE 0
          END
        ) AS is_learning,
        MAX(
          CASE
            WHEN rss.state IN ('review', 'relearning') THEN 1
            ELSE 0
          END
        ) AS is_review,
        MAX(
          CASE
            WHEN rss.state = 'new' THEN 1
            ELSE 0
          END
        ) AS is_new
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
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
      GROUP BY ae.entry_id, ae.entry_type, ae.media_id, ae.source_id, ae.label, ae.meaning_it, ae.reading, ae.segment_title
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

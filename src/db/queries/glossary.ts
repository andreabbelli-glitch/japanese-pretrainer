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

export type GlossarySearchCandidateRef = GlossaryEntryRef & {
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

type GlossarySearchCandidateInput = {
  entryType?: EntryType;
  grammarKana: string;
  kana: string;
  normalized: string;
  romajiCompact: string;
};

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function buildTextMatchClause(column: string, value: string) {
  if (!value) {
    return null;
  }

  const escaped = escapeLikePattern(value);

  return {
    args: [value, `${escaped}%`, `%${escaped}%`],
    sql: `(${column} = ? or ${column} like ? escape '\\' or ${column} like ? escape '\\')`
  };
}

function buildTermBaseMatchClauses(input: GlossarySearchCandidateInput) {
  return [
    buildTextMatchClause("term.search_lemma_norm", input.normalized),
    buildTextMatchClause("term.search_reading_norm", input.kana),
    buildTextMatchClause(
      "replace(replace(term.search_romaji_norm, ' ', ''), '-', '')",
      input.romajiCompact
    ),
    buildTextMatchClause("lower(term.meaning_it)", input.normalized),
    buildTextMatchClause("lower(coalesce(term.meaning_literal_it, ''))", input.normalized),
    buildTextMatchClause("lower(coalesce(term.notes_it, ''))", input.normalized)
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);
}

function buildTermAliasMatchClauses(input: GlossarySearchCandidateInput) {
  const clauses = [
    buildTextMatchClause("term_alias.alias_norm", input.normalized),
    buildTextMatchClause("term_alias.alias_norm", input.kana),
    buildTextMatchClause(
      "replace(replace(term_alias.alias_norm, ' ', ''), '-', '')",
      input.romajiCompact
    )
  ];
  const kanaScriptVariant = toKatakana(input.kana);

  if (kanaScriptVariant && kanaScriptVariant !== input.kana) {
    clauses.push(buildTextMatchClause("term_alias.alias_norm", kanaScriptVariant));
  }

  return clauses.filter((clause): clause is NonNullable<typeof clause> => clause !== null);
}

function buildGrammarBaseMatchClauses(input: GlossarySearchCandidateInput) {
  return [
    buildTextMatchClause("grammar_pattern.search_pattern_norm", input.normalized),
    buildTextMatchClause("grammar_pattern.search_pattern_norm", input.grammarKana),
    buildTextMatchClause("lower(coalesce(grammar_pattern.reading, ''))", input.kana),
    buildTextMatchClause("lower(grammar_pattern.title)", input.normalized),
    buildTextMatchClause("lower(grammar_pattern.meaning_it)", input.normalized),
    buildTextMatchClause("lower(coalesce(grammar_pattern.notes_it, ''))", input.normalized)
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);
}

function buildGrammarAliasMatchClauses(input: GlossarySearchCandidateInput) {
  return [
    buildTextMatchClause("grammar_alias.alias_norm", input.normalized),
    buildTextMatchClause("grammar_alias.alias_norm", input.grammarKana),
    buildTextMatchClause(
      "replace(replace(grammar_alias.alias_norm, ' ', ''), '-', '')",
      input.romajiCompact
    )
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);
}

function toKatakana(value: string) {
  return [...value].map((char) => {
    const codePoint = char.codePointAt(0);

    if (!codePoint) {
      return char;
    }

    if (codePoint >= 0x3041 && codePoint <= 0x3096) {
      return String.fromCodePoint(codePoint + 0x60);
    }

    return char;
  }).join("");
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

export async function getTermEntriesByCrossMediaGroupIds(
  database: DatabaseClient,
  groupIds: string[]
) {
  if (groupIds.length === 0) {
    return [];
  }

  const rows = await database.query.term.findMany({
    where: inArray(term.crossMediaGroupId, groupIds),
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

export async function getGrammarEntriesByCrossMediaGroupIds(
  database: DatabaseClient,
  groupIds: string[]
) {
  if (groupIds.length === 0) {
    return [];
  }

  const rows = await database.query.grammarPattern.findMany({
    where: inArray(grammarPattern.crossMediaGroupId, groupIds),
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

export async function getGlobalGlossaryAggregateStats(database: DatabaseClient) {
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
      readCount(termCrossMediaCountResult) + readCount(grammarCrossMediaCountResult),
    entryCount: readCount(termEntryCountResult) + readCount(grammarEntryCountResult),
    withCardsCount:
      readCount(termWithCardsCountResult) + readCount(grammarWithCardsCountResult)
  };
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

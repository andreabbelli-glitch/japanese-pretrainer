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

export type TermCrossMediaFamily = {
  group: CrossMediaGroupRecord | null;
  siblings: CrossMediaTermSibling[];
};

export type GrammarCrossMediaFamily = {
  group: CrossMediaGroupRecord | null;
  siblings: CrossMediaGrammarSibling[];
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
    buildTextMatchClause(
      "lower(coalesce(term.meaning_literal_it, ''))",
      input.normalized
    ),
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
    clauses.push(
      buildTextMatchClause("term_alias.alias_norm", kanaScriptVariant)
    );
  }

  return clauses.filter(
    (clause): clause is NonNullable<typeof clause> => clause !== null
  );
}

function buildGrammarBaseMatchClauses(input: GlossarySearchCandidateInput) {
  return [
    buildTextMatchClause(
      "grammar_pattern.search_pattern_norm",
      input.normalized
    ),
    buildTextMatchClause(
      "grammar_pattern.search_pattern_norm",
      input.grammarKana
    ),
    buildTextMatchClause(
      "lower(coalesce(grammar_pattern.reading, ''))",
      input.kana
    ),
    buildTextMatchClause("lower(grammar_pattern.title)", input.normalized),
    buildTextMatchClause("lower(grammar_pattern.meaning_it)", input.normalized),
    buildTextMatchClause(
      "lower(coalesce(grammar_pattern.notes_it, ''))",
      input.normalized
    )
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
  return [...value]
    .map((char) => {
      const codePoint = char.codePointAt(0);

      if (!codePoint) {
        return char;
      }

      if (codePoint >= 0x3041 && codePoint <= 0x3096) {
        return String.fromCodePoint(codePoint + 0x60);
      }

      return char;
    })
    .join("");
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

function buildGlobalGlossaryBrowseFilterClause(input: {
  cards: "all" | "with_cards" | "without_cards";
  entryType?: EntryType;
  mediaSlug?: string;
  study?: "known" | "review" | "learning" | "new" | "available";
}) {
  const clauses: string[] = [];
  const args: string[] = [];

  if (input.entryType) {
    clauses.push("kind = ?");
    args.push(input.entryType);
  }

  if (input.mediaSlug) {
    clauses.push("mediaSlug = ?");
    args.push(input.mediaSlug);
  }

  if (input.study) {
    clauses.push("studyKey = ?");
    args.push(input.study);
  }

  if (input.cards === "with_cards") {
    clauses.push("cardCount > 0");
  }

  if (input.cards === "without_cards") {
    clauses.push("cardCount = 0");
  }

  return {
    args,
    sql: clauses.length > 0 ? `where ${clauses.join(" and ")}` : ""
  };
}

function buildGlobalGlossaryBrowseScopeQuery(input: {
  cards: "all" | "with_cards" | "without_cards";
  entryType?: EntryType;
  mediaSlug?: string;
  study?: "known" | "review" | "learning" | "new" | "available";
}) {
  const filters = buildGlobalGlossaryBrowseFilterClause(input);

  return {
    args: filters.args,
    sql: `
      with term_entries as (
        select
          'term' as kind,
          term.id as internalId,
          term.source_id as sourceId,
          term.cross_media_group_id as crossMediaGroupId,
          cross_media_group.group_key as crossMediaGroupKey,
          media.id as mediaId,
          media.slug as mediaSlug,
          media.title as mediaTitle,
          term.lemma as label,
          coalesce(segment.order_index, 999999) as segmentOrder,
          entry_status.status as entryStatus,
          cast(count(card.id) as integer) as cardCount,
          max(
            case
              when card.status = 'active'
                and (
                  coalesce(review_state.manual_override, 0) = 1
                  or review_state.state = 'known_manual'
                )
              then 1
              else 0
            end
          ) as hasKnownSignal,
          max(
            case
              when card.status = 'active' and review_state.state = 'learning'
              then 1
              else 0
            end
          ) as hasLearningSignal,
          max(
            case
              when card.status = 'active'
                and review_state.state in ('review', 'relearning')
              then 1
              else 0
            end
          ) as hasReviewSignal,
          max(
            case
              when card.status = 'active' and review_state.state = 'new'
              then 1
              else 0
            end
          ) as hasNewSignal
        from term
        inner join media on media.id = term.media_id
        left join segment on segment.id = term.segment_id
        left join cross_media_group
          on cross_media_group.id = term.cross_media_group_id
        left join entry_status
          on entry_status.entry_type = 'term'
          and entry_status.entry_id = term.id
        left join card_entry_link
          on card_entry_link.entry_type = 'term'
          and card_entry_link.entry_id = term.id
        left join card
          on card.id = card_entry_link.card_id
          and card.status != 'archived'
        left join review_state on review_state.card_id = card.id
        group by
          term.id,
          term.source_id,
          term.cross_media_group_id,
          cross_media_group.group_key,
          media.id,
          media.slug,
          media.title,
          term.lemma,
          segment.order_index,
          entry_status.status
      ),
      grammar_entries as (
        select
          'grammar' as kind,
          grammar_pattern.id as internalId,
          grammar_pattern.source_id as sourceId,
          grammar_pattern.cross_media_group_id as crossMediaGroupId,
          cross_media_group.group_key as crossMediaGroupKey,
          media.id as mediaId,
          media.slug as mediaSlug,
          media.title as mediaTitle,
          grammar_pattern.pattern as label,
          coalesce(segment.order_index, 999999) as segmentOrder,
          entry_status.status as entryStatus,
          cast(count(card.id) as integer) as cardCount,
          max(
            case
              when card.status = 'active'
                and (
                  coalesce(review_state.manual_override, 0) = 1
                  or review_state.state = 'known_manual'
                )
              then 1
              else 0
            end
          ) as hasKnownSignal,
          max(
            case
              when card.status = 'active' and review_state.state = 'learning'
              then 1
              else 0
            end
          ) as hasLearningSignal,
          max(
            case
              when card.status = 'active'
                and review_state.state in ('review', 'relearning')
              then 1
              else 0
            end
          ) as hasReviewSignal,
          max(
            case
              when card.status = 'active' and review_state.state = 'new'
              then 1
              else 0
            end
          ) as hasNewSignal
        from grammar_pattern
        inner join media on media.id = grammar_pattern.media_id
        left join segment on segment.id = grammar_pattern.segment_id
        left join cross_media_group
          on cross_media_group.id = grammar_pattern.cross_media_group_id
        left join entry_status
          on entry_status.entry_type = 'grammar'
          and entry_status.entry_id = grammar_pattern.id
        left join card_entry_link
          on card_entry_link.entry_type = 'grammar'
          and card_entry_link.entry_id = grammar_pattern.id
        left join card
          on card.id = card_entry_link.card_id
          and card.status != 'archived'
        left join review_state on review_state.card_id = card.id
        group by
          grammar_pattern.id,
          grammar_pattern.source_id,
          grammar_pattern.cross_media_group_id,
          cross_media_group.group_key,
          media.id,
          media.slug,
          media.title,
          grammar_pattern.pattern,
          segment.order_index,
          entry_status.status
      ),
      glossary_entries as (
        select * from term_entries
        union all
        select * from grammar_entries
      ),
      resolved_entries as (
        select
          *,
          case
            when entryStatus = 'known_manual' or hasKnownSignal = 1 then 'known'
            when hasLearningSignal = 1 then 'learning'
            when hasReviewSignal = 1
              or entryStatus in ('review', 'reviewing', 'relearning')
            then 'review'
            when entryStatus = 'learning' then 'learning'
            when entryStatus in ('new', 'unknown') or hasNewSignal = 1 then 'new'
            else 'available'
          end as studyKey,
          case
            when crossMediaGroupKey is not null
            then kind || ':group:' || crossMediaGroupKey
            else kind || ':entry:' || internalId
          end as resultKey,
          case
            when crossMediaGroupId is not null
            then kind || ':group:' || crossMediaGroupId
            else kind || ':entry:' || internalId
          end as groupToken
        from glossary_entries
      ),
      matching_entries as (
        select *
        from resolved_entries
        ${filters.sql}
      ),
      matching_groups as (
        select distinct groupToken
        from matching_entries
      )
    `
  };
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

export async function listTermCrossMediaFamiliesByEntryIds(
  database: DatabaseClient,
  entryIds: string[]
): Promise<Map<string, TermCrossMediaFamily>> {
  const requestedEntryIds = [...new Set(entryIds)];

  if (requestedEntryIds.length === 0) {
    return new Map();
  }

  const families = new Map<string, TermCrossMediaFamily>(
    requestedEntryIds.map((entryId) => [
      entryId,
      {
        group: null,
        siblings: []
      }
    ])
  );
  const rows = await database.query.term.findMany({
    where: inArray(term.id, requestedEntryIds)
  });
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

  const siblingRows = await database
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
    .where(inArray(term.crossMediaGroupId, validGroupIds))
    .orderBy(asc(media.title), asc(term.lemma), asc(term.reading));

  const siblingsByGroupId = new Map<string, CrossMediaTermSibling[]>();

  for (const row of siblingRows) {
    const siblings = siblingsByGroupId.get(row.groupId);

    if (siblings) {
      siblings.push(row);
      continue;
    }

    siblingsByGroupId.set(row.groupId, [row]);
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

export async function getTermCrossMediaFamilyByEntryId(
  database: DatabaseClient,
  entryId: string
): Promise<TermCrossMediaFamily> {
  return (
    (await listTermCrossMediaFamiliesByEntryIds(database, [entryId])).get(
      entryId
    ) ?? {
      group: null,
      siblings: []
    }
  );
}

export async function listGrammarCrossMediaFamiliesByEntryIds(
  database: DatabaseClient,
  entryIds: string[]
): Promise<Map<string, GrammarCrossMediaFamily>> {
  const requestedEntryIds = [...new Set(entryIds)];

  if (requestedEntryIds.length === 0) {
    return new Map();
  }

  const families = new Map<string, GrammarCrossMediaFamily>(
    requestedEntryIds.map((entryId) => [
      entryId,
      {
        group: null,
        siblings: []
      }
    ])
  );
  const rows = await database.query.grammarPattern.findMany({
    where: inArray(grammarPattern.id, requestedEntryIds)
  });
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

  const siblingRows = await database
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
    .where(inArray(grammarPattern.crossMediaGroupId, validGroupIds))
    .orderBy(
      asc(media.title),
      asc(grammarPattern.pattern),
      asc(grammarPattern.title)
    );

  const siblingsByGroupId = new Map<string, CrossMediaGrammarSibling[]>();

  for (const row of siblingRows) {
    const siblings = siblingsByGroupId.get(row.groupId);

    if (siblings) {
      siblings.push(row);
      continue;
    }

    siblingsByGroupId.set(row.groupId, [row]);
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

export async function getGrammarCrossMediaFamilyByEntryId(
  database: DatabaseClient,
  entryId: string
): Promise<GrammarCrossMediaFamily> {
  return (
    (await listGrammarCrossMediaFamiliesByEntryIds(database, [entryId])).get(
      entryId
    ) ?? {
      group: null,
      siblings: []
    }
  );
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

  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const mediaIdList = mediaIds.map(quote).join(", ");

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
        es.status AS entry_status
      FROM term t
      LEFT JOIN entry_status es
        ON es.entry_id = t.id
       AND es.entry_type = 'term'
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        es.status AS entry_status
      FROM grammar_pattern gp
      LEFT JOIN entry_status es
        ON es.entry_id = gp.id
       AND es.entry_type = 'grammar'
      WHERE gp.media_id IN (${mediaIdList})
    ),
    entry_signals AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.entry_status,
        CASE
          -- "known" via entry status
          WHEN ae.entry_status = 'known_manual' THEN 1
          -- "known" via card signal
          WHEN EXISTS (
            SELECT 1
            FROM card_entry_link cel
            JOIN card c ON c.id = cel.card_id
            JOIN review_state rs ON rs.card_id = c.id
            WHERE cel.entry_id = ae.entry_id
              AND cel.entry_type = ae.entry_type
              AND (rs.state = 'known_manual' OR rs.manual_override = 1)
          ) THEN 1
          -- "learning" via card signal
          WHEN EXISTS (
            SELECT 1
            FROM card_entry_link cel
            JOIN card c ON c.id = cel.card_id
            JOIN review_state rs ON rs.card_id = c.id
            WHERE cel.entry_id = ae.entry_id
              AND cel.entry_type = ae.entry_type
              AND rs.state = 'learning'
          ) THEN 1
          -- "review" via card signal
          WHEN EXISTS (
            SELECT 1
            FROM card_entry_link cel
            JOIN card c ON c.id = cel.card_id
            JOIN review_state rs ON rs.card_id = c.id
            WHERE cel.entry_id = ae.entry_id
              AND cel.entry_type = ae.entry_type
              AND rs.state IN ('review', 'relearning')
          ) THEN 1
          -- "review/learning" via entry status alone
          WHEN ae.entry_status IN ('review', 'reviewing', 'relearning', 'learning') THEN 1
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

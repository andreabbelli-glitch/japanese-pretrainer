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
import { type EntryType } from "../schema/index.ts";

export type GlossarySearchCandidateRef = {
  crossMediaGroupId: string | null;
  entryId: string;
  entryType: EntryType;
};

export type GlobalGlossaryBrowseGroupRef = {
  crossMediaGroupId: string | null;
  entryType: EntryType;
  internalId: string;
  resultKey: string;
  totalCount: number;
};

type GlossarySearchMatchClause = {
  args: string[];
  sql: string;
};

type GlossarySearchCandidateQueryConfig = {
  aliasJoinSql: string;
  aliasMatchClauses: GlossarySearchMatchClause[];
  baseMatchClauses: GlossarySearchMatchClause[];
  crossMediaGroupIdColumn: string;
  entryIdColumn: string;
  entryType: EntryType;
  mediaIdColumn: string;
  tableName: string;
};

function buildGlossarySearchCandidateSubquery(
  selectFromTableSql: string,
  entryIdColumn: string,
  crossMediaGroupIdColumn: string,
  clauses: GlossarySearchMatchClause[],
  scopeClauses: GlossarySearchMatchClause[]
) {
  if (clauses.length === 0) {
    return null;
  }

  return {
    args: [...clauses, ...scopeClauses].flatMap((clause) => clause.args),
    sql: `
      select
        ${entryIdColumn} as entryId,
        ${crossMediaGroupIdColumn} as crossMediaGroupId
      ${selectFromTableSql}
      where (${clauses.map((clause) => clause.sql).join(" or ")})
        ${scopeClauses.map((clause) => `and (${clause.sql})`).join("\n        ")}
    `
  };
}

function buildGlossarySearchCandidateScopeClauses(
  config: GlossarySearchCandidateQueryConfig,
  input: GlossarySearchCandidateInput
) {
  const clauses: GlossarySearchMatchClause[] = [];

  if (input.mediaSlug) {
    clauses.push({
      args: [input.mediaSlug],
      sql: `exists (
        select 1
        from media search_scope_media
        where search_scope_media.id = ${config.mediaIdColumn}
          and search_scope_media.slug = ?
      )`
    });
  }

  if (input.cards === "with_cards") {
    clauses.push({
      args: [],
      sql: buildGlossaryCardExistsSql(config)
    });
  } else if (input.cards === "without_cards") {
    clauses.push({
      args: [],
      sql: `not ${buildGlossaryCardExistsSql(config)}`
    });
  }

  if (input.study) {
    clauses.push({
      args: [],
      sql: buildGlossaryStudyScopeSql(config, input.study)
    });
  }

  return clauses;
}

function buildGlossaryCardExistsSql(
  config: GlossarySearchCandidateQueryConfig
) {
  const entryTypeSql = quoteSqlString(config.entryType);

  return `exists (
    select 1
    from card_entry_link search_scope_card_link
    inner join card search_scope_card
      on search_scope_card.id = search_scope_card_link.card_id
      and search_scope_card.status != 'archived'
    where search_scope_card_link.entry_type = ${entryTypeSql}
      and search_scope_card_link.entry_id = ${config.entryIdColumn}
  )`;
}

function buildGlossaryStudyScopeSql(
  config: GlossarySearchCandidateQueryConfig,
  study: NonNullable<GlossarySearchCandidateInput["study"]>
) {
  const signals = {
    known: buildGlossaryStudySignalExistsSql(
      config,
      "coalesce(search_scope_state.manual_override, 0) = 1 or search_scope_state.state = 'known_manual'"
    ),
    learning: buildGlossaryStudySignalExistsSql(
      config,
      "search_scope_state.state = 'learning'"
    ),
    review: buildGlossaryStudySignalExistsSql(
      config,
      "search_scope_state.state in ('review', 'relearning')"
    ),
    new: buildGlossaryStudySignalExistsSql(
      config,
      "search_scope_state.state = 'new'"
    )
  };
  const without = (...keys: Array<keyof typeof signals>) =>
    keys.map((key) => `not ${signals[key]}`).join(" and ");

  switch (study) {
    case "known":
      return signals.known;
    case "learning":
      return `${without("known")} and ${signals.learning}`;
    case "review":
      return `${without("known", "learning")} and ${signals.review}`;
    case "new":
      return `${without("known", "learning", "review")} and ${signals.new}`;
    case "available":
      return without("known", "learning", "review", "new");
  }
}

function buildGlossaryStudySignalExistsSql(
  config: GlossarySearchCandidateQueryConfig,
  signalConditionSql: string
) {
  const entryTypeSql = quoteSqlString(config.entryType);

  return `exists (
    select 1
    from card_entry_link search_scope_study_link
    inner join card search_scope_study_card
      on search_scope_study_card.id = search_scope_study_link.card_id
      and search_scope_study_card.status = 'active'
    left join review_subject_state search_scope_state
      on search_scope_state.entry_type = ${entryTypeSql}
      and (
        (
          ${config.crossMediaGroupIdColumn} is not null
          and search_scope_state.cross_media_group_id = ${config.crossMediaGroupIdColumn}
        )
        or (
          ${config.crossMediaGroupIdColumn} is null
          and search_scope_state.cross_media_group_id is null
          and search_scope_state.entry_id = ${config.entryIdColumn}
        )
      )
    where search_scope_study_link.entry_type = ${entryTypeSql}
      and search_scope_study_link.entry_id = ${config.entryIdColumn}
      and (${signalConditionSql})
  )`;
}

async function executeGlossarySearchCandidateQuery(
  database: DatabaseClient,
  config: GlossarySearchCandidateQueryConfig,
  input: GlossarySearchCandidateInput
) {
  const scopeClauses = buildGlossarySearchCandidateScopeClauses(config, input);
  const subqueries = [
    buildGlossarySearchCandidateSubquery(
      `from ${config.tableName}`,
      config.entryIdColumn,
      config.crossMediaGroupIdColumn,
      config.baseMatchClauses,
      scopeClauses
    ),
    buildGlossarySearchCandidateSubquery(
      `from ${config.tableName}\n        ${config.aliasJoinSql}`,
      config.entryIdColumn,
      config.crossMediaGroupIdColumn,
      config.aliasMatchClauses,
      scopeClauses
    )
  ].filter(
    (
      query
    ): query is {
      args: string[];
      sql: string;
    } => query !== null
  );

  if (subqueries.length === 0) {
    return [];
  }

  const resolvedLimit =
    typeof input.limit === "number" &&
    Number.isFinite(input.limit) &&
    input.limit > 0
      ? Math.floor(input.limit)
      : null;
  const result = await database.$client.execute({
    sql: `
      select distinct
        entryId,
        ${quoteSqlString(config.entryType)} as entryType,
        crossMediaGroupId
      from (
        ${subqueries.map((query) => query.sql).join("\n        union\n")}
      )
      ${resolvedLimit === null ? "" : "limit ?"}
    `,
    args: [
      ...subqueries.flatMap((query) => query.args),
      ...(resolvedLimit === null ? [] : [resolvedLimit])
    ]
  });

  return result.rows.map((row) => ({
    crossMediaGroupId:
      typeof row.crossMediaGroupId === "string" ? row.crossMediaGroupId : null,
    entryId: String(row.entryId),
    entryType: config.entryType
  }));
}

export async function listGlossarySearchCandidateRefs(
  database: DatabaseClient,
  input: GlossarySearchCandidateInput
): Promise<GlossarySearchCandidateRef[]> {
  const [termRefs, grammarRefs] = await Promise.all([
    input.entryType === "grammar"
      ? Promise.resolve<GlossarySearchCandidateRef[]>([])
      : executeGlossarySearchCandidateQuery(
          database,
          {
            aliasJoinSql:
              "inner join term_alias on term_alias.term_id = term.id",
            aliasMatchClauses: buildTermAliasMatchClauses(input),
            baseMatchClauses: buildTermBaseMatchClauses(input),
            crossMediaGroupIdColumn: "term.cross_media_group_id",
            entryIdColumn: "term.id",
            entryType: "term",
            mediaIdColumn: "term.media_id",
            tableName: "term"
          },
          input
        ),
    input.entryType === "term"
      ? Promise.resolve<GlossarySearchCandidateRef[]>([])
      : executeGlossarySearchCandidateQuery(
          database,
          {
            aliasJoinSql:
              "inner join grammar_alias on grammar_alias.grammar_id = grammar_pattern.id",
            aliasMatchClauses: buildGrammarAliasMatchClauses(input),
            baseMatchClauses: buildGrammarBaseMatchClauses(input),
            crossMediaGroupIdColumn: "grammar_pattern.cross_media_group_id",
            entryIdColumn: "grammar_pattern.id",
            entryType: "grammar",
            mediaIdColumn: "grammar_pattern.media_id",
            tableName: "grammar_pattern"
          },
          input
        )
  ]);

  return [...termRefs, ...grammarRefs];
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
        crossMediaGroupId,
        cast(count(*) over () as integer) as totalCount
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
    resultKey: String(row.resultKey),
    totalCount: Number(row.totalCount ?? 0)
  }));
}

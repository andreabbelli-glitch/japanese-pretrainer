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
  tableName: string;
};

function buildGlossarySearchCandidateSubquery(
  selectFromTableSql: string,
  entryIdColumn: string,
  crossMediaGroupIdColumn: string,
  clauses: GlossarySearchMatchClause[]
) {
  if (clauses.length === 0) {
    return null;
  }

  return {
    args: clauses.flatMap((clause) => clause.args),
    sql: `
      select
        ${entryIdColumn} as entryId,
        ${crossMediaGroupIdColumn} as crossMediaGroupId
      ${selectFromTableSql}
      where ${clauses.map((clause) => clause.sql).join(" or ")}
    `
  };
}

async function executeGlossarySearchCandidateQuery(
  database: DatabaseClient,
  config: GlossarySearchCandidateQueryConfig
) {
  const subqueries = [
    buildGlossarySearchCandidateSubquery(
      `from ${config.tableName}`,
      config.entryIdColumn,
      config.crossMediaGroupIdColumn,
      config.baseMatchClauses
    ),
    buildGlossarySearchCandidateSubquery(
      `from ${config.tableName}\n        ${config.aliasJoinSql}`,
      config.entryIdColumn,
      config.crossMediaGroupIdColumn,
      config.aliasMatchClauses
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

  const result = await database.$client.execute({
    sql: `
      select distinct
        entryId,
        ${quoteSqlString(config.entryType)} as entryType,
        crossMediaGroupId
      from (
        ${subqueries.map((query) => query.sql).join("\n        union\n")}
      )
    `,
    args: subqueries.flatMap((query) => query.args)
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
      : executeGlossarySearchCandidateQuery(database, {
          aliasJoinSql: "inner join term_alias on term_alias.term_id = term.id",
          aliasMatchClauses: buildTermAliasMatchClauses(input),
          baseMatchClauses: buildTermBaseMatchClauses(input),
          crossMediaGroupIdColumn: "term.cross_media_group_id",
          entryIdColumn: "term.id",
          entryType: "term",
          tableName: "term"
        }),
    input.entryType === "term"
      ? Promise.resolve<GlossarySearchCandidateRef[]>([])
      : executeGlossarySearchCandidateQuery(database, {
          aliasJoinSql:
            "inner join grammar_alias on grammar_alias.grammar_id = grammar_pattern.id",
          aliasMatchClauses: buildGrammarAliasMatchClauses(input),
          baseMatchClauses: buildGrammarBaseMatchClauses(input),
          crossMediaGroupIdColumn: "grammar_pattern.cross_media_group_id",
          entryIdColumn: "grammar_pattern.id",
          entryType: "grammar",
          tableName: "grammar_pattern"
        })
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

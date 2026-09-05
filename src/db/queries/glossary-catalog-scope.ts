/**
 * Browse ordering needs only card presence without a study-state filter.
 * Materialize once: ranking and media counts reuse these same entry rows.
 */
export function buildGlobalGlossaryCatalogScopeQuery(filters: {
  args: string[];
  sql: string;
}) {
  const branches = [
    ["term", "term", "lemma"],
    ["grammar", "grammar_pattern", "pattern"]
  ].map(
    ([kind, table, label]) => `
      select
        '${kind}' as kind,
        entry.id as internalId,
        entry.source_id as sourceId,
        entry.cross_media_group_id as crossMediaGroupId,
        cross_media_group.group_key as crossMediaGroupKey,
        media.id as mediaId,
        media.slug as mediaSlug,
        media.title as mediaTitle,
        entry.${label} as label,
        coalesce(segment.order_index, 999999) as segmentOrder,
        exists (
          select 1
          from card_entry_link
          inner join card on card.id = card_entry_link.card_id
          where card_entry_link.entry_type = '${kind}'
            and card_entry_link.entry_id = entry.id
            and card.status != 'archived'
        ) as cardCount
      from ${table} entry
      inner join media on media.id = entry.media_id
      left join segment on segment.id = entry.segment_id
      left join cross_media_group
        on cross_media_group.id = entry.cross_media_group_id
    `
  );

  return {
    args: filters.args,
    sql: `
      with glossary_entries as (
        ${branches.join(" union all ")}
      ),
      resolved_entries as materialized (
        select
          *,
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
        select * from resolved_entries
        ${filters.sql}
      ),
      matching_groups as (
        select distinct groupToken from matching_entries
      )
    `
  };
}

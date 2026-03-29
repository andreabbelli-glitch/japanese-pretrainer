import type { EntryType } from "../schema/index.ts";

export type GlossarySearchCandidateInput = {
  entryType?: EntryType;
  grammarKana: string;
  kana: string;
  normalized: string;
  romajiCompact: string;
};

type TextMatchClause = {
  args: string[];
  sql: string;
};

export type GlobalGlossaryBrowseScopeInput = {
  cards: "all" | "with_cards" | "without_cards";
  entryType?: EntryType;
  mediaSlug?: string;
  study?: "known" | "review" | "learning" | "new" | "available";
};

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function buildTextMatchClause(
  column: string,
  value: string
): TextMatchClause | null {
  if (!value) {
    return null;
  }

  const escaped = escapeLikePattern(value);

  return {
    args: [value, `${escaped}%`, `%${escaped}%`],
    sql: `(${column} = ? or ${column} like ? escape '\\' or ${column} like ? escape '\\')`
  };
}

export function buildTermBaseMatchClauses(
  input: GlossarySearchCandidateInput
) {
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
  ].filter((clause): clause is TextMatchClause => clause !== null);
}

export function buildTermAliasMatchClauses(
  input: GlossarySearchCandidateInput
) {
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

  return clauses.filter((clause): clause is TextMatchClause => clause !== null);
}

export function buildGrammarBaseMatchClauses(
  input: GlossarySearchCandidateInput
) {
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
    buildTextMatchClause(
      "grammar_pattern.search_romaji_norm",
      input.romajiCompact
    ),
    buildTextMatchClause("lower(grammar_pattern.title)", input.normalized),
    buildTextMatchClause("lower(grammar_pattern.meaning_it)", input.normalized),
    buildTextMatchClause(
      "lower(coalesce(grammar_pattern.notes_it, ''))",
      input.normalized
    )
  ].filter((clause): clause is TextMatchClause => clause !== null);
}

export function buildGrammarAliasMatchClauses(
  input: GlossarySearchCandidateInput
) {
  return [
    buildTextMatchClause("grammar_alias.alias_norm", input.normalized),
    buildTextMatchClause("grammar_alias.alias_norm", input.grammarKana),
    buildTextMatchClause(
      "replace(replace(grammar_alias.alias_norm, ' ', ''), '-', '')",
      input.romajiCompact
    )
  ].filter((clause): clause is TextMatchClause => clause !== null);
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

function buildGlobalGlossaryBrowseFilterClause(
  input: GlobalGlossaryBrowseScopeInput
) {
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

export function buildGlobalGlossaryBrowseScopeQuery(
  input: GlobalGlossaryBrowseScopeInput
) {
  const filters = buildGlobalGlossaryBrowseFilterClause(input);

  return {
    args: filters.args,
    sql: `
      with term_grouped_entries as (
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
          cast(count(card.id) as integer) as cardCount,
          max(
            case
              when card.status = 'active'
                and (
                  coalesce(review_subject_state.manual_override, 0) = 1
                  or review_subject_state.state = 'known_manual'
                )
              then 1
              else 0
            end
          ) as hasKnownSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'learning'
              then 1
              else 0
            end
          ) as hasLearningSignal,
          max(
            case
              when card.status = 'active'
                and review_subject_state.state in ('review', 'relearning')
              then 1
              else 0
            end
          ) as hasReviewSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'new'
              then 1
              else 0
            end
          ) as hasNewSignal
        from term
        inner join media on media.id = term.media_id
        left join segment on segment.id = term.segment_id
        left join cross_media_group
          on cross_media_group.id = term.cross_media_group_id
        left join card_entry_link
          on card_entry_link.entry_type = 'term'
          and card_entry_link.entry_id = term.id
        left join card
          on card.id = card_entry_link.card_id
          and card.status != 'archived'
        left join review_subject_state
          on review_subject_state.entry_type = 'term'
          and review_subject_state.cross_media_group_id in (
            term.cross_media_group_id,
            cross_media_group.group_key
          )
        where term.cross_media_group_id is not null
        group by
          term.id,
          term.source_id,
          term.cross_media_group_id,
          cross_media_group.group_key,
          media.id,
          media.slug,
          media.title,
          term.lemma,
          segment.order_index
      ),
      term_direct_entries as (
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
          cast(count(card.id) as integer) as cardCount,
          max(
            case
              when card.status = 'active'
                and (
                  coalesce(review_subject_state.manual_override, 0) = 1
                  or review_subject_state.state = 'known_manual'
                )
              then 1
              else 0
            end
          ) as hasKnownSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'learning'
              then 1
              else 0
            end
          ) as hasLearningSignal,
          max(
            case
              when card.status = 'active'
                and review_subject_state.state in ('review', 'relearning')
              then 1
              else 0
            end
          ) as hasReviewSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'new'
              then 1
              else 0
            end
          ) as hasNewSignal
        from term
        inner join media on media.id = term.media_id
        left join segment on segment.id = term.segment_id
        left join cross_media_group
          on cross_media_group.id = term.cross_media_group_id
        left join card_entry_link
          on card_entry_link.entry_type = 'term'
          and card_entry_link.entry_id = term.id
        left join card
          on card.id = card_entry_link.card_id
          and card.status != 'archived'
        left join review_subject_state
          on review_subject_state.entry_type = 'term'
          and review_subject_state.cross_media_group_id is null
          and review_subject_state.entry_id = term.id
        where term.cross_media_group_id is null
        group by
          term.id,
          term.source_id,
          term.cross_media_group_id,
          cross_media_group.group_key,
          media.id,
          media.slug,
          media.title,
          term.lemma,
          segment.order_index
      ),
      term_entries as (
        select * from term_grouped_entries
        union all
        select * from term_direct_entries
      ),
      grammar_grouped_entries as (
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
          cast(count(card.id) as integer) as cardCount,
          max(
            case
              when card.status = 'active'
                and (
                  coalesce(review_subject_state.manual_override, 0) = 1
                  or review_subject_state.state = 'known_manual'
                )
              then 1
              else 0
            end
          ) as hasKnownSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'learning'
              then 1
              else 0
            end
          ) as hasLearningSignal,
          max(
            case
              when card.status = 'active'
                and review_subject_state.state in ('review', 'relearning')
              then 1
              else 0
            end
          ) as hasReviewSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'new'
              then 1
              else 0
            end
          ) as hasNewSignal
        from grammar_pattern
        inner join media on media.id = grammar_pattern.media_id
        left join segment on segment.id = grammar_pattern.segment_id
        left join cross_media_group
          on cross_media_group.id = grammar_pattern.cross_media_group_id
        left join card_entry_link
          on card_entry_link.entry_type = 'grammar'
          and card_entry_link.entry_id = grammar_pattern.id
        left join card
          on card.id = card_entry_link.card_id
          and card.status != 'archived'
        left join review_subject_state
          on review_subject_state.entry_type = 'grammar'
          and review_subject_state.cross_media_group_id in (
            grammar_pattern.cross_media_group_id,
            cross_media_group.group_key
          )
        where grammar_pattern.cross_media_group_id is not null
        group by
          grammar_pattern.id,
          grammar_pattern.source_id,
          grammar_pattern.cross_media_group_id,
          cross_media_group.group_key,
          media.id,
          media.slug,
          media.title,
          grammar_pattern.pattern,
          segment.order_index
      ),
      grammar_direct_entries as (
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
          cast(count(card.id) as integer) as cardCount,
          max(
            case
              when card.status = 'active'
                and (
                  coalesce(review_subject_state.manual_override, 0) = 1
                  or review_subject_state.state = 'known_manual'
                )
              then 1
              else 0
            end
          ) as hasKnownSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'learning'
              then 1
              else 0
            end
          ) as hasLearningSignal,
          max(
            case
              when card.status = 'active'
                and review_subject_state.state in ('review', 'relearning')
              then 1
              else 0
            end
          ) as hasReviewSignal,
          max(
            case
              when card.status = 'active' and review_subject_state.state = 'new'
              then 1
              else 0
            end
          ) as hasNewSignal
        from grammar_pattern
        inner join media on media.id = grammar_pattern.media_id
        left join segment on segment.id = grammar_pattern.segment_id
        left join cross_media_group
          on cross_media_group.id = grammar_pattern.cross_media_group_id
        left join card_entry_link
          on card_entry_link.entry_type = 'grammar'
          and card_entry_link.entry_id = grammar_pattern.id
        left join card
          on card.id = card_entry_link.card_id
          and card.status != 'archived'
        left join review_subject_state
          on review_subject_state.entry_type = 'grammar'
          and review_subject_state.cross_media_group_id is null
          and review_subject_state.entry_id = grammar_pattern.id
        where grammar_pattern.cross_media_group_id is null
        group by
          grammar_pattern.id,
          grammar_pattern.source_id,
          grammar_pattern.cross_media_group_id,
          cross_media_group.group_key,
          media.id,
          media.slug,
          media.title,
          grammar_pattern.pattern,
          segment.order_index
      ),
      grammar_entries as (
        select * from grammar_grouped_entries
        union all
        select * from grammar_direct_entries
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
            when hasKnownSignal = 1 then 'known'
            when hasLearningSignal = 1 then 'learning'
            when hasReviewSignal = 1 then 'review'
            when hasNewSignal = 1 then 'new'
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

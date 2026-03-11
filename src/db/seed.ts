import { sql } from "drizzle-orm";

import { db, type DatabaseClient } from "./client.ts";
import { buildScopedEntryId } from "../lib/entry-id.ts";
import {
  card,
  cardEntryLink,
  contentImport,
  entryLink,
  entryStatus,
  grammarAlias,
  grammarPattern,
  lesson,
  lessonContent,
  lessonProgress,
  media,
  mediaProgress,
  reviewLog,
  reviewState,
  segment,
  term,
  termAlias,
  userSetting
} from "./schema/index.ts";

export const developmentFixture = {
  mediaId: "media_fixture_tcg",
  mediaSlug: "fixture-tcg",
  segmentId: "segment_fixture_starter_core",
  lessonId: "lesson_fixture_core_vocab",
  importId: "import_fixture_initial",
  termId: "term_fixture_iku",
  grammarId: "grammar_fixture_teiru",
  termDbId: buildScopedEntryId("term", "media_fixture_tcg", "term_fixture_iku"),
  grammarDbId: buildScopedEntryId(
    "grammar",
    "media_fixture_tcg",
    "grammar_fixture_teiru"
  ),
  primaryCardId: "card_fixture_iku",
  secondaryCardId: "card_fixture_teiru"
} as const;

const createdAt = "2026-03-08T09:00:00.000Z";
const updatedAt = "2026-03-08T09:30:00.000Z";
const dueSoonAt = "2026-03-09T08:00:00.000Z";
const dueLaterAt = "2026-03-12T08:00:00.000Z";

export async function seedDevelopmentDatabase(
  database: DatabaseClient = db
): Promise<void> {
  await database.transaction(async (tx) => {
    await tx
      .insert(contentImport)
      .values({
        id: developmentFixture.importId,
        startedAt: createdAt,
        finishedAt: updatedAt,
        status: "completed",
        filesScanned: 3,
        filesChanged: 3,
        message: "Initial fixture import."
      })
      .onConflictDoUpdate({
        target: contentImport.id,
        set: {
          startedAt: createdAt,
          finishedAt: updatedAt,
          status: "completed",
          filesScanned: 3,
          filesChanged: 3,
          message: "Initial fixture import."
        }
      });

    await tx
      .insert(media)
      .values({
        id: developmentFixture.mediaId,
        slug: developmentFixture.mediaSlug,
        title: "Fixture TCG",
        mediaType: "tcg",
        segmentKind: "deck",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture tecnica minima per validare il layer database.",
        status: "active",
        createdAt,
        updatedAt
      })
      .onConflictDoUpdate({
        target: media.id,
        set: {
          slug: developmentFixture.mediaSlug,
          title: "Fixture TCG",
          mediaType: "tcg",
          segmentKind: "deck",
          language: "ja",
          baseExplanationLanguage: "it",
          description: "Fixture tecnica minima per validare il layer database.",
          status: "active",
          createdAt,
          updatedAt
        }
      });

    await tx
      .insert(segment)
      .values({
        id: developmentFixture.segmentId,
        mediaId: developmentFixture.mediaId,
        slug: "starter-core",
        title: "Starter Core",
        orderIndex: 1,
        segmentType: "deck",
        notes: "Segmento tecnico minimo per i test del database."
      })
      .onConflictDoUpdate({
        target: segment.id,
        set: {
          mediaId: developmentFixture.mediaId,
          slug: "starter-core",
          title: "Starter Core",
          orderIndex: 1,
          segmentType: "deck",
          notes: "Segmento tecnico minimo per i test del database."
        }
      });

    await tx
      .insert(lesson)
      .values({
        id: developmentFixture.lessonId,
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        slug: "core-vocab",
        title: "Core Vocabulary",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lezione fixture minima importata nel DB locale.",
        status: "active",
        sourceFile: "tests/fixtures/db/fixture-tcg/textbook/core-vocab.md",
        createdAt,
        updatedAt
      })
      .onConflictDoUpdate({
        target: lesson.id,
        set: {
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          slug: "core-vocab",
          title: "Core Vocabulary",
          orderIndex: 1,
          difficulty: "beginner",
          summary: "Lezione fixture minima importata nel DB locale.",
          status: "active",
          sourceFile: "tests/fixtures/db/fixture-tcg/textbook/core-vocab.md",
          createdAt,
          updatedAt
        }
      });

    await tx
      .insert(lessonContent)
      .values({
        lessonId: developmentFixture.lessonId,
        markdownRaw:
          "# Core Vocabulary\n\nIn questa lesson incontriamo [行く](term:term_fixture_iku) e [〜ている](grammar:grammar_fixture_teiru).\n\nLa forma {{日本語|にほんご}} resta visibile quando serve.\n",
        htmlRendered:
          '<h1>Core Vocabulary</h1><p>In questa lesson incontriamo <span class="content-entry-ref" data-entry-type="term" data-entry-id="term_fixture_iku">行く</span> e <span class="content-entry-ref" data-entry-type="grammar" data-entry-id="grammar_fixture_teiru">〜ている</span>.</p><p>La forma <ruby><rb>日本語</rb><rt>にほんご</rt></ruby> resta visibile quando serve.</p>',
        astJson: JSON.stringify({
          raw: "# Core Vocabulary\n\nIn questa lesson incontriamo 行く e 〜ている.\n",
          blocks: [
            {
              type: "heading",
              depth: 1,
              children: [{ type: "text", value: "Core Vocabulary" }]
            },
            {
              type: "paragraph",
              children: [
                { type: "text", value: "In questa lesson incontriamo " },
                {
                  type: "reference",
                  raw: "[行く](term:term_fixture_iku)",
                  display: "行く",
                  targetType: "term",
                  targetId: developmentFixture.termId,
                  children: [{ type: "text", value: "行く" }]
                },
                { type: "text", value: " e " },
                {
                  type: "reference",
                  raw: "[〜ている](grammar:grammar_fixture_teiru)",
                  display: "〜ている",
                  targetType: "grammar",
                  targetId: developmentFixture.grammarId,
                  children: [{ type: "text", value: "〜ている" }]
                },
                { type: "text", value: "." }
              ]
            },
            {
              type: "paragraph",
              children: [
                { type: "text", value: "La forma " },
                {
                  type: "furigana",
                  raw: "{{日本語|にほんご}}",
                  base: "日本語",
                  reading: "にほんご"
                },
                { type: "text", value: " resta visibile quando serve." }
              ]
            }
          ]
        }),
        excerpt:
          "Lezione fixture con una voce lessicale, un pattern grammaticale e furigana reali.",
        lastImportId: developmentFixture.importId
      })
      .onConflictDoUpdate({
        target: lessonContent.lessonId,
        set: {
          markdownRaw:
            "# Core Vocabulary\n\nIn questa lesson incontriamo [行く](term:term_fixture_iku) e [〜ている](grammar:grammar_fixture_teiru).\n\nLa forma {{日本語|にほんご}} resta visibile quando serve.\n",
          htmlRendered:
            '<h1>Core Vocabulary</h1><p>In questa lesson incontriamo <span class="content-entry-ref" data-entry-type="term" data-entry-id="term_fixture_iku">行く</span> e <span class="content-entry-ref" data-entry-type="grammar" data-entry-id="grammar_fixture_teiru">〜ている</span>.</p><p>La forma <ruby><rb>日本語</rb><rt>にほんご</rt></ruby> resta visibile quando serve.</p>',
          astJson: JSON.stringify({
            raw: "# Core Vocabulary\n\nIn questa lesson incontriamo 行く e 〜ている.\n",
            blocks: [
              {
                type: "heading",
                depth: 1,
                children: [{ type: "text", value: "Core Vocabulary" }]
              },
              {
                type: "paragraph",
                children: [
                  { type: "text", value: "In questa lesson incontriamo " },
                  {
                    type: "reference",
                    raw: "[行く](term:term_fixture_iku)",
                    display: "行く",
                    targetType: "term",
                    targetId: developmentFixture.termId,
                    children: [{ type: "text", value: "行く" }]
                  },
                  { type: "text", value: " e " },
                  {
                    type: "reference",
                    raw: "[〜ている](grammar:grammar_fixture_teiru)",
                    display: "〜ている",
                    targetType: "grammar",
                    targetId: developmentFixture.grammarId,
                    children: [{ type: "text", value: "〜ている" }]
                  },
                  { type: "text", value: "." }
                ]
              },
              {
                type: "paragraph",
                children: [
                  { type: "text", value: "La forma " },
                  {
                    type: "furigana",
                    raw: "{{日本語|にほんご}}",
                    base: "日本語",
                    reading: "にほんご"
                  },
                  { type: "text", value: " resta visibile quando serve." }
                ]
              }
            ]
          }),
          excerpt:
            "Lezione fixture con una voce lessicale, un pattern grammaticale e furigana reali.",
          lastImportId: developmentFixture.importId
        }
      });

    await tx
      .insert(term)
      .values({
        id: developmentFixture.termDbId,
        sourceId: developmentFixture.termId,
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        lemma: "行く",
        reading: "いく",
        romaji: "iku",
        pos: "verb",
        meaningIt: "andare",
        meaningLiteralIt: "muoversi verso una destinazione",
        notesIt: "Verbo base molto frequente.",
        levelHint: "N5",
        searchLemmaNorm: "行く",
        searchReadingNorm: "いく",
        searchRomajiNorm: "iku",
        createdAt,
        updatedAt
      })
      .onConflictDoUpdate({
        target: term.id,
        set: {
          sourceId: developmentFixture.termId,
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          lemma: "行く",
          reading: "いく",
          romaji: "iku",
          pos: "verb",
          meaningIt: "andare",
          meaningLiteralIt: "muoversi verso una destinazione",
          notesIt: "Verbo base molto frequente.",
          levelHint: "N5",
          searchLemmaNorm: "行く",
          searchReadingNorm: "いく",
          searchRomajiNorm: "iku",
          createdAt,
          updatedAt
        }
      });

    await tx
      .insert(termAlias)
      .values([
        {
          id: "term_alias_fixture_iku_polite",
          termId: developmentFixture.termDbId,
          aliasText: "いきます",
          aliasNorm: "いきます",
          aliasType: "inflected"
        },
        {
          id: "term_alias_fixture_iku_romaji",
          termId: developmentFixture.termDbId,
          aliasText: "iku",
          aliasNorm: "iku",
          aliasType: "romaji"
        }
      ])
      .onConflictDoUpdate({
        target: termAlias.id,
        set: {
          termId: sql`excluded.term_id`,
          aliasText: sql`excluded.alias_text`,
          aliasNorm: sql`excluded.alias_norm`,
          aliasType: sql`excluded.alias_type`
        }
      });

    await tx
      .insert(grammarPattern)
      .values({
        id: developmentFixture.grammarDbId,
        sourceId: developmentFixture.grammarId,
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        pattern: "〜ている",
        title: "Progressive / resultant state",
        meaningIt: "azione in corso o stato risultante",
        notesIt: "Pattern base usato molto presto in quasi ogni corso.",
        levelHint: "N5",
        searchPatternNorm: "ている",
        createdAt,
        updatedAt
      })
      .onConflictDoUpdate({
        target: grammarPattern.id,
        set: {
          sourceId: developmentFixture.grammarId,
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          pattern: "〜ている",
          title: "Progressive / resultant state",
          meaningIt: "azione in corso o stato risultante",
          notesIt: "Pattern base usato molto presto in quasi ogni corso.",
          levelHint: "N5",
          searchPatternNorm: "ている",
          createdAt,
          updatedAt
        }
      });

    await tx
      .insert(grammarAlias)
      .values([
        {
          id: "grammar_alias_fixture_teiru_short",
          grammarId: developmentFixture.grammarDbId,
          aliasText: "〜てる",
          aliasNorm: "てる"
        }
      ])
      .onConflictDoUpdate({
        target: grammarAlias.id,
        set: {
          grammarId: sql`excluded.grammar_id`,
          aliasText: sql`excluded.alias_text`,
          aliasNorm: sql`excluded.alias_norm`
        }
      });

    await tx
      .insert(entryLink)
      .values([
        {
          id: "entry_link_fixture_term_intro",
          entryType: "term",
          entryId: developmentFixture.termDbId,
          sourceType: "lesson",
          sourceId: developmentFixture.lessonId,
          linkRole: "introduced",
          sortOrder: 1
        },
        {
          id: "entry_link_fixture_grammar_explained",
          entryType: "grammar",
          entryId: developmentFixture.grammarDbId,
          sourceType: "lesson",
          sourceId: developmentFixture.lessonId,
          linkRole: "explained",
          sortOrder: 2
        },
        {
          id: "entry_link_fixture_term_card",
          entryType: "term",
          entryId: developmentFixture.termDbId,
          sourceType: "card",
          sourceId: developmentFixture.primaryCardId,
          linkRole: "reviewed",
          sortOrder: 1
        },
        {
          id: "entry_link_fixture_grammar_card",
          entryType: "grammar",
          entryId: developmentFixture.grammarDbId,
          sourceType: "card",
          sourceId: developmentFixture.secondaryCardId,
          linkRole: "reviewed",
          sortOrder: 2
        }
      ])
      .onConflictDoUpdate({
        target: entryLink.id,
        set: {
          entryType: sql`excluded.entry_type`,
          entryId: sql`excluded.entry_id`,
          sourceType: sql`excluded.source_type`,
          sourceId: sql`excluded.source_id`,
          linkRole: sql`excluded.link_role`,
          sortOrder: sql`excluded.sort_order`
        }
      });

    await tx
      .insert(card)
      .values([
        {
          id: developmentFixture.primaryCardId,
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          sourceFile: "tests/fixtures/db/fixture-tcg/cards/iku.md",
          cardType: "recognition",
          front: "行く",
          back: "andare",
          exampleJp: "{{駅|えき}}まで {{行|い}}く。",
          exampleIt: "Vado fino alla stazione.",
          notesIt: "Card lessicale primaria.",
          status: "active",
          orderIndex: 1,
          createdAt,
          updatedAt
        },
        {
          id: developmentFixture.secondaryCardId,
          mediaId: developmentFixture.mediaId,
          segmentId: developmentFixture.segmentId,
          sourceFile: "tests/fixtures/db/fixture-tcg/cards/teiru.md",
          cardType: "grammar",
          front: "〜ている",
          back: "azione in corso / stato risultante",
          exampleJp: "{{雨|あめ}}が {{降|ふ}}っている。",
          exampleIt: "Sta piovendo.",
          notesIt: "Card grammaticale di supporto.",
          status: "active",
          orderIndex: 2,
          createdAt,
          updatedAt
        }
      ])
      .onConflictDoUpdate({
        target: card.id,
        set: {
          mediaId: sql`excluded.media_id`,
          segmentId: sql`excluded.segment_id`,
          sourceFile: sql`excluded.source_file`,
          cardType: sql`excluded.card_type`,
          front: sql`excluded.front`,
          back: sql`excluded.back`,
          exampleJp: sql`excluded.example_jp`,
          exampleIt: sql`excluded.example_it`,
          notesIt: sql`excluded.notes_it`,
          status: sql`excluded.status`,
          orderIndex: sql`excluded.order_index`,
          createdAt: sql`excluded.created_at`,
          updatedAt: sql`excluded.updated_at`
        }
      });

    await tx
      .insert(cardEntryLink)
      .values([
        {
          id: "card_entry_link_fixture_iku_primary",
          cardId: developmentFixture.primaryCardId,
          entryType: "term",
          entryId: developmentFixture.termDbId,
          relationshipType: "primary"
        },
        {
          id: "card_entry_link_fixture_teiru_primary",
          cardId: developmentFixture.secondaryCardId,
          entryType: "grammar",
          entryId: developmentFixture.grammarDbId,
          relationshipType: "primary"
        }
      ])
      .onConflictDoUpdate({
        target: cardEntryLink.id,
        set: {
          cardId: sql`excluded.card_id`,
          entryType: sql`excluded.entry_type`,
          entryId: sql`excluded.entry_id`,
          relationshipType: sql`excluded.relationship_type`
        }
      });

    await tx
      .insert(entryStatus)
      .values([
        {
          id: "entry_status_fixture_iku",
          entryType: "term",
          entryId: developmentFixture.termDbId,
          status: "learning",
          reason: "Seed fixture manual status.",
          setAt: updatedAt
        },
        {
          id: "entry_status_fixture_teiru",
          entryType: "grammar",
          entryId: developmentFixture.grammarDbId,
          status: "known_manual",
          reason: "Simulazione override manuale.",
          setAt: updatedAt
        }
      ])
      .onConflictDoUpdate({
        target: entryStatus.id,
        set: {
          entryType: sql`excluded.entry_type`,
          entryId: sql`excluded.entry_id`,
          status: sql`excluded.status`,
          reason: sql`excluded.reason`,
          setAt: sql`excluded.set_at`
        }
      });

    await tx
      .insert(reviewState)
      .values([
        {
          cardId: developmentFixture.primaryCardId,
          state: "learning",
          stability: 1.4,
          difficulty: 4.2,
          dueAt: dueSoonAt,
          lastReviewedAt: updatedAt,
          lapses: 1,
          reps: 3,
          manualOverride: false,
          createdAt,
          updatedAt
        },
        {
          cardId: developmentFixture.secondaryCardId,
          state: "review",
          stability: 3.5,
          difficulty: 3.1,
          dueAt: dueLaterAt,
          lastReviewedAt: updatedAt,
          lapses: 0,
          reps: 5,
          manualOverride: false,
          createdAt,
          updatedAt
        }
      ])
      .onConflictDoUpdate({
        target: reviewState.cardId,
        set: {
          state: sql`excluded.state`,
          stability: sql`excluded.stability`,
          difficulty: sql`excluded.difficulty`,
          dueAt: sql`excluded.due_at`,
          lastReviewedAt: sql`excluded.last_reviewed_at`,
          lapses: sql`excluded.lapses`,
          reps: sql`excluded.reps`,
          manualOverride: sql`excluded.manual_override`,
          createdAt: sql`excluded.created_at`,
          updatedAt: sql`excluded.updated_at`
        }
      });

    await tx
      .insert(reviewLog)
      .values([
        {
          id: "review_log_fixture_iku_1",
          cardId: developmentFixture.primaryCardId,
          answeredAt: updatedAt,
          rating: "good",
          previousState: "new",
          newState: "learning",
          scheduledDueAt: dueSoonAt,
          elapsedDays: 0.5,
          responseMs: 4200
        },
        {
          id: "review_log_fixture_teiru_1",
          cardId: developmentFixture.secondaryCardId,
          answeredAt: updatedAt,
          rating: "easy",
          previousState: "learning",
          newState: "review",
          scheduledDueAt: dueLaterAt,
          elapsedDays: 2.1,
          responseMs: 3800
        }
      ])
      .onConflictDoUpdate({
        target: reviewLog.id,
        set: {
          cardId: sql`excluded.card_id`,
          answeredAt: sql`excluded.answered_at`,
          rating: sql`excluded.rating`,
          previousState: sql`excluded.previous_state`,
          newState: sql`excluded.new_state`,
          scheduledDueAt: sql`excluded.scheduled_due_at`,
          elapsedDays: sql`excluded.elapsed_days`,
          responseMs: sql`excluded.response_ms`
        }
      });

    await tx
      .insert(lessonProgress)
      .values({
        lessonId: developmentFixture.lessonId,
        status: "in_progress",
        startedAt: createdAt,
        completedAt: null,
        lastOpenedAt: updatedAt
      })
      .onConflictDoUpdate({
        target: lessonProgress.lessonId,
        set: {
          status: "in_progress",
          startedAt: createdAt,
          completedAt: null,
          lastOpenedAt: updatedAt
        }
      });

    await tx
      .insert(mediaProgress)
      .values({
        mediaId: developmentFixture.mediaId,
        lessonsCompleted: 0,
        lessonsTotal: 1,
        entriesKnown: 1,
        entriesTotal: 2,
        cardsDue: 1,
        updatedAt
      })
      .onConflictDoUpdate({
        target: mediaProgress.mediaId,
        set: {
          lessonsCompleted: 0,
          lessonsTotal: 1,
          entriesKnown: 1,
          entriesTotal: 2,
          cardsDue: 1,
          updatedAt
        }
      });

    await tx
      .insert(userSetting)
      .values([
        {
          key: "furigana_mode",
          valueJson: JSON.stringify("hover"),
          updatedAt
        },
        {
          key: "review_daily_limit",
          valueJson: JSON.stringify(20),
          updatedAt
        },
        {
          key: "glossary_default_sort",
          valueJson: JSON.stringify("lesson_order"),
          updatedAt
        }
      ])
      .onConflictDoUpdate({
        target: userSetting.key,
        set: {
          valueJson: sql`excluded.value_json`,
          updatedAt: sql`excluded.updated_at`
        }
      });
  });
}

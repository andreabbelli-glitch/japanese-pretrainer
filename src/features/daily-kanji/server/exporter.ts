import type { DatabaseQueryClient } from "../../../db/create-client.ts";
import {
  buildEffectiveReviewEventMemoryKeySql,
  buildReviewSubjectIdentityCteSql,
  quoteSqlString
} from "../../../db/queries/review-query-helpers.ts";
import type {
  DailyKanjiDataset,
  DailyKanjiExportCard,
  DailyKanjiPriorityReason,
  DailyKanjiStudyModes
} from "../types.ts";
import { stripInlineMarkdown } from "../../study/model/inline-markdown.ts";
import { buildDailyKanjiGlossarySnapshot } from "./glossary-exporter.ts";

export const dailyKanjiDatasetVersion = 1 as const;
export const dailyKanjiDefaultRecentMistakeLookbackDays = 3;
export const dailyKanjiDefaultExportLimit = 250;
const highDifficultyThreshold = 7;
const lowStabilityThreshold = 5;

type DailyKanjiExportRow = {
  audioSrc: string | null;
  back: string;
  cardId: string;
  difficulty: number | null;
  dueAt: string | null;
  entryId: string | null;
  entryKind: "term" | "grammar" | null;
  exampleIt: string | null;
  exampleJp: string | null;
  front: string;
  label: string | null;
  lapses: number;
  lastHardAgainAt: string | null;
  lastInteractionAt: string;
  lastReviewedAt: string | null;
  learningSteps: number;
  lessonOrderIndex: number | null;
  lessonSlug: string;
  lessonTitle: string;
  meaning: string | null;
  mediaSlug: string;
  mediaTitle: string;
  notes: string | null;
  orderIndex: number | null;
  pitchAccent: number | null;
  pitchAccentSource: string | null;
  reading: string | null;
  recentHardAgainCount: number | null;
  reps: number;
  scheduledDays: number;
  segmentTitle: string | null;
  stability: number | null;
  state: "learning" | "review" | "relearning";
  subjectKey: string;
};

type DailyKanjiExportMode = "daily" | "prestudy" | "lastLessonsHardAgain";

export async function buildDailyKanjiDataset(input: {
  database: DatabaseQueryClient;
  limit?: number;
  nowIso?: string;
  recentMistakeLookbackDays?: number;
}): Promise<DailyKanjiDataset> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const [dataset, glossary] = await Promise.all([
    buildDailyKanjiCardDataset({ ...input, nowIso }),
    buildDailyKanjiGlossarySnapshot({
      database: input.database,
      nowIso
    })
  ]);

  return {
    ...dataset,
    glossary
  };
}

export async function buildDailyKanjiCardDataset(input: {
  database: DatabaseQueryClient;
  limit?: number;
  nowIso?: string;
  recentMistakeLookbackDays?: number;
}): Promise<DailyKanjiDataset> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const recentMistakeLookbackDays =
    input.recentMistakeLookbackDays ??
    dailyKanjiDefaultRecentMistakeLookbackDays;
  const limit = input.limit ?? dailyKanjiDefaultExportLimit;
  const cutoffIso = subtractDaysIso(nowIso, recentMistakeLookbackDays);
  const rows = await listDailyKanjiExportRows({
    database: input.database,
    cutoffIso,
    nowIso
  });
  const dailyCards = rows
    .flatMap((row) => mapDailyKanjiExportRow(row, nowIso, "daily"))
    .sort(compareDailyKanjiExportCards)
    .slice(0, limit);
  const prestudyCards = (
    await listDailyKanjiPrestudyRows({
      database: input.database,
      nowIso
    })
  ).flatMap((row) => mapDailyKanjiExportRow(row, nowIso, "prestudy"));
  const lastLessonsHardAgainCards = (
    await listDailyKanjiLastLessonsHardAgainRows({
      database: input.database,
      cutoffIso,
      nowIso
    })
  ).flatMap((row) =>
    mapDailyKanjiExportRow(row, nowIso, "lastLessonsHardAgain")
  );
  const cards = mergeDailyKanjiExportCards([
    ...dailyCards,
    ...prestudyCards,
    ...lastLessonsHardAgainCards
  ]);

  return {
    version: dailyKanjiDatasetVersion,
    generatedAt: nowIso,
    recentMistakeLookbackDays,
    cards
  };
}

async function listDailyKanjiExportRows(input: {
  database: Pick<DatabaseQueryClient, "all">;
  cutoffIso: string;
  nowIso: string;
}) {
  const eventMemoryKey = buildDailyKanjiEventMemoryKeySql();
  const currentEventMemoryKey = `COALESCE(rma.current_memory_key, ${eventMemoryKey})`;

  return input.database.all<DailyKanjiExportRow>(`
    WITH ${buildReviewSubjectIdentityCteSql()},
    recent_hard_again AS (
      SELECT
        ${currentEventMemoryKey} AS memoryKey,
        COUNT(*) AS recentHardAgainCount,
        MAX(rsl.answered_at) AS lastHardAgainAt
      FROM review_subject_log rsl
      LEFT JOIN review_memory_alias rma
        ON rma.alias_memory_key = ${eventMemoryKey}
      WHERE rsl.event_kind = 'grade'
        AND rsl.rating IN ('again', 'hard')
        AND rsl.answered_at >= ${quoteSqlString(input.cutoffIso)}
        AND rsl.answered_at <= ${quoteSqlString(input.nowIso)}
      GROUP BY ${currentEventMemoryKey}
    ),
    eligible_cards AS (
      SELECT
        si.card_id AS cardId,
        si.canonical_subject_key AS subjectKey,
        si.entry_type AS entryKind,
        si.entry_id AS entryId,
        c.front AS front,
        c.back AS back,
        c.example_jp AS exampleJp,
        c.example_it AS exampleIt,
        c.notes_it AS notes,
        c.order_index AS orderIndex,
        m.slug AS mediaSlug,
        m.title AS mediaTitle,
        l.slug AS lessonSlug,
        l.title AS lessonTitle,
        l.order_index AS lessonOrderIndex,
        s.title AS segmentTitle,
        rss.state AS state,
        rss.stability AS stability,
        rss.difficulty AS difficulty,
        rss.due_at AS dueAt,
        rss.last_reviewed_at AS lastReviewedAt,
        rss.last_interaction_at AS lastInteractionAt,
        rss.scheduled_days AS scheduledDays,
        rss.learning_steps AS learningSteps,
        rss.lapses AS lapses,
        rss.reps AS reps,
        COALESCE(rha.recentHardAgainCount, 0) AS recentHardAgainCount,
        rha.lastHardAgainAt AS lastHardAgainAt,
        CASE
          WHEN si.entry_type = 'term' THEN t.lemma
          WHEN si.entry_type = 'grammar' THEN gp.pattern
          ELSE NULL
        END AS label,
        CASE
          WHEN si.entry_type = 'term' THEN t.reading
          WHEN si.entry_type = 'grammar' THEN gp.reading
          ELSE NULL
        END AS reading,
        CASE
          WHEN si.entry_type = 'term' THEN t.meaning_it
          WHEN si.entry_type = 'grammar' THEN gp.meaning_it
          ELSE NULL
        END AS meaning,
        CASE
          WHEN si.entry_type = 'term' THEN t.audio_src
          WHEN si.entry_type = 'grammar' THEN gp.audio_src
          ELSE NULL
        END AS audioSrc,
        CASE
          WHEN si.entry_type = 'term' THEN t.pitch_accent
          WHEN si.entry_type = 'grammar' THEN gp.pitch_accent
          ELSE NULL
        END AS pitchAccent,
        CASE
          WHEN si.entry_type = 'term' THEN t.pitch_accent_source
          WHEN si.entry_type = 'grammar' THEN gp.pitch_accent_source
          ELSE NULL
        END AS pitchAccentSource,
        ROW_NUMBER() OVER (
          PARTITION BY si.subject_key
          ORDER BY
            CASE WHEN rss.card_id = c.id THEN 0 ELSE 1 END ASC,
            COALESCE(c.order_index, 2147483647) ASC,
            c.created_at ASC,
            c.id ASC
        ) AS subjectRowNumber
      FROM subject_identity si
      INNER JOIN card c
        ON c.id = si.card_id
      INNER JOIN media m
        ON m.id = c.media_id
      INNER JOIN lesson l
        ON l.id = c.lesson_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      INNER JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      LEFT JOIN segment s
        ON s.id = c.segment_id
      LEFT JOIN term t
        ON si.entry_type = 'term'
       AND t.id = si.entry_id
      LEFT JOIN grammar_pattern gp
        ON si.entry_type = 'grammar'
       AND gp.id = si.entry_id
      LEFT JOIN recent_hard_again rha
        ON rha.memoryKey = si.memory_key
      WHERE c.status = 'active'
        AND m.status = 'active'
        AND l.status = 'active'
        AND lp.status = 'completed'
        AND rss.state IN ('learning', 'review', 'relearning')
        AND rss.reps > 0
        AND COALESCE(rss.manual_override, 0) = 0
        AND COALESCE(rss.suspended, 0) = 0
    )
    SELECT *
    FROM eligible_cards
    WHERE subjectRowNumber = 1
  `);
}

async function listDailyKanjiPrestudyRows(input: {
  database: Pick<DatabaseQueryClient, "all">;
  nowIso: string;
}) {
  return input.database.all<DailyKanjiExportRow>(`
    WITH ${buildReviewSubjectIdentityCteSql()},
    next_lessons AS (
      SELECT
        l.id AS lessonId,
        l.media_id AS mediaId,
        ROW_NUMBER() OVER (
          PARTITION BY l.media_id
          ORDER BY
            COALESCE(l.order_index, 2147483647) ASC,
            l.created_at ASC,
            l.id ASC
        ) AS lessonRank
      FROM lesson l
      INNER JOIN media m
        ON m.id = l.media_id
      LEFT JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      WHERE l.status = 'active'
        AND m.status = 'active'
        AND COALESCE(lp.status, 'not_started') != 'completed'
    ),
    candidate_cards AS (
      SELECT
        si.card_id AS cardId,
        si.canonical_subject_key AS subjectKey,
        si.entry_type AS entryKind,
        si.entry_id AS entryId,
        c.front AS front,
        c.back AS back,
        c.example_jp AS exampleJp,
        c.example_it AS exampleIt,
        c.notes_it AS notes,
        c.order_index AS orderIndex,
        m.slug AS mediaSlug,
        m.title AS mediaTitle,
        l.slug AS lessonSlug,
        l.title AS lessonTitle,
        l.order_index AS lessonOrderIndex,
        s.title AS segmentTitle,
        'learning' AS state,
        NULL AS stability,
        NULL AS difficulty,
        NULL AS dueAt,
        NULL AS lastReviewedAt,
        ${quoteSqlString(input.nowIso)} AS lastInteractionAt,
        0 AS scheduledDays,
        0 AS learningSteps,
        0 AS lapses,
        0 AS reps,
        0 AS recentHardAgainCount,
        NULL AS lastHardAgainAt,
        CASE
          WHEN si.entry_type = 'term' THEN t.lemma
          WHEN si.entry_type = 'grammar' THEN gp.pattern
          ELSE NULL
        END AS label,
        CASE
          WHEN si.entry_type = 'term' THEN t.reading
          WHEN si.entry_type = 'grammar' THEN gp.reading
          ELSE NULL
        END AS reading,
        CASE
          WHEN si.entry_type = 'term' THEN t.meaning_it
          WHEN si.entry_type = 'grammar' THEN gp.meaning_it
          ELSE NULL
        END AS meaning,
        CASE
          WHEN si.entry_type = 'term' THEN t.audio_src
          WHEN si.entry_type = 'grammar' THEN gp.audio_src
          ELSE NULL
        END AS audioSrc,
        CASE
          WHEN si.entry_type = 'term' THEN t.pitch_accent
          WHEN si.entry_type = 'grammar' THEN gp.pitch_accent
          ELSE NULL
        END AS pitchAccent,
        CASE
          WHEN si.entry_type = 'term' THEN t.pitch_accent_source
          WHEN si.entry_type = 'grammar' THEN gp.pitch_accent_source
          ELSE NULL
        END AS pitchAccentSource,
        ROW_NUMBER() OVER (
          PARTITION BY si.subject_key
          ORDER BY
            COALESCE(c.order_index, 2147483647) ASC,
            c.created_at ASC,
            c.id ASC
        ) AS subjectRowNumber
      FROM subject_identity si
      INNER JOIN card c
        ON c.id = si.card_id
      INNER JOIN media m
        ON m.id = c.media_id
      INNER JOIN lesson l
        ON l.id = c.lesson_id
      INNER JOIN next_lessons nl
        ON nl.lessonId = l.id
       AND nl.lessonRank = 1
      LEFT JOIN segment s
        ON s.id = c.segment_id
      LEFT JOIN term t
        ON si.entry_type = 'term'
       AND t.id = si.entry_id
      LEFT JOIN grammar_pattern gp
        ON si.entry_type = 'grammar'
       AND gp.id = si.entry_id
      WHERE c.status = 'active'
        AND m.status = 'active'
        AND l.status = 'active'
    )
    SELECT *
    FROM candidate_cards
    WHERE subjectRowNumber = 1
    ORDER BY
      mediaTitle ASC,
      COALESCE(lessonOrderIndex, 2147483647) ASC,
      COALESCE(orderIndex, 2147483647) ASC,
      cardId ASC
  `);
}

async function listDailyKanjiLastLessonsHardAgainRows(input: {
  database: Pick<DatabaseQueryClient, "all">;
  cutoffIso: string;
  nowIso: string;
}) {
  const eventMemoryKey = buildDailyKanjiEventMemoryKeySql();
  const currentEventMemoryKey = `COALESCE(rma.current_memory_key, ${eventMemoryKey})`;

  return input.database.all<DailyKanjiExportRow>(`
    WITH ${buildReviewSubjectIdentityCteSql()},
    recent_hard_again AS (
      SELECT
        ${currentEventMemoryKey} AS memoryKey,
        COUNT(*) AS recentHardAgainCount,
        MAX(rsl.answered_at) AS lastHardAgainAt
      FROM review_subject_log rsl
      LEFT JOIN review_memory_alias rma
        ON rma.alias_memory_key = ${eventMemoryKey}
      WHERE rsl.event_kind = 'grade'
        AND rsl.rating IN ('again', 'hard')
        AND rsl.answered_at >= ${quoteSqlString(input.cutoffIso)}
        AND rsl.answered_at <= ${quoteSqlString(input.nowIso)}
      GROUP BY ${currentEventMemoryKey}
    ),
    lesson_hard_again AS (
      SELECT DISTINCT
        l.id AS lessonId
      FROM lesson l
      INNER JOIN card c
        ON c.lesson_id = l.id
      INNER JOIN subject_identity si
        ON si.card_id = c.id
      INNER JOIN recent_hard_again rha
        ON rha.memoryKey = si.memory_key
      WHERE l.status = 'active'
        AND c.status = 'active'
    ),
    recent_lessons AS (
      SELECT
        l.id AS lessonId,
        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(lp.completed_at, lp.last_opened_at, l.updated_at) DESC,
            COALESCE(l.order_index, -2147483648) DESC,
            l.id DESC
        ) AS lessonRank
      FROM lesson l
      INNER JOIN media m
        ON m.id = l.media_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      INNER JOIN lesson_hard_again lha
        ON lha.lessonId = l.id
      WHERE l.status = 'active'
        AND m.status = 'active'
        AND lp.status = 'completed'
    ),
    candidate_cards AS (
      SELECT
        si.card_id AS cardId,
        si.canonical_subject_key AS subjectKey,
        si.entry_type AS entryKind,
        si.entry_id AS entryId,
        c.front AS front,
        c.back AS back,
        c.example_jp AS exampleJp,
        c.example_it AS exampleIt,
        c.notes_it AS notes,
        c.order_index AS orderIndex,
        m.slug AS mediaSlug,
        m.title AS mediaTitle,
        l.slug AS lessonSlug,
        l.title AS lessonTitle,
        l.order_index AS lessonOrderIndex,
        s.title AS segmentTitle,
        rss.state AS state,
        rss.stability AS stability,
        rss.difficulty AS difficulty,
        rss.due_at AS dueAt,
        rss.last_reviewed_at AS lastReviewedAt,
        rss.last_interaction_at AS lastInteractionAt,
        rss.scheduled_days AS scheduledDays,
        rss.learning_steps AS learningSteps,
        rss.lapses AS lapses,
        rss.reps AS reps,
        COALESCE(rha.recentHardAgainCount, 0) AS recentHardAgainCount,
        rha.lastHardAgainAt AS lastHardAgainAt,
        CASE
          WHEN si.entry_type = 'term' THEN t.lemma
          WHEN si.entry_type = 'grammar' THEN gp.pattern
          ELSE NULL
        END AS label,
        CASE
          WHEN si.entry_type = 'term' THEN t.reading
          WHEN si.entry_type = 'grammar' THEN gp.reading
          ELSE NULL
        END AS reading,
        CASE
          WHEN si.entry_type = 'term' THEN t.meaning_it
          WHEN si.entry_type = 'grammar' THEN gp.meaning_it
          ELSE NULL
        END AS meaning,
        CASE
          WHEN si.entry_type = 'term' THEN t.audio_src
          WHEN si.entry_type = 'grammar' THEN gp.audio_src
          ELSE NULL
        END AS audioSrc,
        CASE
          WHEN si.entry_type = 'term' THEN t.pitch_accent
          WHEN si.entry_type = 'grammar' THEN gp.pitch_accent
          ELSE NULL
        END AS pitchAccent,
        CASE
          WHEN si.entry_type = 'term' THEN t.pitch_accent_source
          WHEN si.entry_type = 'grammar' THEN gp.pitch_accent_source
          ELSE NULL
        END AS pitchAccentSource,
        ROW_NUMBER() OVER (
          PARTITION BY si.subject_key
          ORDER BY
            CASE WHEN rss.card_id = c.id THEN 0 ELSE 1 END ASC,
            COALESCE(c.order_index, 2147483647) ASC,
            c.created_at ASC,
            c.id ASC
        ) AS subjectRowNumber
      FROM subject_identity si
      INNER JOIN card c
        ON c.id = si.card_id
      INNER JOIN media m
        ON m.id = c.media_id
      INNER JOIN lesson l
        ON l.id = c.lesson_id
      INNER JOIN recent_lessons rl
        ON rl.lessonId = l.id
       AND rl.lessonRank <= 3
      INNER JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      INNER JOIN recent_hard_again rha
        ON rha.memoryKey = si.memory_key
      LEFT JOIN segment s
        ON s.id = c.segment_id
      LEFT JOIN term t
        ON si.entry_type = 'term'
       AND t.id = si.entry_id
      LEFT JOIN grammar_pattern gp
        ON si.entry_type = 'grammar'
       AND gp.id = si.entry_id
      WHERE c.status = 'active'
        AND m.status = 'active'
        AND l.status = 'active'
        AND rss.state IN ('learning', 'review', 'relearning')
        AND rss.reps > 0
        AND COALESCE(rss.manual_override, 0) = 0
        AND COALESCE(rss.suspended, 0) = 0
    )
    SELECT *
    FROM candidate_cards
    WHERE subjectRowNumber = 1
    ORDER BY
      mediaTitle ASC,
      COALESCE(lessonOrderIndex, -2147483648) DESC,
      lastHardAgainAt DESC,
      cardId ASC
  `);
}

function buildDailyKanjiEventMemoryKeySql() {
  return buildEffectiveReviewEventMemoryKeySql({
    canonicalSubjectKeyExpression: "rsl.canonical_subject_key",
    cardIdExpression: "rsl.card_id",
    eventSchemaVersionExpression: "rsl.event_schema_version",
    memoryKeyExpression: "rsl.memory_key",
    recallTaskExpression: "rsl.recall_task",
    subjectKeyExpression: "rsl.subject_key"
  });
}

function mapDailyKanjiExportRow(
  row: DailyKanjiExportRow,
  nowIso: string,
  mode: DailyKanjiExportMode
): DailyKanjiExportCard[] {
  const front = stripInlineMarkdown(row.front).trim();
  const back = stripInlineMarkdown(row.back).trim();
  const kanji = collectKanji(front);

  if (
    !row.entryId ||
    !row.entryKind ||
    !row.label ||
    !row.meaning ||
    kanji.length === 0
  ) {
    return [];
  }

  const priority = calculatePriority(row, nowIso);

  if (priority.reasons.length === 0) {
    return [];
  }

  return [
    {
      cardId: row.cardId,
      subjectKey: row.subjectKey,
      cardOrderIndex: row.orderIndex,
      media: {
        slug: row.mediaSlug,
        title: row.mediaTitle
      },
      lesson: {
        orderIndex: row.lessonOrderIndex,
        slug: row.lessonSlug,
        title: row.lessonTitle
      },
      ...(row.segmentTitle
        ? {
            segment: {
              title: row.segmentTitle
            }
          }
        : {}),
      front,
      back,
      kanji,
      entry: {
        ...(row.audioSrc ? { audioSrc: row.audioSrc } : {}),
        id: row.entryId,
        kind: row.entryKind,
        label: row.label,
        meaning: row.meaning,
        ...(row.pitchAccent !== null ? { pitchAccent: row.pitchAccent } : {}),
        ...(row.pitchAccentSource
          ? { pitchAccentSource: row.pitchAccentSource }
          : {}),
        ...(row.reading ? { reading: row.reading } : {})
      },
      ...(row.exampleIt
        ? { exampleIt: stripInlineMarkdown(row.exampleIt) }
        : {}),
      ...(row.exampleJp
        ? { exampleJp: stripInlineMarkdown(row.exampleJp) }
        : {}),
      ...(row.notes ? { notes: stripInlineMarkdown(row.notes) } : {}),
      studyModes: buildStudyModes(row, mode),
      srs: {
        difficulty: row.difficulty,
        dueAt: row.dueAt,
        lapses: row.lapses,
        lastHardAgainAt: row.lastHardAgainAt,
        lastInteractionAt: row.lastInteractionAt,
        lastReviewedAt: row.lastReviewedAt,
        learningSteps: row.learningSteps,
        priorityReasons: priority.reasons,
        priorityScore: priority.score,
        recentHardAgainCount: row.recentHardAgainCount ?? 0,
        reps: row.reps,
        scheduledDays: row.scheduledDays,
        stability: row.stability,
        state: row.state
      }
    }
  ];
}

function buildStudyModes(
  row: DailyKanjiExportRow,
  mode: DailyKanjiExportMode
): DailyKanjiStudyModes {
  if (mode === "daily") {
    return { daily: true };
  }

  const scope = {
    lessonOrderIndex: row.lessonOrderIndex,
    lessonSlug: row.lessonSlug,
    lessonTitle: row.lessonTitle,
    order: row.orderIndex
  };

  if (mode === "prestudy") {
    return { prestudy: scope };
  }

  return { lastLessonsHardAgain: scope };
}

function mergeDailyKanjiExportCards(cards: DailyKanjiExportCard[]) {
  const byCardId = new Map<string, DailyKanjiExportCard>();

  for (const card of cards) {
    const existing = byCardId.get(card.cardId);

    if (!existing) {
      byCardId.set(card.cardId, card);
      continue;
    }

    existing.studyModes = {
      ...existing.studyModes,
      ...card.studyModes
    };
  }

  return Array.from(byCardId.values());
}

function collectKanji(input: string) {
  return [
    ...new Set([...input.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]))
  ];
}

function calculatePriority(row: DailyKanjiExportRow, nowIso: string) {
  const reasons: DailyKanjiPriorityReason[] = [];
  const recentHardAgainCount = row.recentHardAgainCount ?? 0;
  let score = 0;

  if (recentHardAgainCount > 0) {
    reasons.push("recent-hard-again");
    score += 10000 + recentHardAgainCount * 500;
  }

  if (row.state === "relearning") {
    reasons.push("relearning");
    score += 2500;
  } else if (row.state === "learning") {
    reasons.push("learning");
    score += 1500;
  }

  if (row.stability !== null && row.stability <= lowStabilityThreshold) {
    reasons.push("low-stability");
    score += 2000 + (lowStabilityThreshold - row.stability) * 200;
  }

  if (row.difficulty !== null && row.difficulty >= highDifficultyThreshold) {
    reasons.push("high-difficulty");
    score += 1000 + (row.difficulty - highDifficultyThreshold) * 250;
  }

  score += Math.max(0, 2000 - (row.stability ?? 20) * 150);
  score += (row.difficulty ?? 0) * 100;

  if (row.lapses > 0) {
    reasons.push("lapses");
    score += row.lapses * 150;
  }

  if (row.dueAt && row.dueAt <= nowIso) {
    score += 300;
  }

  return {
    reasons,
    score: Math.round(score)
  };
}

function compareDailyKanjiExportCards(
  left: DailyKanjiExportCard,
  right: DailyKanjiExportCard
) {
  const recentBucketDifference =
    Number(right.srs.recentHardAgainCount > 0) -
    Number(left.srs.recentHardAgainCount > 0);

  if (recentBucketDifference !== 0) {
    return recentBucketDifference;
  }

  const lowStabilityBucketDifference =
    Number(right.srs.priorityReasons.includes("low-stability")) -
    Number(left.srs.priorityReasons.includes("low-stability"));

  if (lowStabilityBucketDifference !== 0) {
    return lowStabilityBucketDifference;
  }

  const scoreDifference = right.srs.priorityScore - left.srs.priorityScore;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const stabilityDifference =
    (left.srs.stability ?? Number.POSITIVE_INFINITY) -
    (right.srs.stability ?? Number.POSITIVE_INFINITY);

  if (stabilityDifference !== 0) {
    return stabilityDifference;
  }

  const recentDifference =
    right.srs.recentHardAgainCount - left.srs.recentHardAgainCount;

  if (recentDifference !== 0) {
    return recentDifference;
  }

  if ((left.srs.lastHardAgainAt ?? "") !== (right.srs.lastHardAgainAt ?? "")) {
    return (right.srs.lastHardAgainAt ?? "").localeCompare(
      left.srs.lastHardAgainAt ?? ""
    );
  }

  if ((left.srs.dueAt ?? "") !== (right.srs.dueAt ?? "")) {
    return (left.srs.dueAt ?? "9999").localeCompare(right.srs.dueAt ?? "9999");
  }

  return left.cardId.localeCompare(right.cardId);
}

function subtractDaysIso(nowIso: string, days: number) {
  const date = new Date(nowIso);

  date.setUTCDate(date.getUTCDate() - days);

  return date.toISOString();
}

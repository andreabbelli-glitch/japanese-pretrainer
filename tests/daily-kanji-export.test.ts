import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/db";
import {
  card,
  cardEntryLink,
  reviewSubjectLog,
  reviewSubjectState,
  term
} from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { buildDailyKanjiDataset } from "@/features/daily-kanji/server/exporter";
import { withTestDatabase } from "./helpers/test-db";

const nowIso = "2026-06-10T12:00:00.000Z";

describe("daily kanji iOS export", () => {
  it("exports eligible kanji flashcards ordered by recent hard-again signal and instability", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-export-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await seedDailyKanjiCards(database);

        const dataset = await buildDailyKanjiDataset({
          database,
          limit: 10,
          nowIso,
          recentMistakeLookbackDays: 3
        });

        expect(dataset.version).toBe(1);
        expect(dataset.generatedAt).toBe(nowIso);
        expect(dataset.cards.map((entry) => entry.cardId)).toEqual([
          "card_daily_recent_again",
          developmentFixture.primaryCardId,
          "card_daily_high_difficulty"
        ]);

        const recentAgain = dataset.cards[0]!;
        expect(recentAgain.front).toBe("観点");
        expect(recentAgain.kanji).toEqual(["観", "点"]);
        expect(recentAgain.entry).toEqual({
          audioSrc: "assets/audio/term/term-daily-kanten/kanten.mp3",
          id: "term_daily_kanten",
          kind: "term",
          label: "観点",
          meaning: "punto di vista",
          pitchAccent: 1,
          pitchAccentSource: "Kanjium",
          reading: "かんてん"
        });
        expect(recentAgain.srs.recentHardAgainCount).toBe(2);
        expect(recentAgain.srs.lastHardAgainAt).toBe(
          "2026-06-09T11:00:00.000Z"
        );
        expect(recentAgain.srs.priorityReasons).toEqual([
          "recent-hard-again",
          "relearning",
          "low-stability",
          "lapses"
        ]);
        expect(recentAgain.notes).toBe("観点 note");

        const highDifficulty = dataset.cards.find(
          (entry) => entry.cardId === "card_daily_high_difficulty"
        );
        expect(highDifficulty?.srs.priorityReasons).toEqual([
          "high-difficulty"
        ]);
        expect(highDifficulty?.srs.difficulty).toBe(9);
        expect(highDifficulty?.srs.stability).toBe(8);

        expect(
          dataset.cards.find(
            (entry) => entry.cardId === "card_daily_recent_again_old_sibling"
          )
        ).toBeUndefined();
        expect(
          dataset.cards.find((entry) => entry.cardId === "card_daily_stable")
        ).toBeUndefined();
        expect(
          dataset.cards.find((entry) => entry.cardId === "card_daily_kana")
        ).toBeUndefined();
        expect(
          dataset.cards.find((entry) => entry.cardId === "card_daily_manual")
        ).toBeUndefined();
        expect(
          dataset.cards.find((entry) => entry.cardId === "card_daily_suspended")
        ).toBeUndefined();
        expect(
          dataset.cards.find(
            (entry) => entry.cardId === developmentFixture.secondaryCardId
          )
        ).toBeUndefined();
      }
    );
  });

  it("respects the export limit after eligibility and ranking", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-limit-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await seedDailyKanjiCards(database);

        const dataset = await buildDailyKanjiDataset({
          database,
          limit: 1,
          nowIso,
          recentMistakeLookbackDays: 3
        });

        expect(dataset.cards.map((entry) => entry.cardId)).toEqual([
          "card_daily_recent_again"
        ]);
      }
    );
  });

  it("keeps recent hard-again cards ahead of intense non-recent cards before limiting", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-recent-bucket-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await seedRecentBucketRegressionCards(database);

        const dataset = await buildDailyKanjiDataset({
          database,
          limit: 1,
          nowIso,
          recentMistakeLookbackDays: 3
        });

        expect(dataset.cards.map((entry) => entry.cardId)).toEqual([
          "card_daily_recent_only"
        ]);
      }
    );
  });

  it("keeps low-stability cards ahead of higher-score stable cards before limiting", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-low-stability-bucket-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await seedLowStabilityBucketRegressionCards(database);

        const dataset = await buildDailyKanjiDataset({
          database,
          limit: 10,
          nowIso,
          recentMistakeLookbackDays: 3
        });
        const lowStabilityIndex = dataset.cards.findIndex(
          (entry) => entry.cardId === "card_daily_low_stability"
        );
        const stableHighScoreIndex = dataset.cards.findIndex(
          (entry) => entry.cardId === "card_daily_stable_high_score"
        );

        expect(lowStabilityIndex).toBeGreaterThanOrEqual(0);
        expect(stableHighScoreIndex).toBeGreaterThanOrEqual(0);
        expect(lowStabilityIndex).toBeLessThan(stableHighScoreIndex);
      }
    );
  });
});

type TestDatabase = DatabaseClient;

async function seedDailyKanjiCards(database: TestDatabase) {
  await database
    .update(term)
    .set({
      audioSrc: "assets/audio/term/term-fixture-iku/iku.mp3",
      pitchAccent: 0,
      pitchAccentSource: "Kanjium"
    })
    .where(eq(term.id, developmentFixture.termDbId));

  await database.insert(term).values([
    buildTerm({
      audioSrc: "assets/audio/term/term-daily-kanten/kanten.mp3",
      id: "term_daily_kanten",
      lemma: "観点",
      meaningIt: "punto di vista",
      pitchAccent: 1,
      pitchAccentSource: "Kanjium",
      reading: "かんてん",
      romaji: "kanten"
    }),
    buildTerm({
      id: "term_daily_antei",
      lemma: "安定",
      meaningIt: "stabilità",
      pitchAccent: 0,
      pitchAccentSource: "Kanjium",
      reading: "あんてい",
      romaji: "antei"
    }),
    buildTerm({
      id: "term_daily_fukuzatsu",
      lemma: "複雑",
      meaningIt: "complesso",
      pitchAccent: 0,
      pitchAccentSource: "Kanjium",
      reading: "ふくざつ",
      romaji: "fukuzatsu"
    }),
    buildTerm({
      id: "term_daily_kana",
      lemma: "かな",
      meaningIt: "kana",
      reading: "かな",
      romaji: "kana"
    }),
    buildTerm({
      id: "term_daily_manual",
      lemma: "手動",
      meaningIt: "manuale",
      reading: "しゅどう",
      romaji: "shudou"
    }),
    buildTerm({
      id: "term_daily_suspended",
      lemma: "停止",
      meaningIt: "pausa",
      reading: "ていし",
      romaji: "teishi"
    })
  ]);

  await database.insert(card).values([
    buildCard({
      front: "古い観点",
      id: "card_daily_recent_again_old_sibling",
      orderIndex: 1
    }),
    buildCard({
      front: "観点",
      id: "card_daily_recent_again",
      notes: "{{観|かん}}点 note",
      orderIndex: 10
    }),
    buildCard({
      front: "安定",
      id: "card_daily_stable",
      orderIndex: 11
    }),
    buildCard({
      front: "複雑",
      id: "card_daily_high_difficulty",
      orderIndex: 12
    }),
    buildCard({
      front: "かな",
      id: "card_daily_kana",
      orderIndex: 13
    }),
    buildCard({
      front: "手動",
      id: "card_daily_manual",
      orderIndex: 14
    }),
    buildCard({
      front: "停止",
      id: "card_daily_suspended",
      orderIndex: 15
    })
  ]);

  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLink("card_daily_recent_again", "term_daily_kanten"),
      buildCardEntryLink(
        "card_daily_recent_again_old_sibling",
        "term_daily_kanten"
      ),
      buildCardEntryLink("card_daily_stable", "term_daily_antei"),
      buildCardEntryLink("card_daily_high_difficulty", "term_daily_fukuzatsu"),
      buildCardEntryLink("card_daily_kana", "term_daily_kana"),
      buildCardEntryLink("card_daily_manual", "term_daily_manual"),
      buildCardEntryLink("card_daily_suspended", "term_daily_suspended")
    ]);

  await database.insert(reviewSubjectState).values([
    buildReviewState({
      cardId: "card_daily_recent_again",
      difficulty: 4.8,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_kanten",
      lapses: 2,
      lastInteractionAt: "2026-06-09T11:00:00.000Z",
      reps: 5,
      stability: 4.5,
      state: "relearning"
    }),
    buildReviewState({
      cardId: "card_daily_stable",
      difficulty: 2.2,
      dueAt: "2026-06-11T08:00:00.000Z",
      entryId: "term_daily_antei",
      lastInteractionAt: "2026-06-08T11:00:00.000Z",
      reps: 8,
      stability: 10,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_high_difficulty",
      difficulty: 9,
      dueAt: "2026-06-11T08:00:00.000Z",
      entryId: "term_daily_fukuzatsu",
      lastInteractionAt: "2026-06-08T11:00:00.000Z",
      reps: 8,
      stability: 8,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_kana",
      difficulty: 5,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_kana",
      lastInteractionAt: "2026-06-09T10:00:00.000Z",
      reps: 5,
      stability: 1,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_manual",
      difficulty: 5,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_manual",
      lastInteractionAt: "2026-06-09T10:00:00.000Z",
      manualOverride: true,
      reps: 5,
      stability: 1,
      state: "known_manual"
    }),
    buildReviewState({
      cardId: "card_daily_suspended",
      difficulty: 5,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_suspended",
      lastInteractionAt: "2026-06-09T10:00:00.000Z",
      reps: 5,
      stability: 1,
      state: "review",
      suspended: true
    })
  ]);

  await database.insert(reviewSubjectLog).values([
    buildReviewLog({
      answeredAt: "2026-06-08T11:00:00.000Z",
      id: "review_log_daily_kanten_hard",
      rating: "hard"
    }),
    buildReviewLog({
      answeredAt: "2026-06-09T11:00:00.000Z",
      id: "review_log_daily_kanten_again",
      rating: "again"
    }),
    buildReviewLog({
      answeredAt: "2026-06-01T11:00:00.000Z",
      id: "review_log_daily_kanten_old_again",
      rating: "again"
    })
  ]);
}

async function seedRecentBucketRegressionCards(database: TestDatabase) {
  await database.insert(term).values([
    buildTerm({
      id: "term_daily_recent_only",
      lemma: "直近",
      meaningIt: "recente",
      reading: "ちょっきん",
      romaji: "chokkin"
    }),
    buildTerm({
      id: "term_daily_intense_nonrecent",
      lemma: "難解",
      meaningIt: "molto difficile",
      reading: "なんかい",
      romaji: "nankai"
    })
  ]);

  await database.insert(card).values([
    buildCard({
      front: "直近",
      id: "card_daily_recent_only",
      orderIndex: 20
    }),
    buildCard({
      front: "難解",
      id: "card_daily_intense_nonrecent",
      orderIndex: 21
    })
  ]);

  await database.insert(cardEntryLink).values([
    buildCardEntryLink("card_daily_recent_only", "term_daily_recent_only"),
    buildCardEntryLink(
      "card_daily_intense_nonrecent",
      "term_daily_intense_nonrecent"
    )
  ]);

  await database.insert(reviewSubjectState).values([
    buildReviewState({
      cardId: "card_daily_recent_only",
      difficulty: 0,
      dueAt: "2026-06-11T08:00:00.000Z",
      entryId: "term_daily_recent_only",
      lastInteractionAt: "2026-06-09T11:00:00.000Z",
      reps: 4,
      stability: 20,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_intense_nonrecent",
      difficulty: 10,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_intense_nonrecent",
      lapses: 1,
      lastInteractionAt: "2026-06-08T11:00:00.000Z",
      reps: 4,
      stability: 0,
      state: "relearning"
    })
  ]);

  await database.insert(reviewSubjectLog).values(
    buildReviewLog({
      answeredAt: "2026-06-09T11:00:00.000Z",
      cardId: "card_daily_recent_only",
      entryId: "term_daily_recent_only",
      id: "review_log_daily_recent_only_hard",
      rating: "hard"
    })
  );
}

async function seedLowStabilityBucketRegressionCards(database: TestDatabase) {
  await database.insert(term).values([
    buildTerm({
      id: "term_daily_low_stability",
      lemma: "不安定",
      meaningIt: "instabile",
      reading: "ふあんてい",
      romaji: "fuantei"
    }),
    buildTerm({
      id: "term_daily_stable_high_score",
      lemma: "高得点",
      meaningIt: "punteggio alto",
      reading: "こうとくてん",
      romaji: "koutokuten"
    })
  ]);

  await database.insert(card).values([
    buildCard({
      front: "不安定",
      id: "card_daily_low_stability",
      orderIndex: 30
    }),
    buildCard({
      front: "高得点",
      id: "card_daily_stable_high_score",
      orderIndex: 31
    })
  ]);

  await database.insert(cardEntryLink).values([
    buildCardEntryLink("card_daily_low_stability", "term_daily_low_stability"),
    buildCardEntryLink(
      "card_daily_stable_high_score",
      "term_daily_stable_high_score"
    )
  ]);

  await database.insert(reviewSubjectState).values([
    buildReviewState({
      cardId: "card_daily_low_stability",
      difficulty: 1,
      dueAt: "2026-06-11T08:00:00.000Z",
      entryId: "term_daily_low_stability",
      lastInteractionAt: "2026-06-08T11:00:00.000Z",
      reps: 4,
      stability: 5,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_stable_high_score",
      difficulty: 10,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_stable_high_score",
      lapses: 20,
      lastInteractionAt: "2026-06-08T11:00:00.000Z",
      reps: 4,
      stability: 20,
      state: "review"
    })
  ]);
}

function buildTerm(input: {
  audioSrc?: string;
  id: string;
  lemma: string;
  meaningIt: string;
  pitchAccent?: number;
  pitchAccentSource?: string;
  reading: string;
  romaji: string;
}) {
  return {
    id: input.id,
    audioSrc: input.audioSrc ?? null,
    audioAttribution: null,
    audioLicense: null,
    audioPageUrl: null,
    audioSource: null,
    audioSpeaker: null,
    createdAt: nowIso,
    crossMediaGroupId: null,
    levelHint: null,
    lemma: input.lemma,
    meaningIt: input.meaningIt,
    meaningLiteralIt: null,
    mediaId: developmentFixture.mediaId,
    notesIt: null,
    pitchAccent: input.pitchAccent ?? null,
    pitchAccentPageUrl: null,
    pitchAccentSource: input.pitchAccentSource ?? null,
    pos: "noun",
    reading: input.reading,
    romaji: input.romaji,
    searchLemmaNorm: input.lemma,
    searchReadingNorm: input.reading,
    searchRomajiNorm: input.romaji,
    segmentId: developmentFixture.segmentId,
    sourceId: input.id,
    updatedAt: nowIso
  };
}

function buildCard(input: {
  front: string;
  id: string;
  notes?: string;
  orderIndex: number;
}) {
  return {
    id: input.id,
    back: `${input.front} back`,
    cardType: "recognition",
    createdAt: nowIso,
    exampleIt: `${input.front} esempio`,
    exampleJp: `${input.front}を見た。`,
    front: input.front,
    lessonId: developmentFixture.lessonId,
    mediaId: developmentFixture.mediaId,
    normalizedFront: input.front,
    notesIt: input.notes ?? `${input.front} note`,
    orderIndex: input.orderIndex,
    segmentId: developmentFixture.segmentId,
    sourceFile: `tests/fixtures/daily-kanji/${input.id}.md`,
    status: "active" as const,
    updatedAt: nowIso
  };
}

function buildCardEntryLink(cardId: string, entryId: string) {
  return {
    id: `card_entry_link_${cardId}`,
    cardId,
    entryId,
    entryType: "term" as const,
    relationshipType: "primary" as const
  };
}

function buildReviewState(input: {
  cardId: string;
  difficulty: number;
  dueAt: string;
  entryId: string;
  lapses?: number;
  lastInteractionAt: string;
  manualOverride?: boolean;
  reps: number;
  stability: number;
  state: "known_manual" | "learning" | "review" | "relearning";
  suspended?: boolean;
}) {
  return {
    subjectKey: `entry:term:${input.entryId}`,
    cardId: input.cardId,
    createdAt: nowIso,
    crossMediaGroupId: null,
    difficulty: input.difficulty,
    dueAt: input.dueAt,
    entryId: input.entryId,
    entryType: "term" as const,
    lapses: input.lapses ?? 0,
    lastInteractionAt: input.lastInteractionAt,
    lastReviewedAt: input.lastInteractionAt,
    learningSteps: input.state === "learning" ? 1 : 0,
    manualOverride: input.manualOverride ?? false,
    reps: input.reps,
    scheduledDays: input.state === "review" ? 3 : 0,
    schedulerVersion: "fsrs_v1" as const,
    stability: input.stability,
    state: input.state,
    subjectType: "entry" as const,
    suspended: input.suspended ?? false,
    updatedAt: input.lastInteractionAt
  };
}

function buildReviewLog(input: {
  answeredAt: string;
  cardId?: string;
  entryId?: string;
  id: string;
  rating: "again" | "hard";
}) {
  const cardId = input.cardId ?? "card_daily_recent_again";
  const entryId = input.entryId ?? "term_daily_kanten";

  return {
    id: input.id,
    answeredAt: input.answeredAt,
    cardId,
    elapsedDays: 0.1,
    newState: "relearning" as const,
    previousState: "review" as const,
    rating: input.rating,
    responseMs: 4200,
    scheduledDueAt: "2026-06-10T08:00:00.000Z",
    schedulerVersion: "fsrs_v1" as const,
    subjectKey: `entry:term:${entryId}`
  };
}

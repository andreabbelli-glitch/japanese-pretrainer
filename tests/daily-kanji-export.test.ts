import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/db";
import {
  card,
  cardEntryLink,
  crossMediaGroup,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  segment,
  term
} from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { buildDailyKanjiDataset } from "@/features/daily-kanji/server/exporter";
import { withTestDatabase } from "./helpers/test-db";

const nowIso = "2026-06-10T12:00:00.000Z";
const execFileAsync = promisify(execFile);
const exportScriptPath = path.join(
  process.cwd(),
  "scripts",
  "export-daily-kanji-ios-dataset.ts"
);

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

  it("exports prestudy cards and global recent hard-again cards from the last three matching lessons", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-media-modes-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await seedDailyKanjiMediaModeCards(database);

        const dataset = await buildDailyKanjiDataset({
          database,
          limit: 1,
          nowIso,
          recentMistakeLookbackDays: 3
        });

        const prestudyCard = dataset.cards.find(
          (entry) => entry.cardId === "card_daily_mode_prestudy"
        );
        expect(prestudyCard?.studyModes?.prestudy).toEqual({
          lessonOrderIndex: 304,
          lessonSlug: "daily-mode-prestudy",
          lessonTitle: "Daily Mode Prestudy",
          order: 1
        });
        expect(prestudyCard?.studyModes?.daily).toBeUndefined();
        expect(prestudyCard?.srs.reps).toBe(0);

        const lastLessonCards = dataset.cards
          .filter((entry) => entry.studyModes?.lastLessonsHardAgain)
          .map((entry) => entry.cardId);

        expect(new Set(lastLessonCards)).toEqual(
          new Set([
            "card_daily_mode_recent_two",
            "card_daily_mode_recent_three",
            "card_daily_mode_recent_four"
          ])
        );
        expect(
          dataset.cards.find(
            (entry) => entry.cardId === "card_daily_mode_recent_one"
          )?.studyModes?.lastLessonsHardAgain
        ).toBeUndefined();
        expect(
          dataset.cards.find(
            (entry) => entry.cardId === "card_daily_mode_other_old"
          )?.studyModes?.lastLessonsHardAgain
        ).toBeUndefined();
      }
    );
  });

  it("includes a compact complete glossary snapshot for the iOS app", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-glossary-",
        seedDevelopmentFixture: true
      },
      async ({ database }) => {
        await seedCrossMediaGlossarySearchEntries(database);

        const dataset = await buildDailyKanjiDataset({
          database,
          limit: 1,
          nowIso,
          recentMistakeLookbackDays: 3
        });

        expect(dataset.glossary).toMatchObject({
          entryCount: 3,
          generatedAt: nowIso,
          version: 1
        });
        const termEntry = dataset.glossary?.entries.find(
          (entry) => entry.id === `term:${developmentFixture.termDbId}`
        );
        const grammarEntry = dataset.glossary?.entries.find(
          (entry) => entry.id === `grammar:${developmentFixture.grammarDbId}`
        );
        const sharedEntry = dataset.glossary?.entries.find(
          (entry) => entry.id === "term:daily-glossary-shared"
        );

        expect(termEntry).toEqual({
          aliases: [
            { text: "いきます", type: "inflected" },
            { text: "iku", type: "romaji" }
          ],
          id: `term:${developmentFixture.termDbId}`,
          kind: "term",
          label: "行く",
          meaning: "andare",
          media: [
            {
              entryId: developmentFixture.termDbId,
              mediaSlug: developmentFixture.mediaSlug,
              mediaTitle: "Fixture TCG",
              segmentTitle: "Starter Core",
              sourceId: developmentFixture.termId
            }
          ],
          notes: "Verbo base molto frequente.",
          pitchAccent: null,
          pitchAccentSource: null,
          reading: "いく",
          romaji: "iku",
          searchText:
            "行く いく iku andare muoversi verso una destinazione Verbo base molto frequente. いきます Fixture TCG Starter Core"
        });
        expect(grammarEntry).toEqual({
          aliases: [{ text: "〜てる" }],
          id: `grammar:${developmentFixture.grammarDbId}`,
          kind: "grammar",
          label: "〜ている",
          meaning: "azione in corso o stato risultante",
          media: [
            {
              entryId: developmentFixture.grammarDbId,
              mediaSlug: developmentFixture.mediaSlug,
              mediaTitle: "Fixture TCG",
              segmentTitle: "Starter Core",
              sourceId: developmentFixture.grammarId
            }
          ],
          notes: "Pattern base usato molto presto in quasi ogni corso.",
          pitchAccent: null,
          pitchAccentSource: null,
          reading: null,
          romaji: "teiru",
          searchText:
            "〜ている Progressive / resultant state teiru azione in corso o stato risultante Pattern base usato molto presto in quasi ogni corso. 〜てる Fixture TCG Starter Core",
          title: "Progressive / resultant state"
        });
        expect(sharedEntry?.searchText).toContain("voce primaria");
        expect(sharedEntry?.searchText).toContain("testo solo secondario");
      }
    );
  });

  it("runs the standalone export CLI under Node strip-types", async () => {
    await withTestDatabase(
      {
        markDevelopmentLessonCompleted: true,
        prefix: "jcs-daily-kanji-export-cli-",
        seedDevelopmentFixture: true
      },
      async ({ databasePath, tempDir }) => {
        const outputPath = path.join(tempDir, "daily-kanji-cards.json");
        const { stdout } = await execFileAsync(
          process.execPath,
          [
            "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
            "--experimental-strip-types",
            exportScriptPath,
            "--out",
            outputPath,
            "--limit",
            "1"
          ],
          {
            env: {
              ...process.env,
              DATABASE_URL: databasePath
            }
          }
        );
        const dataset = JSON.parse(await readFile(outputPath, "utf8")) as {
          cards: unknown[];
          glossary?: { entryCount: number };
        };

        expect(stdout).toContain(
          `Wrote ${dataset.cards.length} Daily Kanji cards`
        );
        expect(dataset.cards.length).toBe(1);
        expect(dataset.glossary?.entryCount).toBeGreaterThan(0);
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

  await database
    .insert(cardEntryLink)
    .values([
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

  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLink(
        "card_daily_low_stability",
        "term_daily_low_stability"
      ),
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

async function seedDailyKanjiMediaModeCards(database: TestDatabase) {
  await database.insert(media).values({
    id: "media_daily_mode_other",
    slug: "daily-mode-other",
    title: "Daily Mode Other",
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: "Other media fixture for Daily Kanji modes.",
    status: "active",
    createdAt: nowIso,
    updatedAt: nowIso
  });
  await database.insert(segment).values({
    id: "segment_daily_mode_other",
    mediaId: "media_daily_mode_other",
    slug: "other-core",
    title: "Other Core",
    orderIndex: 1,
    segmentType: "chapter",
    notes: null
  });
  await database.insert(lesson).values([
    buildLesson({
      id: "lesson_daily_mode_one",
      orderIndex: 300,
      slug: "daily-mode-one",
      title: "Daily Mode One"
    }),
    buildLesson({
      id: "lesson_daily_mode_two",
      orderIndex: 301,
      slug: "daily-mode-two",
      title: "Daily Mode Two"
    }),
    buildLesson({
      id: "lesson_daily_mode_three",
      orderIndex: 302,
      slug: "daily-mode-three",
      title: "Daily Mode Three"
    }),
    buildLesson({
      id: "lesson_daily_mode_four",
      orderIndex: 303,
      slug: "daily-mode-four",
      title: "Daily Mode Four"
    }),
    buildLesson({
      id: "lesson_daily_mode_prestudy",
      orderIndex: 304,
      slug: "daily-mode-prestudy",
      title: "Daily Mode Prestudy"
    }),
    buildLesson({
      id: "lesson_daily_mode_other_old",
      mediaId: "media_daily_mode_other",
      orderIndex: 999,
      segmentId: "segment_daily_mode_other",
      slug: "daily-mode-other-old",
      title: "Daily Mode Other Old"
    })
  ]);
  await database.insert(lessonProgress).values([
    buildLessonProgress("lesson_daily_mode_one", "completed", {
      completedAt: "2026-06-06T12:00:00.000Z"
    }),
    buildLessonProgress("lesson_daily_mode_two", "completed", {
      completedAt: "2026-06-07T12:00:00.000Z"
    }),
    buildLessonProgress("lesson_daily_mode_three", "completed", {
      completedAt: "2026-06-08T12:00:00.000Z"
    }),
    buildLessonProgress("lesson_daily_mode_four", "completed", {
      completedAt: "2026-06-09T12:00:00.000Z"
    }),
    buildLessonProgress("lesson_daily_mode_prestudy", "in_progress"),
    buildLessonProgress("lesson_daily_mode_other_old", "completed", {
      completedAt: "2026-06-05T12:00:00.000Z"
    })
  ]);
  await database.insert(term).values([
    buildTerm({
      id: "term_daily_mode_one",
      lemma: "一番",
      meaningIt: "numero uno",
      reading: "いちばん",
      romaji: "ichiban"
    }),
    buildTerm({
      id: "term_daily_mode_two",
      lemma: "二番",
      meaningIt: "numero due",
      reading: "にばん",
      romaji: "niban"
    }),
    buildTerm({
      id: "term_daily_mode_three",
      lemma: "三番",
      meaningIt: "numero tre",
      reading: "さんばん",
      romaji: "sanban"
    }),
    buildTerm({
      id: "term_daily_mode_four",
      lemma: "四番",
      meaningIt: "numero quattro",
      reading: "よんばん",
      romaji: "yonban"
    }),
    buildTerm({
      id: "term_daily_mode_prestudy",
      lemma: "予習",
      meaningIt: "prestudio",
      reading: "よしゅう",
      romaji: "yoshuu"
    }),
    buildTerm({
      id: "term_daily_mode_other_old",
      lemma: "古傷",
      mediaId: "media_daily_mode_other",
      meaningIt: "vecchia ferita",
      reading: "ふるきず",
      romaji: "furukizu",
      segmentId: "segment_daily_mode_other"
    })
  ]);
  await database.insert(card).values([
    buildCard({
      front: "一番",
      id: "card_daily_mode_recent_one",
      lessonId: "lesson_daily_mode_one",
      orderIndex: 1
    }),
    buildCard({
      front: "二番",
      id: "card_daily_mode_recent_two",
      lessonId: "lesson_daily_mode_two",
      orderIndex: 1
    }),
    buildCard({
      front: "三番",
      id: "card_daily_mode_recent_three",
      lessonId: "lesson_daily_mode_three",
      orderIndex: 1
    }),
    buildCard({
      front: "四番",
      id: "card_daily_mode_recent_four",
      lessonId: "lesson_daily_mode_four",
      orderIndex: 1
    }),
    buildCard({
      front: "予習",
      id: "card_daily_mode_prestudy",
      lessonId: "lesson_daily_mode_prestudy",
      orderIndex: 1
    }),
    buildCard({
      front: "古傷",
      id: "card_daily_mode_other_old",
      lessonId: "lesson_daily_mode_other_old",
      mediaId: "media_daily_mode_other",
      orderIndex: 1,
      segmentId: "segment_daily_mode_other"
    })
  ]);
  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLink("card_daily_mode_recent_one", "term_daily_mode_one"),
      buildCardEntryLink("card_daily_mode_recent_two", "term_daily_mode_two"),
      buildCardEntryLink(
        "card_daily_mode_recent_three",
        "term_daily_mode_three"
      ),
      buildCardEntryLink("card_daily_mode_recent_four", "term_daily_mode_four"),
      buildCardEntryLink(
        "card_daily_mode_prestudy",
        "term_daily_mode_prestudy"
      ),
      buildCardEntryLink(
        "card_daily_mode_other_old",
        "term_daily_mode_other_old"
      )
    ]);
  await database.insert(reviewSubjectState).values([
    buildReviewState({
      cardId: "card_daily_mode_recent_one",
      difficulty: 2,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_mode_one",
      lastInteractionAt: "2026-06-09T09:00:00.000Z",
      reps: 2,
      stability: 9,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_mode_recent_two",
      difficulty: 2,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_mode_two",
      lastInteractionAt: "2026-06-09T09:00:00.000Z",
      reps: 2,
      stability: 9,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_mode_recent_three",
      difficulty: 2,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_mode_three",
      lastInteractionAt: "2026-06-09T09:00:00.000Z",
      reps: 2,
      stability: 9,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_mode_recent_four",
      difficulty: 2,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_mode_four",
      lastInteractionAt: "2026-06-09T09:00:00.000Z",
      reps: 2,
      stability: 9,
      state: "review"
    }),
    buildReviewState({
      cardId: "card_daily_mode_other_old",
      difficulty: 2,
      dueAt: "2026-06-10T08:00:00.000Z",
      entryId: "term_daily_mode_other_old",
      lastInteractionAt: "2026-06-09T09:00:00.000Z",
      reps: 2,
      stability: 9,
      state: "review"
    })
  ]);
  await database.insert(reviewSubjectLog).values([
    buildReviewLog({
      answeredAt: "2026-06-09T08:00:00.000Z",
      cardId: "card_daily_mode_recent_one",
      entryId: "term_daily_mode_one",
      id: "review_log_daily_mode_one_hard",
      rating: "hard"
    }),
    buildReviewLog({
      answeredAt: "2026-06-09T08:00:00.000Z",
      cardId: "card_daily_mode_recent_two",
      entryId: "term_daily_mode_two",
      id: "review_log_daily_mode_two_hard",
      rating: "hard"
    }),
    buildReviewLog({
      answeredAt: "2026-06-09T08:00:00.000Z",
      cardId: "card_daily_mode_recent_three",
      entryId: "term_daily_mode_three",
      id: "review_log_daily_mode_three_again",
      rating: "again"
    }),
    buildReviewLog({
      answeredAt: "2026-06-09T08:00:00.000Z",
      cardId: "card_daily_mode_recent_four",
      entryId: "term_daily_mode_four",
      id: "review_log_daily_mode_four_again",
      rating: "again"
    }),
    buildReviewLog({
      answeredAt: "2026-06-09T08:00:00.000Z",
      cardId: "card_daily_mode_other_old",
      entryId: "term_daily_mode_other_old",
      id: "review_log_daily_mode_other_old_hard",
      rating: "hard"
    })
  ]);
}

async function seedCrossMediaGlossarySearchEntries(database: TestDatabase) {
  await database.insert(crossMediaGroup).values({
    id: "group_daily_glossary_search",
    createdAt: nowIso,
    entryType: "term",
    groupKey: "daily-glossary-shared",
    updatedAt: nowIso
  });
  await database.insert(term).values([
    buildTerm({
      crossMediaGroupId: "group_daily_glossary_search",
      id: "term_daily_glossary_search_primary",
      lemma: "共有",
      meaningIt: "voce primaria",
      reading: "きょうゆう",
      romaji: "kyouyuu"
    }),
    buildTerm({
      crossMediaGroupId: "group_daily_glossary_search",
      id: "term_daily_glossary_search_secondary",
      lemma: "共有",
      meaningIt: "testo solo secondario",
      reading: "きょうゆう",
      romaji: "kyouyuu"
    })
  ]);
}

function buildLesson(input: {
  id: string;
  mediaId?: string;
  orderIndex: number;
  segmentId?: string;
  slug: string;
  title: string;
}) {
  return {
    id: input.id,
    createdAt: nowIso,
    difficulty: "beginner",
    mediaId: input.mediaId ?? developmentFixture.mediaId,
    orderIndex: input.orderIndex,
    segmentId: input.segmentId ?? developmentFixture.segmentId,
    slug: input.slug,
    sourceFile: `tests/fixtures/daily-kanji/${input.slug}.md`,
    status: "active" as const,
    summary: input.title,
    title: input.title,
    updatedAt: nowIso
  };
}

function buildLessonProgress(
  lessonId: string,
  status: "completed" | "in_progress",
  input: {
    completedAt?: string;
  } = {}
) {
  return {
    completedAt: status === "completed" ? (input.completedAt ?? nowIso) : null,
    lastOpenedAt: nowIso,
    lessonId,
    startedAt: nowIso,
    status
  };
}

function buildTerm(input: {
  audioSrc?: string;
  crossMediaGroupId?: string;
  id: string;
  lemma: string;
  mediaId?: string;
  meaningIt: string;
  pitchAccent?: number;
  pitchAccentSource?: string;
  reading: string;
  romaji: string;
  segmentId?: string;
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
    crossMediaGroupId: input.crossMediaGroupId ?? null,
    levelHint: null,
    lemma: input.lemma,
    meaningIt: input.meaningIt,
    meaningLiteralIt: null,
    mediaId: input.mediaId ?? developmentFixture.mediaId,
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
    segmentId: input.segmentId ?? developmentFixture.segmentId,
    sourceId: input.id,
    updatedAt: nowIso
  };
}

function buildCard(input: {
  front: string;
  id: string;
  lessonId?: string;
  mediaId?: string;
  notes?: string;
  orderIndex: number;
  segmentId?: string;
}) {
  return {
    id: input.id,
    back: `${input.front} back`,
    cardType: "recognition",
    createdAt: nowIso,
    exampleIt: `${input.front} esempio`,
    exampleJp: `${input.front}を見た。`,
    front: input.front,
    lessonId: input.lessonId ?? developmentFixture.lessonId,
    mediaId: input.mediaId ?? developmentFixture.mediaId,
    normalizedFront: input.front,
    notesIt: input.notes ?? `${input.front} note`,
    orderIndex: input.orderIndex,
    segmentId: input.segmentId ?? developmentFixture.segmentId,
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

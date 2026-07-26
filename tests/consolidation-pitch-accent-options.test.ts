import { describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/db";
import {
  card,
  cardEntryLink,
  lesson,
  media,
  preReviewConsolidationState,
  term
} from "@/db/schema";
import { getConsolidationSessionData } from "@/features/consolidation/server";
import { buildReviewSubjectIdentityFromCanonical } from "@/features/review/model/subject";

import { withTestDatabase } from "./helpers/test-db";

const createdAt = "2026-04-01T09:00:00.000Z";
const yomuIdentity = buildPitchTermIdentity(
  "card_pitch_yomu",
  "term_pitch_yomu"
);
const kakuIdentity = buildPitchTermIdentity(
  "card_pitch_kaku",
  "term_pitch_kaku"
);

describe("consolidation pitch accent options", () => {
  it("adds pitch accent data to reading choices without adding it to meaning choices", async () => {
    await withTestDatabase(
      { prefix: "jcs-consolidation-pitch-" },
      async ({ database }) => {
        await seedPitchAccentConsolidation(database);

        const session = await getConsolidationSessionData({
          database,
          lessonSlug: "pitch-intro",
          mediaSlug: "pitch-media"
        });
        const subject = session?.subjects.find(
          (item) => item.subjectKey === yomuIdentity.subjectKey
        );
        const readingStep = subject?.steps.find(
          (step) => step.step === "reading"
        );
        const meaningStep = subject?.steps.find(
          (step) => step.step === "meaning"
        );

        expect(readingStep?.options).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              label: "よむ",
              pitchAccent: expect.objectContaining({
                downstep: 1,
                morae: ["よ", "む"],
                shape: "atamadaka"
              })
            }),
            expect.objectContaining({
              label: "かく",
              pitchAccent: expect.objectContaining({
                downstep: 0,
                morae: ["か", "く"],
                shape: "heiban"
              })
            })
          ])
        );
        expect(
          meaningStep?.options.find((option) => option.label === "leggere")
        ).not.toHaveProperty("pitchAccent");
      }
    );
  });
});

async function seedPitchAccentConsolidation(database: DatabaseClient) {
  await database.insert(media).values({
    id: "media_pitch",
    slug: "pitch-media",
    title: "Pitch Media",
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: "Pitch fixture",
    status: "active",
    createdAt,
    updatedAt: createdAt
  });
  await database.insert(lesson).values({
    id: "lesson_pitch",
    mediaId: "media_pitch",
    segmentId: null,
    slug: "pitch-intro",
    title: "Pitch Intro",
    orderIndex: 1,
    difficulty: "beginner",
    summary: "Pitch lesson",
    status: "active",
    sourceFile: "tests/consolidation/pitch.md",
    createdAt,
    updatedAt: createdAt
  });
  await database.insert(term).values([
    {
      id: "term_pitch_yomu",
      sourceId: "pitch-yomu",
      mediaId: "media_pitch",
      segmentId: null,
      lemma: "読む",
      reading: "よむ",
      romaji: "yomu",
      meaningIt: "leggere",
      pitchAccent: 1,
      searchLemmaNorm: "読む",
      searchReadingNorm: "よむ",
      searchRomajiNorm: "yomu",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "term_pitch_kaku",
      sourceId: "pitch-kaku",
      mediaId: "media_pitch",
      segmentId: null,
      lemma: "書く",
      reading: "かく",
      romaji: "kaku",
      meaningIt: "scrivere",
      pitchAccent: 0,
      searchLemmaNorm: "書く",
      searchReadingNorm: "かく",
      searchRomajiNorm: "kaku",
      createdAt,
      updatedAt: createdAt
    }
  ]);
  await database.insert(card).values([
    {
      id: "card_pitch_yomu",
      mediaId: "media_pitch",
      lessonId: "lesson_pitch",
      segmentId: null,
      sourceFile: "tests/consolidation/pitch-cards.md",
      cardType: "recognition",
      front: "{{読|よ}}む",
      back: "leggere",
      status: "active",
      orderIndex: 1,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "card_pitch_kaku",
      mediaId: "media_pitch",
      lessonId: "lesson_pitch",
      segmentId: null,
      sourceFile: "tests/consolidation/pitch-cards.md",
      cardType: "recognition",
      front: "{{書|か}}く",
      back: "scrivere",
      status: "active",
      orderIndex: 2,
      createdAt,
      updatedAt: createdAt
    }
  ]);
  await database.insert(cardEntryLink).values([
    {
      id: "link_pitch_yomu",
      cardId: "card_pitch_yomu",
      entryType: "term",
      entryId: "term_pitch_yomu",
      relationshipType: "primary"
    },
    {
      id: "link_pitch_kaku",
      cardId: "card_pitch_kaku",
      entryType: "term",
      entryId: "term_pitch_kaku",
      relationshipType: "primary"
    }
  ]);
  await database.insert(preReviewConsolidationState).values([
    {
      canonicalSubjectKey: yomuIdentity.canonicalSubjectKey,
      recallTask: yomuIdentity.recallTask,
      subjectKey: yomuIdentity.subjectKey,
      subjectType: "entry",
      entryType: "term",
      entryId: "term_pitch_yomu",
      representativeCardId: "card_pitch_yomu",
      lessonId: "lesson_pitch",
      mediaId: "media_pitch",
      status: "pending",
      attemptCount: 0,
      createdAt,
      updatedAt: createdAt
    },
    {
      canonicalSubjectKey: kakuIdentity.canonicalSubjectKey,
      recallTask: kakuIdentity.recallTask,
      subjectKey: kakuIdentity.subjectKey,
      subjectType: "entry",
      entryType: "term",
      entryId: "term_pitch_kaku",
      representativeCardId: "card_pitch_kaku",
      lessonId: "lesson_pitch",
      mediaId: "media_pitch",
      status: "pending",
      attemptCount: 0,
      createdAt,
      updatedAt: createdAt
    }
  ]);
}

function buildPitchTermIdentity(cardId: string, entryId: string) {
  return buildReviewSubjectIdentityFromCanonical({
    cardId,
    cardType: "recognition",
    canonicalSubjectKey: `entry:term:${entryId}`,
    crossMediaGroupId: null,
    entryId,
    entryType: "term",
    subjectKind: "entry"
  });
}

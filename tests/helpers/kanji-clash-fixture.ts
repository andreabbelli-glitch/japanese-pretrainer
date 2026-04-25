import {
  card,
  cardEntryLink,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  segment,
  term
} from "@/db/schema";
import type { DatabaseClient } from "@/db";

type SeedKanjiClashFixtureOptions = {
  includeSecondaryMedia?: boolean;
};

export async function seedKanjiClashFixture(
  database: DatabaseClient,
  options: SeedKanjiClashFixtureOptions = {}
) {
  const now = "2026-04-08T12:00:00.000Z";

  await seedAlphaMedia(database, now);

  if (options.includeSecondaryMedia) {
    await seedBetaMedia(database, now);
  }
}

async function seedAlphaMedia(database: DatabaseClient, now: string) {
  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt: now,
    description: "Alpha media",
    id: "media-alpha",
    language: "ja",
    mediaType: "game",
    segmentKind: "chapter",
    slug: "alpha",
    status: "active",
    title: "Alpha",
    updatedAt: now
  });
  await database.insert(segment).values({
    id: "segment-alpha",
    mediaId: "media-alpha",
    notes: null,
    orderIndex: 1,
    segmentType: "chapter",
    slug: "segment-alpha",
    title: "Segment alpha"
  });
  await database.insert(lesson).values({
    createdAt: now,
    difficulty: "beginner",
    id: "lesson-alpha",
    mediaId: "media-alpha",
    orderIndex: 1,
    segmentId: "segment-alpha",
    slug: "lesson-alpha",
    sourceFile: "tests/lesson-alpha.md",
    status: "active",
    summary: "Lesson alpha",
    title: "Lesson alpha",
    updatedAt: now
  });
  await database.insert(lessonProgress).values({
    completedAt: now,
    lastOpenedAt: now,
    lessonId: "lesson-alpha",
    startedAt: now,
    status: "completed"
  });
  await database.insert(term).values([
    buildTermRow(
      {
        id: "term-alpha-shokuhi",
        lemma: "食費",
        meaningIt: "spese per il cibo",
        mediaId: "media-alpha",
        reading: "しょくひ",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-shokuhi"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-shokuhin",
        lemma: "食品",
        meaningIt: "alimento",
        mediaId: "media-alpha",
        reading: "しょくひん",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-shokuhin"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-shokutaku",
        lemma: "食卓",
        meaningIt: "tavolo da pranzo",
        mediaId: "media-alpha",
        reading: "しょくたく",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-shokutaku"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-inshoku",
        lemma: "飲食",
        meaningIt: "cibo e bevande",
        mediaId: "media-alpha",
        reading: "いんしょく",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-inshoku"
      },
      now
    )
  ]);
  await database
    .insert(card)
    .values([
      buildCardRow(
        "card-alpha-shokuhi",
        "食費",
        "lesson-alpha",
        "media-alpha",
        "segment-alpha",
        now
      ),
      buildCardRow(
        "card-alpha-shokuhin",
        "食品",
        "lesson-alpha",
        "media-alpha",
        "segment-alpha",
        now
      ),
      buildCardRow(
        "card-alpha-shokutaku",
        "食卓",
        "lesson-alpha",
        "media-alpha",
        "segment-alpha",
        now
      ),
      buildCardRow(
        "card-alpha-inshoku",
        "飲食",
        "lesson-alpha",
        "media-alpha",
        "segment-alpha",
        now
      )
    ]);
  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLinkRow("card-alpha-shokuhi", "term-alpha-shokuhi"),
      buildCardEntryLinkRow("card-alpha-shokuhin", "term-alpha-shokuhin"),
      buildCardEntryLinkRow("card-alpha-shokutaku", "term-alpha-shokutaku"),
      buildCardEntryLinkRow("card-alpha-inshoku", "term-alpha-inshoku")
    ]);
  await database
    .insert(reviewSubjectState)
    .values([
      buildReviewSubjectStateRow(
        "card-alpha-shokuhi",
        "term-alpha-shokuhi",
        "entry:term:term-alpha-shokuhi",
        now,
        8.2,
        3,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-alpha-shokuhin",
        "term-alpha-shokuhin",
        "entry:term:term-alpha-shokuhin",
        now,
        9.1,
        4,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-alpha-shokutaku",
        "term-alpha-shokutaku",
        "entry:term:term-alpha-shokutaku",
        now,
        8.7,
        3,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-alpha-inshoku",
        "term-alpha-inshoku",
        "entry:term:term-alpha-inshoku",
        now,
        10.2,
        5,
        "relearning"
      )
    ]);
}

async function seedBetaMedia(database: DatabaseClient, now: string) {
  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt: now,
    description: "Beta media",
    id: "media-beta",
    language: "ja",
    mediaType: "anime",
    segmentKind: "episode",
    slug: "beta",
    status: "active",
    title: "Beta",
    updatedAt: now
  });
  await database.insert(segment).values({
    id: "segment-beta",
    mediaId: "media-beta",
    notes: null,
    orderIndex: 1,
    segmentType: "episode",
    slug: "segment-beta",
    title: "Segment beta"
  });
  await database.insert(lesson).values({
    createdAt: now,
    difficulty: "beginner",
    id: "lesson-beta",
    mediaId: "media-beta",
    orderIndex: 1,
    segmentId: "segment-beta",
    slug: "lesson-beta",
    sourceFile: "tests/lesson-beta.md",
    status: "active",
    summary: "Lesson beta",
    title: "Lesson beta",
    updatedAt: now
  });
  await database.insert(lessonProgress).values({
    completedAt: now,
    lastOpenedAt: now,
    lessonId: "lesson-beta",
    startedAt: now,
    status: "completed"
  });
  await database.insert(term).values([
    buildTermRow(
      {
        id: "term-beta-kaigan",
        lemma: "海岸",
        meaningIt: "costa",
        mediaId: "media-beta",
        reading: "かいがん",
        segmentId: "segment-beta",
        sourceId: "term-beta-kaigan"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-beta-kaiyou",
        lemma: "海洋",
        meaningIt: "oceano",
        mediaId: "media-beta",
        reading: "かいよう",
        segmentId: "segment-beta",
        sourceId: "term-beta-kaiyou"
      },
      now
    )
  ]);
  await database
    .insert(card)
    .values([
      buildCardRow(
        "card-beta-kaigan",
        "海岸",
        "lesson-beta",
        "media-beta",
        "segment-beta",
        now
      ),
      buildCardRow(
        "card-beta-kaiyou",
        "海洋",
        "lesson-beta",
        "media-beta",
        "segment-beta",
        now
      )
    ]);
  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLinkRow("card-beta-kaigan", "term-beta-kaigan"),
      buildCardEntryLinkRow("card-beta-kaiyou", "term-beta-kaiyou")
    ]);
  await database
    .insert(reviewSubjectState)
    .values([
      buildReviewSubjectStateRow(
        "card-beta-kaigan",
        "term-beta-kaigan",
        "entry:term:term-beta-kaigan",
        now,
        8.6,
        3,
        "review"
      ),
      buildReviewSubjectStateRow(
        "card-beta-kaiyou",
        "term-beta-kaiyou",
        "entry:term:term-beta-kaiyou",
        now,
        8.9,
        4,
        "review"
      )
    ]);
}

function buildTermRow(
  input: {
    id: string;
    lemma: string;
    meaningIt: string;
    mediaId: string;
    reading: string;
    segmentId: string;
    sourceId: string;
  },
  now: string
) {
  return {
    createdAt: now,
    crossMediaGroupId: null,
    id: input.id,
    lemma: input.lemma,
    meaningIt: input.meaningIt,
    mediaId: input.mediaId,
    reading: input.reading,
    romaji: input.reading,
    searchLemmaNorm: input.lemma,
    searchReadingNorm: input.reading,
    searchRomajiNorm: input.reading,
    segmentId: input.segmentId,
    sourceId: input.sourceId,
    updatedAt: now
  };
}

function buildCardRow(
  id: string,
  front: string,
  lessonId: string,
  mediaId: string,
  segmentId: string,
  now: string
): typeof card.$inferInsert {
  return {
    back: `${front} meaning`,
    cardType: "recognition",
    createdAt: now,
    front,
    id,
    lessonId,
    mediaId,
    normalizedFront: front,
    orderIndex: 1,
    segmentId,
    sourceFile: `tests/${id}.md`,
    status: "active",
    updatedAt: now
  };
}

function buildCardEntryLinkRow(cardId: string, entryId: string) {
  return {
    cardId,
    entryId,
    entryType: "term" as const,
    id: `${cardId}-${entryId}`,
    relationshipType: "primary" as const
  };
}

function buildReviewSubjectStateRow(
  cardId: string,
  entryId: string,
  subjectKey: string,
  now: string,
  stability: number,
  reps: number,
  state: "review" | "relearning"
) {
  return {
    cardId,
    createdAt: now,
    crossMediaGroupId: null,
    difficulty: 2.5,
    dueAt: now,
    entryId,
    entryType: "term" as const,
    lapses: 0,
    lastInteractionAt: now,
    lastReviewedAt: now,
    learningSteps: 0,
    manualOverride: false,
    reps,
    scheduledDays: 3,
    stability,
    state,
    subjectKey,
    subjectType: "entry" as const,
    suspended: false,
    updatedAt: now
  };
}

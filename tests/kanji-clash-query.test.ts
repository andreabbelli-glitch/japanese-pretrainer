import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  createDatabaseClient,
  crossMediaGroup,
  grammarPattern,
  lesson,
  lessonProgress,
  listEligibleKanjiClashSubjects,
  media,
  reviewSubjectState,
  runMigrations,
  segment,
  term,
  type DatabaseClient
} from "@/db";

describe("kanji clash eligibility query", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-query-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedKanjiClashEligibilityFixture(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns only active term subjects that satisfy the conservative review thresholds", async () => {
    const subjects = await listEligibleKanjiClashSubjects(database);
    const subjectsByKey = new Map(
      subjects.map((subject) => [subject.subjectKey, subject])
    );

    expect([...subjectsByKey.keys()]).toEqual([
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-beta-shokuhin",
      "group:term:group-term-mixed",
      "group:term:group-term-shared"
    ]);

    expect(subjectsByKey.get("entry:term:term-alpha-shokuhi")).toMatchObject({
      kanji: ["食", "費"],
      reps: 3,
      source: {
        entryId: "term-alpha-shokuhi",
        type: "entry"
      },
      subjectKey: "entry:term:term-alpha-shokuhi"
    });

    expect(subjectsByKey.get("group:term:group-term-shared")).toMatchObject({
      kanji: ["観", "点"],
      source: {
        crossMediaGroupId: "group-term-shared",
        type: "group"
      },
      subjectKey: "group:term:group-term-shared"
    });
    expect(
      subjectsByKey
        .get("group:term:group-term-shared")
        ?.members.map((member) => member.entryId)
    ).toEqual(["term-alpha-kanten", "term-beta-kanten"]);

    expect(subjectsByKey.get("group:term:group-term-mixed")).toMatchObject({
      kanji: ["観", "点"],
      label: "観点",
      reading: "かんてん",
      source: {
        crossMediaGroupId: "group-term-mixed",
        type: "group"
      },
      subjectKey: "group:term:group-term-mixed"
    });
    expect(
      subjectsByKey
        .get("group:term:group-term-mixed")
        ?.members.map((member) => member.entryId)
    ).toEqual(["term-alpha-kanten-live"]);
    expect(
      subjectsByKey.get("group:term:group-term-mixed")?.surfaceForms
    ).toEqual(["観点"]);
    expect(
      subjectsByKey.get("group:term:group-term-mixed")?.readingForms
    ).toEqual(["かんてん"]);
  });

  it("keeps the default scope on active media while honoring explicit media filters", async () => {
    const defaultSubjects = await listEligibleKanjiClashSubjects(database);
    const defaultSubjectKeys = new Set(
      defaultSubjects.map((subject) => subject.subjectKey)
    );

    expect(defaultSubjectKeys.has("entry:term:term-gamma-keiken")).toBe(false);

    const archivedMediaSubjects = await listEligibleKanjiClashSubjects(
      database,
      {
        mediaIds: ["media-gamma"]
      }
    );

    expect(archivedMediaSubjects.map((subject) => subject.subjectKey)).toEqual([
      "entry:term:term-gamma-keiken"
    ]);
    expect(archivedMediaSubjects[0]).toMatchObject({
      kanji: ["経", "験"],
      source: {
        entryId: "term-gamma-keiken",
        type: "entry"
      },
      subjectKey: "entry:term:term-gamma-keiken"
    });
  });

  it("preserves singleton-card semantics across primary, fallback, and non-primary concept links", async () => {
    const now = "2026-04-08T13:00:00.000Z";

    await database.insert(grammarPattern).values(
      buildGrammarPatternRow(
        {
          id: "grammar-alpha-extra-link",
          meaningIt: "grammatica extra",
          mediaId: "media-alpha",
          pattern: "〜追加",
          reading: "ついか",
          segmentId: "segment-alpha",
          sourceId: "grammar-alpha-extra-link",
          title: "Grammar extra"
        },
        now
      )
    );

    await database.insert(term).values([
      buildTermRow(
        {
          id: "term-alpha-ambiguous-primary",
          lemma: "主語",
          mediaId: "media-alpha",
          meaningIt: "soggetto",
          reading: "しゅご",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-ambiguous-primary"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-ambiguous-fallback",
          lemma: "図形",
          mediaId: "media-alpha",
          meaningIt: "figura",
          reading: "ずけい",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-ambiguous-fallback"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-secondary-concept",
          lemma: "余白",
          mediaId: "media-alpha",
          meaningIt: "margine",
          reading: "よはく",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-secondary-concept"
        },
        now
      )
    ]);

    await database.insert(card).values([
      buildCardRow(
        {
          id: "card-alpha-ambiguous-primary",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "主語",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-ambiguous-fallback",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "図形",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          cardType: "concept",
          id: "card-alpha-secondary-concept",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "非正規な表面",
          normalizedFront: "非正規な表面",
          segmentId: "segment-alpha"
        },
        now
      )
    ]);

    await database.insert(cardEntryLink).values([
      buildCardEntryLinkRow("card-alpha-ambiguous-primary", "term-alpha-ambiguous-primary"),
      buildCardEntryLinkRow("card-alpha-ambiguous-primary", "grammar-alpha-extra-link", {
        entryType: "grammar",
        id: "card-alpha-ambiguous-primary-grammar-alpha-extra-link"
      }),
      buildCardEntryLinkRow("card-alpha-ambiguous-fallback", "term-alpha-ambiguous-fallback", {
        id: "card-alpha-ambiguous-fallback-term-alpha-ambiguous-fallback",
        relationshipType: "secondary"
      }),
      buildCardEntryLinkRow("card-alpha-ambiguous-fallback", "grammar-alpha-extra-link", {
        entryType: "grammar",
        id: "card-alpha-ambiguous-fallback-grammar-alpha-extra-link",
        relationshipType: "secondary"
      }),
      buildCardEntryLinkRow("card-alpha-secondary-concept", "term-alpha-secondary-concept", {
        id: "card-alpha-secondary-concept-term-alpha-secondary-concept",
        relationshipType: "secondary"
      })
    ]);

    await database.insert(reviewSubjectState).values([
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-ambiguous-primary",
          entryId: "term-alpha-ambiguous-primary",
          reps: 3,
          stability: 8.1,
          subjectKey: "entry:term:term-alpha-ambiguous-primary",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-ambiguous-fallback",
          entryId: "term-alpha-ambiguous-fallback",
          reps: 3,
          stability: 8.3,
          subjectKey: "entry:term:term-alpha-ambiguous-fallback",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-secondary-concept",
          entryId: "term-alpha-secondary-concept",
          reps: 4,
          stability: 9.2,
          subjectKey: "entry:term:term-alpha-secondary-concept",
          subjectType: "entry"
        },
        now
      )
    ]);

    const subjectKeys = new Set(
      (await listEligibleKanjiClashSubjects(database)).map(
        (subject) => subject.subjectKey
      )
    );

    expect(subjectKeys.has("entry:term:term-alpha-ambiguous-primary")).toBe(
      false
    );
    expect(subjectKeys.has("entry:term:term-alpha-ambiguous-fallback")).toBe(
      false
    );
    expect(subjectKeys.has("entry:term:term-alpha-secondary-concept")).toBe(
      true
    );
  });

  it("excludes kana-only fronts, phrase fragments, and light qualifier compounds from the pool", async () => {
    const now = "2026-04-08T14:00:00.000Z";

    await database.insert(term).values([
      buildTermRow(
        {
          id: "term-alpha-abyss-rush",
          lemma: "深淵疾走",
          mediaId: "media-alpha",
          meaningIt: "abyss rush",
          reading: "しんえんしっそう",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-abyss-rush"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-card-exchange",
          lemma: "交換",
          mediaId: "media-alpha",
          meaningIt: "scambio",
          reading: "こうかん",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-card-exchange"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-bottom-fragment",
          lemma: "一番下",
          mediaId: "media-alpha",
          meaningIt: "fondo",
          reading: "いちばんした",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-bottom-fragment"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-use-question",
          lemma: "使う",
          mediaId: "media-alpha",
          meaningIt: "usare",
          reading: "つかう",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-use-question"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-pokemon-zukan",
          lemma: "図鑑",
          mediaId: "media-alpha",
          meaningIt: "pokedex",
          reading: "ずかん",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-pokemon-zukan"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-evolution-creature",
          lemma: "進化クリーチャー",
          mediaId: "media-alpha",
          meaningIt: "creatura evoluzione",
          reading: "しんかクリーチャー",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-evolution-creature"
        },
        now
      ),
      buildTermRow(
        {
          id: "term-alpha-tap-state",
          lemma: "状態",
          mediaId: "media-alpha",
          meaningIt: "stato",
          reading: "じょうたい",
          segmentId: "segment-alpha",
          sourceId: "term-alpha-tap-state"
        },
        now
      )
    ]);

    await database.insert(card).values([
      buildCardRow(
        {
          id: "card-alpha-abyss-rush",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "アビスラッシュ",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-card-exchange",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "カード交換",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-bottom-fragment",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "山札の一番下",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-use-question",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "どの ポケモンに 使いますか？",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-pokemon-zukan",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "ポケモン図鑑",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-evolution-creature",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "進化クリーチャー",
          segmentId: "segment-alpha"
        },
        now
      ),
      buildCardRow(
        {
          id: "card-alpha-tap-state",
          lessonId: "lesson-alpha",
          mediaId: "media-alpha",
          front: "タップ状態",
          segmentId: "segment-alpha"
        },
        now
      )
    ]);

    await database.insert(cardEntryLink).values([
      buildCardEntryLinkRow("card-alpha-abyss-rush", "term-alpha-abyss-rush"),
      buildCardEntryLinkRow(
        "card-alpha-card-exchange",
        "term-alpha-card-exchange"
      ),
      buildCardEntryLinkRow(
        "card-alpha-bottom-fragment",
        "term-alpha-bottom-fragment"
      ),
      buildCardEntryLinkRow("card-alpha-use-question", "term-alpha-use-question"),
      buildCardEntryLinkRow(
        "card-alpha-pokemon-zukan",
        "term-alpha-pokemon-zukan"
      ),
      buildCardEntryLinkRow(
        "card-alpha-evolution-creature",
        "term-alpha-evolution-creature"
      ),
      buildCardEntryLinkRow("card-alpha-tap-state", "term-alpha-tap-state")
    ]);

    await database.insert(reviewSubjectState).values([
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-abyss-rush",
          entryId: "term-alpha-abyss-rush",
          reps: 3,
          stability: 8.6,
          subjectKey: "entry:term:term-alpha-abyss-rush",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-card-exchange",
          entryId: "term-alpha-card-exchange",
          reps: 3,
          stability: 8.8,
          subjectKey: "entry:term:term-alpha-card-exchange",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-bottom-fragment",
          entryId: "term-alpha-bottom-fragment",
          reps: 3,
          stability: 8.9,
          subjectKey: "entry:term:term-alpha-bottom-fragment",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-use-question",
          entryId: "term-alpha-use-question",
          reps: 3,
          stability: 9.1,
          subjectKey: "entry:term:term-alpha-use-question",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-pokemon-zukan",
          entryId: "term-alpha-pokemon-zukan",
          reps: 3,
          stability: 9.2,
          subjectKey: "entry:term:term-alpha-pokemon-zukan",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-evolution-creature",
          entryId: "term-alpha-evolution-creature",
          reps: 3,
          stability: 9.3,
          subjectKey: "entry:term:term-alpha-evolution-creature",
          subjectType: "entry"
        },
        now
      ),
      buildReviewSubjectStateRow(
        {
          cardId: "card-alpha-tap-state",
          entryId: "term-alpha-tap-state",
          reps: 3,
          stability: 9.4,
          subjectKey: "entry:term:term-alpha-tap-state",
          subjectType: "entry"
        },
        now
      )
    ]);

    const subjectKeys = new Set(
      (await listEligibleKanjiClashSubjects(database)).map(
        (subject) => subject.subjectKey
      )
    );

    expect(subjectKeys.has("entry:term:term-alpha-abyss-rush")).toBe(false);
    expect(subjectKeys.has("entry:term:term-alpha-card-exchange")).toBe(false);
    expect(subjectKeys.has("entry:term:term-alpha-bottom-fragment")).toBe(false);
    expect(subjectKeys.has("entry:term:term-alpha-use-question")).toBe(false);
    expect(subjectKeys.has("entry:term:term-alpha-pokemon-zukan")).toBe(false);
    expect(subjectKeys.has("entry:term:term-alpha-evolution-creature")).toBe(
      false
    );
    expect(subjectKeys.has("entry:term:term-alpha-tap-state")).toBe(false);
  });
});

async function seedKanjiClashEligibilityFixture(database: DatabaseClient) {
  const now = "2026-04-08T12:00:00.000Z";

  await database.insert(media).values([
    {
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
    },
    {
      baseExplanationLanguage: "it",
      createdAt: now,
      description: "Beta media",
      id: "media-beta",
      language: "ja",
      mediaType: "game",
      segmentKind: "chapter",
      slug: "beta",
      status: "active",
      title: "Beta",
      updatedAt: now
    },
    {
      baseExplanationLanguage: "it",
      createdAt: now,
      description: "Gamma media archived",
      id: "media-gamma",
      language: "ja",
      mediaType: "game",
      segmentKind: "chapter",
      slug: "gamma",
      status: "archived",
      title: "Gamma",
      updatedAt: now
    }
  ]);

  await database.insert(segment).values([
    {
      id: "segment-alpha",
      mediaId: "media-alpha",
      notes: null,
      orderIndex: 1,
      segmentType: "chapter",
      slug: "segment-alpha",
      title: "Segment alpha"
    },
    {
      id: "segment-beta",
      mediaId: "media-beta",
      notes: null,
      orderIndex: 1,
      segmentType: "chapter",
      slug: "segment-beta",
      title: "Segment beta"
    },
    {
      id: "segment-gamma",
      mediaId: "media-gamma",
      notes: null,
      orderIndex: 1,
      segmentType: "chapter",
      slug: "segment-gamma",
      title: "Segment gamma"
    }
  ]);

  await database.insert(lesson).values([
    {
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
    },
    {
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
    },
    {
      createdAt: now,
      difficulty: "beginner",
      id: "lesson-gamma",
      mediaId: "media-gamma",
      orderIndex: 1,
      segmentId: "segment-gamma",
      slug: "lesson-gamma",
      sourceFile: "tests/lesson-gamma.md",
      status: "active",
      summary: "Lesson gamma",
      title: "Lesson gamma",
      updatedAt: now
    },
    {
      createdAt: now,
      difficulty: "beginner",
      id: "lesson-alpha-inactive",
      mediaId: "media-alpha",
      orderIndex: 2,
      segmentId: "segment-alpha",
      slug: "lesson-alpha-inactive",
      sourceFile: "tests/lesson-alpha-inactive.md",
      status: "archived",
      summary: "Lesson alpha inactive",
      title: "Lesson alpha inactive",
      updatedAt: now
    },
    {
      createdAt: now,
      difficulty: "beginner",
      id: "lesson-beta-in-progress",
      mediaId: "media-beta",
      orderIndex: 2,
      segmentId: "segment-beta",
      slug: "lesson-beta-in-progress",
      sourceFile: "tests/lesson-beta-in-progress.md",
      status: "active",
      summary: "Lesson beta in progress",
      title: "Lesson beta in progress",
      updatedAt: now
    }
  ]);

  await database.insert(lessonProgress).values([
    {
      completedAt: now,
      lastOpenedAt: now,
      lessonId: "lesson-alpha",
      startedAt: now,
      status: "completed"
    },
    {
      completedAt: now,
      lastOpenedAt: now,
      lessonId: "lesson-beta",
      startedAt: now,
      status: "completed"
    },
    {
      completedAt: now,
      lastOpenedAt: now,
      lessonId: "lesson-gamma",
      startedAt: now,
      status: "completed"
    },
    {
      completedAt: now,
      lastOpenedAt: now,
      lessonId: "lesson-alpha-inactive",
      startedAt: now,
      status: "completed"
    },
    {
      completedAt: null,
      lastOpenedAt: now,
      lessonId: "lesson-beta-in-progress",
      startedAt: now,
      status: "in_progress"
    }
  ]);

  await database.insert(crossMediaGroup).values({
    createdAt: now,
    entryType: "term",
    groupKey: "shared-kanten",
    id: "group-term-shared",
    updatedAt: now
  });

  await database.insert(crossMediaGroup).values({
    createdAt: now,
    entryType: "term",
    groupKey: "mixed-kanten",
    id: "group-term-mixed",
    updatedAt: now
  });

  await database.insert(term).values([
    buildTermRow(
      {
        id: "term-alpha-shokuhi",
        lemma: "食費",
        mediaId: "media-alpha",
        meaningIt: "spese per il cibo",
        reading: "しょくひ",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-shokuhi"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-beta-shokuhin",
        lemma: "食品",
        mediaId: "media-beta",
        meaningIt: "alimento",
        reading: "しょくひん",
        segmentId: "segment-beta",
        sourceId: "term-beta-shokuhin"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-gamma-keiken",
        lemma: "経験",
        mediaId: "media-gamma",
        meaningIt: "esperienza",
        reading: "けいけん",
        segmentId: "segment-gamma",
        sourceId: "term-gamma-keiken"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-alpha-kana-only",
        lemma: "こすと",
        mediaId: "media-alpha",
        meaningIt: "termine solo kana",
        reading: "こすと",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-kana-only"
      },
      now
    ),
    buildTermRow(
      {
        crossMediaGroupId: "group-term-shared",
        id: "term-alpha-kanten",
        lemma: "観点",
        mediaId: "media-alpha",
        meaningIt: "punto di vista alpha",
        reading: "かんてん",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-kanten"
      },
      now
    ),
    buildTermRow(
      {
        crossMediaGroupId: "group-term-shared",
        id: "term-beta-kanten",
        lemma: "観点",
        mediaId: "media-beta",
        meaningIt: "punto di vista beta",
        reading: "かんてん",
        segmentId: "segment-beta",
        sourceId: "term-beta-kanten"
      },
      now
    ),
    buildTermRow(
      {
        crossMediaGroupId: "group-term-mixed",
        id: "term-alpha-kanten-live",
        lemma: "観点",
        mediaId: "media-alpha",
        meaningIt: "punto di vista valido",
        reading: "かんてん",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-kanten-live"
      },
      now
    ),
    buildTermRow(
      {
        crossMediaGroupId: "group-term-mixed",
        id: "term-alpha-kanten-inactive",
        lemma: "案点",
        mediaId: "media-alpha",
        meaningIt: "punto di vista inattivo",
        reading: "あんてん",
        segmentId: "segment-alpha",
        sourceId: "term-alpha-kanten-inactive"
      },
      now
    ),
    buildTermRow(
      {
        crossMediaGroupId: "group-term-mixed",
        id: "term-beta-kanten-pending",
        lemma: "論点",
        mediaId: "media-beta",
        meaningIt: "punto di vista non completato",
        reading: "ろんてん",
        segmentId: "segment-beta",
        sourceId: "term-beta-kanten-pending"
      },
      now
    ),
    buildTermRow(
      {
        crossMediaGroupId: "group-term-mixed",
        id: "term-beta-kanten-noncanonical",
        lemma: "観点",
        mediaId: "media-beta",
        meaningIt: "punto di vista con front non canonico",
        reading: "かんてん",
        segmentId: "segment-beta",
        sourceId: "term-beta-kanten-noncanonical"
      },
      now
    ),
    buildTermRow(
      {
        id: "term-beta-low-stability",
        lemma: "情報",
        mediaId: "media-beta",
        meaningIt: "informazione",
        reading: "じょうほう",
        segmentId: "segment-beta",
        sourceId: "term-beta-low-stability"
      },
      now
    )
  ]);

  await database.insert(card).values([
    buildCardRow(
      {
        id: "card-alpha-shokuhi",
        lessonId: "lesson-alpha",
        mediaId: "media-alpha",
        front: "食費",
        segmentId: "segment-alpha"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-beta-shokuhin",
        lessonId: "lesson-beta",
        mediaId: "media-beta",
        front: "食品",
        segmentId: "segment-beta"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-gamma-keiken",
        lessonId: "lesson-gamma",
        mediaId: "media-gamma",
        front: "経験",
        segmentId: "segment-gamma"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-alpha-kana-only",
        lessonId: "lesson-alpha",
        mediaId: "media-alpha",
        front: "こすと",
        segmentId: "segment-alpha"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-alpha-kanten",
        lessonId: "lesson-alpha",
        mediaId: "media-alpha",
        front: "観点",
        segmentId: "segment-alpha"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-beta-kanten",
        lessonId: "lesson-beta",
        mediaId: "media-beta",
        front: "観点",
        segmentId: "segment-beta"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-alpha-kanten-live",
        lessonId: "lesson-alpha",
        mediaId: "media-alpha",
        front: "観点",
        segmentId: "segment-alpha"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-alpha-kanten-inactive",
        lessonId: "lesson-alpha-inactive",
        mediaId: "media-alpha",
        front: "案点",
        segmentId: "segment-alpha"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-beta-kanten-pending",
        lessonId: "lesson-beta-in-progress",
        mediaId: "media-beta",
        front: "論点",
        segmentId: "segment-beta"
      },
      now
    ),
    buildCardRow(
      {
        cardType: "concept",
        id: "card-beta-kanten-noncanonical",
        lessonId: "lesson-beta",
        mediaId: "media-beta",
        front: "論点",
        normalizedFront: "論点",
        segmentId: "segment-beta"
      },
      now
    ),
    buildCardRow(
      {
        id: "card-beta-low-stability",
        lessonId: "lesson-beta",
        mediaId: "media-beta",
        front: "情報",
        segmentId: "segment-beta"
      },
      now
    )
  ]);

  await database
    .insert(cardEntryLink)
    .values([
      buildCardEntryLinkRow("card-alpha-shokuhi", "term-alpha-shokuhi"),
      buildCardEntryLinkRow("card-beta-shokuhin", "term-beta-shokuhin"),
      buildCardEntryLinkRow("card-gamma-keiken", "term-gamma-keiken"),
      buildCardEntryLinkRow("card-alpha-kana-only", "term-alpha-kana-only"),
      buildCardEntryLinkRow("card-alpha-kanten", "term-alpha-kanten"),
      buildCardEntryLinkRow("card-beta-kanten", "term-beta-kanten"),
      buildCardEntryLinkRow("card-alpha-kanten-live", "term-alpha-kanten-live"),
      buildCardEntryLinkRow(
        "card-alpha-kanten-inactive",
        "term-alpha-kanten-inactive"
      ),
      buildCardEntryLinkRow(
        "card-beta-kanten-pending",
        "term-beta-kanten-pending"
      ),
      buildCardEntryLinkRow(
        "card-beta-kanten-noncanonical",
        "term-beta-kanten-noncanonical"
      ),
      buildCardEntryLinkRow(
        "card-beta-low-stability",
        "term-beta-low-stability"
      )
    ]);

  await database.insert(reviewSubjectState).values([
    {
      cardId: "card-alpha-shokuhi",
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-alpha-shokuhi",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 3,
      scheduledDays: 4,
      stability: 8.2,
      state: "review",
      subjectKey: "entry:term:term-alpha-shokuhi",
      subjectType: "entry",
      suspended: false,
      updatedAt: now
    },
    {
      cardId: "card-beta-shokuhin",
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-beta-shokuhin",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 4,
      scheduledDays: 5,
      stability: 9.1,
      state: "relearning",
      subjectKey: "entry:term:term-beta-shokuhin",
      subjectType: "entry",
      suspended: false,
      updatedAt: now
    },
    {
      cardId: "card-gamma-keiken",
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-gamma-keiken",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 3,
      scheduledDays: 6,
      stability: 8.8,
      state: "review",
      subjectKey: "entry:term:term-gamma-keiken",
      subjectType: "entry",
      suspended: false,
      updatedAt: now
    },
    {
      cardId: "card-alpha-kana-only",
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-alpha-kana-only",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 3,
      scheduledDays: 3,
      stability: 8.4,
      state: "review",
      subjectKey: "entry:term:term-alpha-kana-only",
      subjectType: "entry",
      suspended: false,
      updatedAt: now
    },
    {
      cardId: "card-alpha-kanten",
      createdAt: now,
      crossMediaGroupId: "group-term-shared",
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-alpha-kanten",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 5,
      scheduledDays: 7,
      stability: 12.5,
      state: "review",
      subjectKey: "group:term:group-term-shared",
      subjectType: "group",
      suspended: false,
      updatedAt: now
    },
    {
      cardId: "card-alpha-kanten-live",
      createdAt: now,
      crossMediaGroupId: "group-term-mixed",
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-alpha-kanten-live",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 5,
      scheduledDays: 7,
      stability: 12.5,
      state: "review",
      subjectKey: "group:term:group-term-mixed",
      subjectType: "group",
      suspended: false,
      updatedAt: now
    },
    {
      cardId: "card-beta-low-stability",
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: "term-beta-low-stability",
      entryType: "term",
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 2,
      scheduledDays: 1,
      stability: 4.2,
      state: "review",
      subjectKey: "entry:term:term-beta-low-stability",
      subjectType: "entry",
      suspended: false,
      updatedAt: now
    }
  ]);
}

function buildTermRow(
  input: {
    crossMediaGroupId?: string;
    id: string;
    lemma: string;
    mediaId: string;
    meaningIt: string;
    reading: string;
    segmentId: string;
    sourceId: string;
  },
  now: string
) {
  return {
    createdAt: now,
    crossMediaGroupId: input.crossMediaGroupId ?? null,
    id: input.id,
    meaningIt: input.meaningIt,
    mediaId: input.mediaId,
    reading: input.reading,
    romaji: input.reading,
    searchLemmaNorm: input.lemma,
    searchReadingNorm: input.reading,
    searchRomajiNorm: input.reading,
    segmentId: input.segmentId,
    sourceId: input.sourceId,
    lemma: input.lemma,
    updatedAt: now
  };
}

function buildGrammarPatternRow(
  input: {
    id: string;
    meaningIt: string;
    mediaId: string;
    pattern: string;
    reading?: string;
    segmentId: string;
    sourceId: string;
    title: string;
  },
  now: string
): typeof grammarPattern.$inferInsert {
  return {
    createdAt: now,
    id: input.id,
    meaningIt: input.meaningIt,
    mediaId: input.mediaId,
    notesIt: null,
    pattern: input.pattern,
    reading: input.reading ?? null,
    searchPatternNorm: input.pattern,
    searchRomajiNorm: input.reading ?? input.pattern,
    segmentId: input.segmentId,
    sourceId: input.sourceId,
    title: input.title,
    updatedAt: now
  };
}

function buildCardRow(
  input: {
    cardType?: string;
    front: string;
    id: string;
    lessonId: string;
    mediaId: string;
    normalizedFront?: string;
    segmentId: string;
  },
  now: string
): typeof card.$inferInsert {
  return {
    back: `${input.front} meaning`,
    cardType: input.cardType ?? "recognition",
    createdAt: now,
    front: input.front,
    id: input.id,
    lessonId: input.lessonId,
    mediaId: input.mediaId,
    normalizedFront: input.normalizedFront ?? input.front,
    orderIndex: 1,
    segmentId: input.segmentId,
    sourceFile: `tests/${input.id}.md`,
    status: "active",
    updatedAt: now
  };
}

function buildCardEntryLinkRow(
  cardId: string,
  entryId: string,
  options?: {
    entryType?: "grammar" | "term";
    id?: string;
    relationshipType?: "primary" | "secondary";
  }
) {
  return {
    cardId,
    entryId,
    entryType: options?.entryType ?? ("term" as const),
    id: options?.id ?? `${cardId}-${entryId}`,
    relationshipType: options?.relationshipType ?? ("primary" as const)
  };
}

function buildReviewSubjectStateRow(
  input: {
    cardId: string;
    crossMediaGroupId?: string;
    entryId: string;
    reps: number;
    stability: number;
    subjectKey: string;
    subjectType: "entry" | "group";
  },
  now: string
): typeof reviewSubjectState.$inferInsert {
  return {
    cardId: input.cardId,
    createdAt: now,
    crossMediaGroupId: input.crossMediaGroupId ?? null,
    difficulty: 2.5,
    dueAt: now,
    entryId: input.entryId,
    entryType: "term",
    lapses: 0,
    lastInteractionAt: now,
    lastReviewedAt: now,
    learningSteps: 0,
    manualOverride: false,
    reps: input.reps,
    scheduledDays: 4,
    stability: input.stability,
    state: "review",
    subjectKey: input.subjectKey,
    subjectType: input.subjectType,
    suspended: false,
    updatedAt: now
  };
}

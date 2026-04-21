import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  crossMediaGroup,
  createDatabaseClient,
  developmentFixture,
  getLessonBySlug,
  getMediaBySlug,
  getReviewLaunchCandidateByMediaId,
  listCardsByMediaId,
  listDueCardsByMediaId,
  listGlossaryEntriesByKind,
  listGlossarySegmentsByMediaId,
  listGlossaryPreviewEntries,
  listGlossaryProgressSummaries,
  listGrammarEntryReviewSummaries,
  listLessonEntryLinks,
  listLessonsByMediaId,
  listLessonsByMediaIdsForShell,
  listMedia,
  listReviewCardsByMediaIds,
  listTermEntryReviewSummaries,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  term,
  type DatabaseClient
} from "@/db";
import {
  buildReviewSubjectIdentityCteSql,
  quoteSqlString
} from "@/db/queries/review-query-helpers";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  normalizeReviewSubjectSurface
} from "@/lib/review-subject";

describe("database layer", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-db-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates readable media entries", async () => {
    const rows = await listMedia(database);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe(developmentFixture.mediaSlug);

    const media = await getMediaBySlug(database, developmentFixture.mediaSlug);

    expect(media?.id).toBe(developmentFixture.mediaId);
    expect(media?.slug).toBe(developmentFixture.mediaSlug);
  });

  it("uses a trimmed media query for list and slug lookups", async () => {
    const mediaListQuerySpy = vi.spyOn(database.query.media, "findMany");
    const mediaLookupQuerySpy = vi.spyOn(database.query.media, "findFirst");

    const [rows, media] = await Promise.all([
      listMedia(database),
      getMediaBySlug(database, developmentFixture.mediaSlug)
    ]);

    expect(rows).toHaveLength(1);
    expect(media?.id).toBe(developmentFixture.mediaId);
    expect(mediaListQuerySpy).toHaveBeenCalledTimes(1);
    expect(mediaLookupQuerySpy).toHaveBeenCalledTimes(1);

    const mediaListQueryInput = mediaListQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
    };
    const mediaLookupQueryInput = mediaLookupQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
    };

    expect(mediaListQueryInput.columns).toMatchObject({
      description: true,
      id: true,
      mediaType: true,
      segmentKind: true,
      slug: true,
      status: true,
      title: true
    });
    expect(mediaListQueryInput.columns).not.toHaveProperty("language");
    expect(mediaListQueryInput.columns).not.toHaveProperty(
      "baseExplanationLanguage"
    );
    expect(mediaListQueryInput.columns).not.toHaveProperty("createdAt");
    expect(mediaListQueryInput.columns).not.toHaveProperty("updatedAt");

    expect(mediaLookupQueryInput.columns).toEqual(mediaListQueryInput.columns);

    mediaListQuerySpy.mockRestore();
    mediaLookupQuerySpy.mockRestore();
  });

  it("returns lesson metadata and full lesson content", async () => {
    const lessons = await listLessonsByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.content?.excerpt).toContain("voce lessicale");
    expect(lessons[0]?.progress?.status).toBe("completed");

    const lesson = await getLessonBySlug(
      database,
      developmentFixture.mediaId,
      "core-vocab"
    );

    expect(lesson?.content?.markdownRaw).toContain("行く");
    expect(lesson?.segment?.slug).toBe("starter-core");
  });

  it("uses a trimmed lesson query for single-media lesson lists", async () => {
    const lessonQuerySpy = vi.spyOn(database.query.lesson, "findMany");

    const lessons = await listLessonsByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(lessons).toHaveLength(1);
    expect(lessonQuerySpy).toHaveBeenCalledTimes(1);
    const lessonQueryInput = lessonQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
      with?: {
        content?: {
          columns?: Record<string, boolean>;
        };
        progress?: {
          columns?: Record<string, boolean>;
        };
        segment?: {
          columns?: Record<string, boolean>;
        };
      };
    };

    expect(lessonQueryInput).toMatchObject({
      columns: {
        id: true,
        slug: true,
        title: true,
        orderIndex: true,
        difficulty: true,
        summary: true
      },
      with: {
        content: {
          columns: {
            excerpt: true
          }
        },
        progress: {
          columns: {
            completedAt: true,
            lastOpenedAt: true,
            status: true
          }
        },
        segment: {
          columns: {
            id: true,
            notes: true,
            title: true
          }
        }
      }
    });
    expect(lessonQueryInput.columns).not.toHaveProperty("sourceFile");
    expect(lessonQueryInput.with?.progress?.columns).not.toHaveProperty(
      "startedAt"
    );
    expect(lessonQueryInput.with?.segment?.columns).not.toHaveProperty("slug");

    lessonQuerySpy.mockRestore();
  });

  it("returns shell lesson rows without joining or synthesizing lesson content", async () => {
    const executeSpy = vi.spyOn(database.$client, "execute");
    const lessonQuerySpy = vi.spyOn(database.query.lesson, "findMany");

    const lessons = await listLessonsByMediaIdsForShell(database, [
      developmentFixture.mediaId
    ]);

    expect(lessons).toHaveLength(1);
    expect(lessons[0]).not.toHaveProperty("content");
    expect(lessons[0]?.progress?.status).toBe("completed");
    expect(lessonQuerySpy).toHaveBeenCalledTimes(1);
    const lessonQueryInput = lessonQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
      with?: {
        progress?: {
          columns?: Record<string, boolean>;
        };
        segment?: {
          columns?: Record<string, boolean>;
        };
      };
    };

    expect(lessonQueryInput).toMatchObject({
      columns: {
        id: true,
        mediaId: true,
        slug: true,
        title: true,
        orderIndex: true,
        difficulty: true,
        summary: true
      },
      with: {
        progress: {
          columns: {
            completedAt: true,
            lastOpenedAt: true,
            status: true
          }
        },
        segment: {
          columns: {
            id: true,
            notes: true,
            title: true
          }
        }
      }
    });
    expect(
      executeSpy.mock.calls.some(([input]) => {
        const sql =
          typeof input === "string"
            ? input
            : (input as { sql?: unknown }).sql;

        return typeof sql === "string" && sql.includes("lesson_content");
      })
    ).toBe(false);

    lessonQuerySpy.mockRestore();
    executeSpy.mockRestore();
  });

  it("uses a trimmed entry-link query for textbook tooltip loading", async () => {
    const entryLinkQuerySpy = vi.spyOn(database.query.entryLink, "findMany");

    const entryLinks = await listLessonEntryLinks(
      database,
      developmentFixture.lessonId
    );

    expect(entryLinks).toHaveLength(2);
    expect(entryLinkQuerySpy).toHaveBeenCalledTimes(1);
    const entryLinkQueryInput = entryLinkQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
    };

    expect(entryLinkQueryInput.columns).toEqual({
      entryId: true,
      entryType: true
    });
    expect(entryLinkQueryInput.columns).not.toHaveProperty("id");
    expect(entryLinkQueryInput.columns).not.toHaveProperty("linkRole");
    expect(entryLinkQueryInput.columns).not.toHaveProperty("sortOrder");
    expect(entryLinkQueryInput.columns).not.toHaveProperty("sourceId");
    expect(entryLinkQueryInput.columns).not.toHaveProperty("sourceType");

    entryLinkQuerySpy.mockRestore();
  });

  it("keeps canonical glossary entries free of legacy status projections", async () => {
    const terms = await listGlossaryEntriesByKind(database, "term", {
      mediaId: developmentFixture.mediaId
    });
    const grammar = await listGlossaryEntriesByKind(database, "grammar", {
      mediaId: developmentFixture.mediaId
    });

    expect(terms).toHaveLength(1);
    expect(terms[0]?.aliases).toHaveLength(2);
    expect(terms[0]).not.toHaveProperty("status");

    expect(grammar).toHaveLength(1);
    expect(grammar[0]?.aliases[0]?.aliasNorm).toBe("てる");
    expect(grammar[0]).not.toHaveProperty("status");
  });

  it("returns lighter review summaries without glossary-only search metadata", async () => {
    const [terms, grammar] = await Promise.all([
      listTermEntryReviewSummaries(database, {
        mediaId: developmentFixture.mediaId
      }),
      listGrammarEntryReviewSummaries(database, {
        mediaId: developmentFixture.mediaId
      })
    ]);

    expect(terms).toHaveLength(1);
    expect(terms[0]).toHaveProperty("mediaSlug", developmentFixture.mediaSlug);
    expect(terms[0]).toHaveProperty("audioSrc");
    expect(terms[0]).toHaveProperty("pitchAccent");
    expect(terms[0]).not.toHaveProperty("entryStatus");
    expect(terms[0]).not.toHaveProperty("levelHint");
    expect(terms[0]).not.toHaveProperty("searchLemmaNorm");
    expect(terms[0]).not.toHaveProperty("searchReadingNorm");
    expect(terms[0]).not.toHaveProperty("searchRomajiNorm");

    expect(grammar).toHaveLength(1);
    expect(grammar[0]).toHaveProperty(
      "mediaSlug",
      developmentFixture.mediaSlug
    );
    expect(grammar[0]).toHaveProperty("audioSrc");
    expect(grammar[0]).toHaveProperty("pitchAccent");
    expect(grammar[0]).not.toHaveProperty("entryStatus");
    expect(grammar[0]).not.toHaveProperty("levelHint");
    expect(grammar[0]).not.toHaveProperty("searchPatternNorm");
  });

  it("uses a trimmed segment query for local glossary filters", async () => {
    const segmentQuerySpy = vi.spyOn(database.query.segment, "findMany");

    const segments = await listGlossarySegmentsByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(segments).toHaveLength(1);
    expect(segmentQuerySpy).toHaveBeenCalledTimes(1);
    const segmentQueryInput = segmentQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
    };

    expect(segmentQueryInput.columns).toEqual({
      id: true,
      title: true
    });
    expect(segmentQueryInput.columns).not.toHaveProperty("mediaId");
    expect(segmentQueryInput.columns).not.toHaveProperty("notes");
    expect(segmentQueryInput.columns).not.toHaveProperty("orderIndex");
    expect(segmentQueryInput.columns).not.toHaveProperty("segmentType");
    expect(segmentQueryInput.columns).not.toHaveProperty("slug");

    segmentQuerySpy.mockRestore();
  });

  it("returns cards with review state and due filtering", async () => {
    const cards = await listCardsByMediaId(
      database,
      developmentFixture.mediaId
    );

    expect(cards).toHaveLength(2);

    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const dueCards = await listDueCardsByMediaId(
      database,
      developmentFixture.mediaId,
      "2026-03-10T00:00:00.000Z"
    );

    expect(dueCards).toHaveLength(1);
    expect(dueCards[0]?.id).toBe(developmentFixture.primaryCardId);
  });

  it("uses a trimmed review-card query for workspace loads", async () => {
    const cardQuerySpy = vi.spyOn(database.query.card, "findMany");

    const cards = await listReviewCardsByMediaIds(database, [
      developmentFixture.mediaId
    ]);

    expect(cards).toHaveLength(2);
    expect(cardQuerySpy).toHaveBeenCalledTimes(1);
    const cardQueryInput = cardQuerySpy.mock.calls[0]?.[0] as {
      columns?: Record<string, boolean>;
      with?: {
        entryLinks?: {
          columns?: Record<string, boolean>;
        };
        lesson?: {
          columns?: Record<string, boolean>;
          with?: {
            progress?: {
              columns?: Record<string, boolean>;
            };
          };
        };
        segment?: {
          columns?: Record<string, boolean>;
        };
      };
    };

    expect(cardQueryInput).toMatchObject({
      columns: {
        id: true,
        mediaId: true,
        lessonId: true,
        segmentId: true,
        cardType: true,
        front: true,
        back: true,
        exampleJp: true,
        exampleIt: true,
        notesIt: true,
        status: true,
        orderIndex: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        entryLinks: {
          columns: {
            entryId: true,
            entryType: true,
            relationshipType: true
          }
        },
        lesson: {
          columns: {
            status: true
          },
          with: {
            progress: {
              columns: {
                status: true
              }
            }
          }
        },
        segment: {
          columns: {
            title: true
          }
        }
      }
    });
    expect(cardQueryInput.columns).not.toHaveProperty("sourceFile");
    expect(cardQueryInput.columns).not.toHaveProperty("normalizedFront");
    expect(cardQueryInput.with?.lesson?.columns).not.toHaveProperty("title");
    expect(cardQueryInput.with?.segment?.columns).not.toHaveProperty("slug");
    expect(cardQueryInput.with?.entryLinks?.columns).not.toHaveProperty("id");

    cardQuerySpy.mockRestore();
  });

  it("keeps glossary progress summaries and previews aligned for direct and grouped entry states", async () => {
    const groupedMediaId = "media_fixture_grouped";
    const groupedMediaSlug = "fixture-grouped";
    const groupedCrossMediaGroupId = "cross_media_group_fixture_shared_term";
    const groupedTermId = "term_media_fixture_grouped_shared";

    await database.insert(media).values({
      id: groupedMediaId,
      slug: groupedMediaSlug,
      title: "Fixture Grouped",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture tecnica per verificare entry raggruppate.",
      status: "active",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(crossMediaGroup).values({
      id: groupedCrossMediaGroupId,
      entryType: "term",
      groupKey: "fixture-shared-term",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(term).values({
      id: groupedTermId,
      sourceId: "term_fixture_shared_grouped",
      crossMediaGroupId: groupedCrossMediaGroupId,
      mediaId: groupedMediaId,
      segmentId: null,
      lemma: "共有語",
      reading: "きょうゆうご",
      romaji: "kyouyugo",
      pos: "noun",
      meaningIt: "termine condiviso",
      meaningLiteralIt: null,
      notesIt: null,
      levelHint: null,
      audioSrc: null,
      audioSource: null,
      audioSpeaker: null,
      audioLicense: null,
      audioAttribution: null,
      audioPageUrl: null,
      pitchAccent: null,
      pitchAccentSource: null,
      pitchAccentPageUrl: null,
      searchLemmaNorm: "共有語",
      searchReadingNorm: "きょうゆうご",
      searchRomajiNorm: "kyouyugo",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: `group:term:${groupedCrossMediaGroupId}`,
      subjectType: "group",
      entryType: "term",
      crossMediaGroupId: groupedCrossMediaGroupId,
      entryId: null,
      cardId: null,
      state: "review",
      stability: 3,
      difficulty: 2.2,
      dueAt: "2026-03-09T10:00:00.000Z",
      lastReviewedAt: "2026-03-09T10:00:00.000Z",
      lastInteractionAt: "2026-03-09T10:00:00.000Z",
      scheduledDays: 2,
      learningSteps: 0,
      lapses: 0,
      reps: 2,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });

    const [summaries, previews] = await Promise.all([
      listGlossaryProgressSummaries(database, [
        developmentFixture.mediaId,
        groupedMediaId
      ]),
      listGlossaryPreviewEntries(database, [
        {
          id: developmentFixture.mediaId,
          slug: developmentFixture.mediaSlug
        },
        {
          id: groupedMediaId,
          slug: groupedMediaSlug
        }
      ])
    ]);

    expect(
      [...summaries].sort((left, right) => left.mediaId.localeCompare(right.mediaId))
    ).toEqual([
      {
        available: 0,
        entriesCovered: 1,
        entriesTotal: 1,
        known: 0,
        learning: 0,
        mediaId: groupedMediaId,
        new: 0,
        review: 1
      },
      {
        available: 0,
        entriesCovered: 2,
        entriesTotal: 2,
        known: 1,
        learning: 1,
        mediaId: developmentFixture.mediaId,
        new: 0,
        review: 0
      }
    ]);
    expect(
      [...previews].sort((left, right) => {
        const mediaOrder = left.mediaId.localeCompare(right.mediaId);

        if (mediaOrder !== 0) {
          return mediaOrder;
        }

        return left.sourceId.localeCompare(right.sourceId, "it");
      })
    ).toEqual([
      {
        kind: "term",
        label: "共有語",
        meaningIt: "termine condiviso",
        mediaId: groupedMediaId,
        mediaSlug: groupedMediaSlug,
        reading: "きょうゆうご",
        segmentTitle: null,
        sourceId: "term_fixture_shared_grouped",
        state: "review"
      },
      {
        kind: "grammar",
        label: "〜ている",
        meaningIt: "azione in corso o stato risultante",
        mediaId: developmentFixture.mediaId,
        mediaSlug: developmentFixture.mediaSlug,
        reading: null,
        segmentTitle: "Starter Core",
        sourceId: developmentFixture.grammarId,
        state: "known"
      },
      {
        kind: "term",
        label: "行く",
        meaningIt: "andare",
        mediaId: developmentFixture.mediaId,
        mediaSlug: developmentFixture.mediaSlug,
        reading: "いく",
        segmentTitle: "Starter Core",
        sourceId: developmentFixture.termId,
        state: "learning"
      }
    ]);
  });

  it("keeps canonical concept cards aligned between TS and SQL", async () => {
    const canonicalCardId = "card_fixture_iku_concept";

    await database.insert(card).values({
      id: canonicalCardId,
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/iku-concept.md",
      cardType: "concept",
      front: "{{行|い}}く",
      normalizedFront: normalizeReviewSubjectSurface("{{行|い}}く"),
      back: "andare",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 3,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_iku_concept_primary",
      cardId: canonicalCardId,
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "primary"
    });

    const entryLookup = buildReviewSubjectEntryLookup({
      grammar: [],
      terms: [
        {
          crossMediaGroupId: null,
          id: developmentFixture.termDbId,
          lemma: "行く",
          reading: "いく"
        }
      ]
    });
    const tsIdentity = deriveReviewSubjectIdentity({
      cardId: canonicalCardId,
      cardType: "concept",
      front: "{{行|い}}く",
      entryLinks: [
        {
          entryId: developmentFixture.termDbId,
          entryType: "term",
          relationshipType: "primary"
        }
      ],
      entryLookup
    });

    const [sqlIdentity] = await database.all<{ subjectKey: string }>(`
      WITH ${buildReviewSubjectIdentityCteSql()}
      SELECT subject_key AS subjectKey
      FROM subject_identity
      WHERE card_id = ${quoteSqlString(canonicalCardId)}
    `);

    expect(tsIdentity.subjectKey).toBe(
      `entry:term:${developmentFixture.termDbId}`
    );
    expect(sqlIdentity?.subjectKey).toBe(tsIdentity.subjectKey);
  });

  it("keeps concept cards with noncanonical primary fronts on card subjects in TS and SQL", async () => {
    const chunkCardId = "card_fixture_iku_chunk";
    const chunkFront = "{{行|い}}かずに{{残|のこ}}る";
    const chunkSubjectKey = `card:${chunkCardId}`;

    await database.insert(card).values({
      id: chunkCardId,
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/iku-chunk.md",
      cardType: "concept",
      front: chunkFront,
      normalizedFront: normalizeReviewSubjectSurface(chunkFront),
      back: "restare senza andare",
      exampleJp: "{{駅|えき}}へ{{行|い}}かずに{{家|いえ}}に{{残|のこ}}る。",
      exampleIt: "Resto a casa senza andare alla stazione.",
      notesIt: "Chunk card legata allo stesso termine ma con fronte non canonico.",
      status: "active",
      orderIndex: 4,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_iku_chunk_primary",
      cardId: chunkCardId,
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "primary"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: chunkSubjectKey,
      subjectType: "card",
      entryType: null,
      entryId: null,
      crossMediaGroupId: null,
      cardId: chunkCardId,
      state: "review",
      stability: 2.2,
      difficulty: 3.8,
      dueAt: "2026-03-09T12:00:00.000Z",
      lastReviewedAt: "2026-03-09T09:00:00.000Z",
      lastInteractionAt: "2026-03-09T09:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 2,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-09T09:00:00.000Z",
      updatedAt: "2026-03-09T09:00:00.000Z"
    });

    const entryLookup = buildReviewSubjectEntryLookup({
      grammar: [],
      terms: [
        {
          crossMediaGroupId: null,
          id: developmentFixture.termDbId,
          lemma: "行く",
          reading: "いく"
        }
      ]
    });
    const tsIdentity = deriveReviewSubjectIdentity({
      cardId: chunkCardId,
      cardType: "concept",
      front: chunkFront,
      entryLinks: [
        {
          entryId: developmentFixture.termDbId,
          entryType: "term",
          relationshipType: "primary"
        }
      ],
      entryLookup
    });

    expect(tsIdentity.subjectKey).toBe(chunkSubjectKey);

    const [sqlIdentity] = await database.all<{ subjectKey: string }>(`
      WITH ${buildReviewSubjectIdentityCteSql()}
      SELECT subject_key AS subjectKey
      FROM subject_identity
      WHERE card_id = ${quoteSqlString(chunkCardId)}
    `);

    expect(sqlIdentity?.subjectKey).toBe(chunkSubjectKey);

    const dueCards = await listDueCardsByMediaId(
      database,
      developmentFixture.mediaId,
      "2026-03-10T00:00:00.000Z"
    );

    expect(dueCards.map((currentCard) => currentCard.id)).toEqual([
      developmentFixture.primaryCardId,
      chunkCardId
    ]);
  });

  it("scopes the per-media review launch candidate query to the target media", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-launch-sql-"));
    const localDatabase = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite"),
      logger: true
    });
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.map((value) => String(value)).join(" "));
    });

    try {
      await runMigrations(localDatabase);
      await seedDevelopmentDatabase(localDatabase);
      logs.length = 0;

      const candidate = await getReviewLaunchCandidateByMediaId(
        localDatabase,
        developmentFixture.mediaId,
        "2026-03-10T00:00:00.000Z"
      );

      const queryLog = logs.find((entry) => entry.includes("subject_identity"));

      expect(candidate?.mediaId).toBe(developmentFixture.mediaId);
      expect(queryLog).toBeDefined();
      expect(queryLog).toContain(
        `AND c.media_id IN ('${developmentFixture.mediaId}')`
      );
      expect(queryLog).not.toContain(
        "SELECT id FROM media WHERE status = 'active'"
      );
      expect(queryLog).toContain(
        `AND l.media_id = '${developmentFixture.mediaId}'`
      );
      expect(queryLog).toContain(`AND m.id = '${developmentFixture.mediaId}'`);
    } finally {
      logSpy.mockRestore();
      closeDatabaseClient(localDatabase);
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps cardsTotal aligned with totalCards for future-scheduled active review cards", async () => {
    await database
      .update(card)
      .set({
        status: "archived"
      })
      .where(eq(card.id, developmentFixture.secondaryCardId));

    await database
      .update(reviewSubjectState)
      .set({
        state: "review",
        dueAt: "2030-03-12T08:00:00.000Z",
        manualOverride: false,
        suspended: false
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    const candidate = await getReviewLaunchCandidateByMediaId(
      database,
      developmentFixture.mediaId,
      "2026-03-10T00:00:00.000Z"
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.totalCards).toBe(1);
    expect(candidate?.cardsTotal).toBe(candidate?.totalCards);
    expect(candidate?.cardsTotal).toBeGreaterThan(0);
  });

  it("excludes known_manual cards from the due queue", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        state: "known_manual",
        dueAt: "2026-03-01T00:00:00.000Z",
        manualOverride: true
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    const dueCards = await listDueCardsByMediaId(
      database,
      developmentFixture.mediaId,
      "2026-03-10T00:00:00.000Z"
    );

    expect(dueCards).toHaveLength(0);
  });

  it("applies the development seed idempotently", async () => {
    await seedDevelopmentDatabase(database);

    const cards = await listCardsByMediaId(
      database,
      developmentFixture.mediaId
    );
    const terms = await listGlossaryEntriesByKind(database, "term", {
      mediaId: developmentFixture.mediaId
    });

    expect(cards).toHaveLength(2);
    expect(terms).toHaveLength(1);
  });
});

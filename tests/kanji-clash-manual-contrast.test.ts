import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  card,
  closeDatabaseClient,
  crossMediaGroup,
  createDatabaseClient,
  grammarPattern,
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  applyKanjiClashSessionAction,
  buildKanjiClashContrastKey,
  buildKanjiClashQueueSnapshot,
  loadKanjiClashManualContrastCandidates
} from "@/lib/kanji-clash";

import { seedKanjiClashFixture } from "./helpers/kanji-clash-fixture";

describe("kanji clash manual contrast subject materialization", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-kanji-clash-manual-contrast-")
    );
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedKanjiClashFixture(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("materializes manual grammar-entry and card subjects with truthful metadata", async () => {
    await database.insert(grammarPattern).values(
      buildGrammarPatternRow(
        {
          id: "grammar-alpha-matsu-contrast",
          meaningIt: "quando aspetta",
          mediaId: "media-alpha",
          pattern: "待てば",
          reading: "まてば",
          segmentId: "segment-alpha",
          sourceId: "grammar-alpha-matsu-contrast",
          title: "待てば"
        },
        FIXTURE_NOW
      )
    );
    await database.insert(card).values(
      buildCardRow(
        "card-alpha-manual-confusion",
        "待った",
        "lesson-alpha",
        "media-alpha",
        "segment-alpha",
        FIXTURE_NOW
      )
    );

    const contrastKey = await insertManualContrastFixture(database, {
      leftSubjectKey: "entry:grammar:grammar-alpha-matsu-contrast",
      rightSubjectKey: "card:card-alpha-manual-confusion"
    });
    const seed = await loadKanjiClashManualContrastCandidates({
      database
    });
    const candidate = seed.candidates.find(
      (currentCandidate) => currentCandidate.pairKey === contrastKey
    );

    if (!candidate) {
      throw new Error("Expected a manual contrast candidate.");
    }

    const subjectsByKey = new Map([
      [candidate.left.subjectKey, candidate.left],
      [candidate.right.subjectKey, candidate.right]
    ]);
    const grammarSubject = subjectsByKey.get(
      "entry:grammar:grammar-alpha-matsu-contrast"
    );
    const cardSubject = subjectsByKey.get("card:card-alpha-manual-confusion");

    expect(grammarSubject).toMatchObject({
      entryType: "grammar",
      source: {
        entryId: "grammar-alpha-matsu-contrast",
        type: "entry"
      },
      subjectKey: "entry:grammar:grammar-alpha-matsu-contrast"
    });
    expect(cardSubject).toMatchObject({
      entryType: null,
      source: {
        cardId: "card-alpha-manual-confusion",
        type: "card"
      },
      subjectKey: "card:card-alpha-manual-confusion"
    });
  });

  it("materializes manual grammar-group subjects with truthful metadata", async () => {
    await database.insert(crossMediaGroup).values({
      createdAt: FIXTURE_NOW,
      entryType: "grammar",
      groupKey: "group-grammar-matsu",
      id: "group-grammar-matsu",
      updatedAt: FIXTURE_NOW
    });
    await database.insert(grammarPattern).values([
      buildGrammarPatternRow(
        {
          id: "grammar-alpha-shared-left",
          meaningIt: "se aspetta",
          mediaId: "media-alpha",
          pattern: "待つなら",
          reading: "まつなら",
          segmentId: "segment-alpha",
          sourceId: "grammar-alpha-shared-left",
          title: "待つなら",
          crossMediaGroupId: "group-grammar-matsu"
        },
        FIXTURE_NOW
      ),
      buildGrammarPatternRow(
        {
          id: "grammar-alpha-shared-right",
          meaningIt: "quando aspetta",
          mediaId: "media-alpha",
          pattern: "待てば",
          reading: "まてば",
          segmentId: "segment-alpha",
          sourceId: "grammar-alpha-shared-right",
          title: "待てば",
          crossMediaGroupId: "group-grammar-matsu"
        },
        FIXTURE_NOW
      )
    ]);

    const contrastKey = await insertManualContrastFixture(database, {
      leftSubjectKey: "group:grammar:group-grammar-matsu",
      rightSubjectKey: "entry:term:term-alpha-shokuhi"
    });
    const seed = await loadKanjiClashManualContrastCandidates({
      database
    });
    const candidate = seed.candidates.find(
      (currentCandidate) => currentCandidate.pairKey === contrastKey
    );

    if (!candidate) {
      throw new Error("Expected a grouped grammar manual contrast candidate.");
    }

    const grammarGroup =
      candidate.left.subjectKey === "group:grammar:group-grammar-matsu"
        ? candidate.left
        : candidate.right;

    expect(grammarGroup).toMatchObject({
      entryType: "grammar",
      source: {
        crossMediaGroupId: "group-grammar-matsu",
        type: "group"
      },
      subjectKey: "group:grammar:group-grammar-matsu"
    });
    expect(grammarGroup.members.map((member) => member.entryId).sort()).toEqual([
      "grammar-alpha-shared-left",
      "grammar-alpha-shared-right"
    ]);
  });

  it("keeps manual round/session behavior working for grammar-card contrasts", async () => {
    await database.insert(grammarPattern).values(
      buildGrammarPatternRow(
        {
          id: "grammar-alpha-session",
          meaningIt: "se attende",
          mediaId: "media-alpha",
          pattern: "待つと",
          reading: "まつと",
          segmentId: "segment-alpha",
          sourceId: "grammar-alpha-session",
          title: "待つと"
        },
        FIXTURE_NOW
      )
    );
    await database.insert(card).values(
      buildCardRow(
        "card-alpha-session-confusion",
        "待って",
        "lesson-alpha",
        "media-alpha",
        "segment-alpha",
        FIXTURE_NOW
      )
    );

    const contrastKey = await insertManualContrastFixture(database, {
      leftSubjectKey: "entry:grammar:grammar-alpha-session",
      rightSubjectKey: "card:card-alpha-session-confusion"
    });
    const seed = await loadKanjiClashManualContrastCandidates({
      database
    });
    const queue = buildKanjiClashQueueSnapshot({
      candidates: seed.candidates.filter(
        (candidate) => candidate.pairKey === contrastKey
      ),
      mode: "manual",
      now: new Date("2026-04-09T12:00:00.000Z"),
      pairStates: seed.pairStates,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a manual contrast round.");
    }

    expect(currentRound.origin).toEqual({
      contrastKey,
      direction: "subject_a",
      type: "manual-contrast"
    });
    const roundEntryTypes = [
      currentRound.left.entryType,
      currentRound.right.entryType
    ];
    expect(roundEntryTypes).toContain("grammar");
    expect(roundEntryTypes).toContain(null);

    const result = await applyKanjiClashSessionAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      now: new Date("2026-04-09T12:00:00.000Z"),
      queue,
      responseMs: 140
    });
    const logs = await database.query.kanjiClashManualContrastRoundLog.findMany({
      where: (table, { eq }) => eq(table.contrastKey, contrastKey)
    });

    expect(result.answeredRound.roundKey).toBe(`${contrastKey}::subject_a`);
    expect(result.nextRound?.roundKey).toBe(`${contrastKey}::subject_b`);
    expect(result.nextQueue.seenRoundKeys).toEqual([`${contrastKey}::subject_a`]);
    expect(logs).toHaveLength(1);
  });
});

const FIXTURE_NOW = "2026-04-08T12:00:00.000Z";

async function insertManualContrastFixture(
  database: DatabaseClient,
  input: {
    leftSubjectKey: string;
    rightSubjectKey: string;
  }
) {
  const [subjectAKey, subjectBKey] = [
    input.leftSubjectKey,
    input.rightSubjectKey
  ].sort((left, right) => left.localeCompare(right));
  const contrastKey = buildKanjiClashContrastKey(subjectAKey, subjectBKey);

  await database.insert(kanjiClashManualContrast).values({
    contrastKey,
    createdAt: FIXTURE_NOW,
    source: "forced",
    status: "active",
    subjectAKey,
    subjectBKey,
    timesConfirmed: 1,
    updatedAt: FIXTURE_NOW
  });
  await database.insert(kanjiClashManualContrastRoundState).values([
    {
      contrastKey,
      createdAt: FIXTURE_NOW,
      difficulty: null,
      direction: "subject_a",
      dueAt: FIXTURE_NOW,
      lapses: 0,
      lastInteractionAt: FIXTURE_NOW,
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: subjectAKey,
      reps: 0,
      rightSubjectKey: subjectBKey,
      roundKey: `${contrastKey}::subject_a`,
      scheduledDays: 0,
      stability: null,
      state: "new",
      targetSubjectKey: subjectAKey,
      updatedAt: FIXTURE_NOW
    },
    {
      contrastKey,
      createdAt: FIXTURE_NOW,
      difficulty: null,
      direction: "subject_b",
      dueAt: FIXTURE_NOW,
      lapses: 0,
      lastInteractionAt: FIXTURE_NOW,
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: subjectAKey,
      reps: 0,
      rightSubjectKey: subjectBKey,
      roundKey: `${contrastKey}::subject_b`,
      scheduledDays: 0,
      stability: null,
      state: "new",
      targetSubjectKey: subjectBKey,
      updatedAt: FIXTURE_NOW
    }
  ]);

  return contrastKey;
}

function buildGrammarPatternRow(
  input: {
    crossMediaGroupId?: string | null;
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
    crossMediaGroupId: input.crossMediaGroupId ?? null,
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

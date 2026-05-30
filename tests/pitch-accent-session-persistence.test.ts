import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abandonPitchAccentSession,
  completePitchAccentSession,
  getPitchAccentRecapPageData,
  startPitchAccentSession,
  submitPitchAccentAnswer,
  type PitchAccentMinimalPairsCorpus
} from "@/features/pitch-accent/server";

import {
  cleanupTestDatabase,
  setupTestDatabase,
  type TestDatabaseFixture
} from "./helpers/test-db";

const fixtureCorpus: PitchAccentMinimalPairsCorpus = {
  pairs: Array.from({ length: 4 }, (_, index) => ({
    hasDevoiced: index === 2,
    id: `pair-${index}`,
    kana: `かな${index}`,
    optionCount: 2,
    options: [
      {
        accentedMora: 0,
        audioSrc: `/vendor/minimal-pairs/audio/pair-${index}-0.ogg`,
        id: `pair-${index}:0`,
        moraCount: 3,
        pitchAccent: 0,
        rawPronunciation: `カナ${index}`,
        silencedMoras: []
      },
      {
        accentedMora: 1,
        audioSrc: `/vendor/minimal-pairs/audio/pair-${index}-1.ogg`,
        id: `pair-${index}:1`,
        moraCount: 3,
        pitchAccent: 1,
        rawPronunciation: `カナ${index}`,
        silencedMoras: []
      }
    ],
    patternKeys: ["pitch0", "pitch1"] as const
  })),
  source: {
    importedAt: "2026-05-25T00:00:00.000Z",
    license: "GPL-3.0",
    repository: "https://github.com/Kuuuube/minimal-pairs",
    revision: "fixture"
  },
  version: 1
};

describe("pitch accent session persistence", () => {
  let fixture: TestDatabaseFixture;

  beforeEach(async () => {
    fixture = await setupTestDatabase({
      prefix: "jcs-pitch-accent-session-"
    });
  });

  afterEach(async () => {
    await cleanupTestDatabase(fixture);
  });

  it("creates trials, records idempotent answers, and aggregates recap stats", async () => {
    const started = await startPitchAccentSession({
      corpus: fixtureCorpus,
      count: 3,
      database: fixture.database,
      filters: {
        moraCounts: [3],
        onlyDevoiced: false,
        patternKeys: ["pitch0", "pitch1"],
        strictPairFinding: false
      },
      now: new Date("2026-05-25T08:00:00.000Z"),
      seed: "session-seed"
    });
    const firstTrial = started.trials[0]!;

    expect(started.trials).toHaveLength(3);
    expect(firstTrial.options).toHaveLength(2);
    expect(
      started.trials.every((trial) =>
        trial.options.every((option) => option.moraCount === 3)
      )
    ).toBe(true);

    const firstSubmit = await submitPitchAccentAnswer({
      chosenOptionId: firstTrial.correctOptionId,
      database: fixture.database,
      inputMethod: "keyboard",
      now: new Date("2026-05-25T08:00:03.000Z"),
      responseMs: 1234,
      sessionId: started.sessionId,
      trialId: firstTrial.trialId
    });
    const idempotentSubmit = await submitPitchAccentAnswer({
      chosenOptionId: firstTrial.options.find(
        (option) => option.id !== firstTrial.correctOptionId
      )!.id,
      database: fixture.database,
      inputMethod: "pointer",
      now: new Date("2026-05-25T08:00:04.000Z"),
      responseMs: 999,
      sessionId: started.sessionId,
      trialId: firstTrial.trialId
    });

    expect(firstSubmit).toEqual({
      chosenOptionId: firstTrial.correctOptionId,
      correctOptionId: firstTrial.correctOptionId,
      idempotent: false,
      isCorrect: true
    });
    expect(idempotentSubmit).toEqual({
      chosenOptionId: firstTrial.correctOptionId,
      correctOptionId: firstTrial.correctOptionId,
      idempotent: true,
      isCorrect: true
    });

    await abandonPitchAccentSession({
      database: fixture.database,
      now: new Date("2026-05-25T08:01:00.000Z"),
      sessionId: started.sessionId
    });

    const recap = await getPitchAccentRecapPageData({
      database: fixture.database,
      sessionId: started.sessionId
    });

    expect(recap?.session).toMatchObject({
      correctAttempts: 1,
      status: "abandoned",
      totalAttempts: 1
    });
    expect(recap?.attempts).toHaveLength(1);
    expect(recap?.attempts[0]).toMatchObject({
      chosenOptionId: firstTrial.correctOptionId,
      isCorrect: true,
      responseMs: 1234
    });
  });

  it("rejects partial completion and completes only fully answered sessions", async () => {
    const partial = await startPitchAccentSession({
      corpus: fixtureCorpus,
      count: 2,
      database: fixture.database,
      now: new Date("2026-05-25T08:00:00.000Z"),
      seed: "partial-complete"
    });
    const partialTrial = partial.trials[0]!;

    await submitPitchAccentAnswer({
      chosenOptionId: partialTrial.correctOptionId,
      database: fixture.database,
      now: new Date("2026-05-25T08:00:03.000Z"),
      responseMs: 300,
      sessionId: partial.sessionId,
      trialId: partialTrial.trialId
    });

    await expect(
      completePitchAccentSession({
        database: fixture.database,
        now: new Date("2026-05-25T08:01:00.000Z"),
        sessionId: partial.sessionId
      })
    ).rejects.toThrow("session is not complete");

    const partialRecap = await getPitchAccentRecapPageData({
      database: fixture.database,
      sessionId: partial.sessionId
    });

    expect(partialRecap?.session).toMatchObject({
      status: "active",
      totalAttempts: 1
    });

    const completed = await startPitchAccentSession({
      corpus: fixtureCorpus,
      count: 2,
      database: fixture.database,
      now: new Date("2026-05-25T09:00:00.000Z"),
      seed: "full-complete"
    });

    for (const trial of completed.trials) {
      await submitPitchAccentAnswer({
        chosenOptionId: trial.correctOptionId,
        database: fixture.database,
        now: new Date("2026-05-25T09:00:03.000Z"),
        responseMs: 300,
        sessionId: completed.sessionId,
        trialId: trial.trialId
      });
    }

    await completePitchAccentSession({
      database: fixture.database,
      now: new Date("2026-05-25T09:01:00.000Z"),
      sessionId: completed.sessionId
    });

    const completedRecap = await getPitchAccentRecapPageData({
      database: fixture.database,
      sessionId: completed.sessionId
    });

    expect(completedRecap?.session).toMatchObject({
      correctAttempts: 2,
      status: "completed",
      totalAttempts: 2
    });
  });

  it("rejects unknown option ids without consuming the trial", async () => {
    const started = await startPitchAccentSession({
      corpus: fixtureCorpus,
      count: 1,
      database: fixture.database,
      now: new Date("2026-05-25T08:00:00.000Z"),
      seed: "unknown-option"
    });
    const trial = started.trials[0]!;

    await expect(
      submitPitchAccentAnswer({
        chosenOptionId: "bogus",
        database: fixture.database,
        now: new Date("2026-05-25T08:00:03.000Z"),
        responseMs: 300,
        sessionId: started.sessionId,
        trialId: trial.trialId
      })
    ).rejects.toThrow("answer is not one of the trial options");

    const validSubmit = await submitPitchAccentAnswer({
      chosenOptionId: trial.correctOptionId,
      database: fixture.database,
      now: new Date("2026-05-25T08:00:05.000Z"),
      responseMs: 500,
      sessionId: started.sessionId,
      trialId: trial.trialId
    });
    const recap = await getPitchAccentRecapPageData({
      database: fixture.database,
      sessionId: started.sessionId
    });

    expect(validSubmit).toEqual({
      chosenOptionId: trial.correctOptionId,
      correctOptionId: trial.correctOptionId,
      idempotent: false,
      isCorrect: true
    });
    expect(recap?.attempts).toHaveLength(1);
    expect(recap?.session.totalAttempts).toBe(1);
  });

  it("keeps abandoned sessions abandoned if completion races later", async () => {
    const started = await startPitchAccentSession({
      corpus: fixtureCorpus,
      count: 2,
      database: fixture.database,
      now: new Date("2026-05-25T08:00:00.000Z"),
      seed: "abandon-race"
    });

    await abandonPitchAccentSession({
      database: fixture.database,
      now: new Date("2026-05-25T08:00:05.000Z"),
      sessionId: started.sessionId
    });
    await completePitchAccentSession({
      database: fixture.database,
      now: new Date("2026-05-25T08:00:10.000Z"),
      sessionId: started.sessionId
    });

    const recap = await getPitchAccentRecapPageData({
      database: fixture.database,
      sessionId: started.sessionId
    });

    expect(recap?.session).toMatchObject({
      durationMs: 5000,
      status: "abandoned"
    });
  });
});

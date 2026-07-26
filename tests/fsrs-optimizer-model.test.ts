import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import { reviewMemoryAlias, reviewSubjectLog } from "@/db/schema";
import {
  buildFsrsTrainingDataset,
  getFsrsOptimizerSnapshot,
  loadFsrsOptimizerLogRows
} from "@/features/fsrs-optimizer/server";
import {
  decideFsrsCandidatePromotion,
  planFsrsOptimizerPresetRuns,
  planFsrsOptimizerRun,
  splitFsrsTimeSeries
} from "@/features/fsrs-optimizer/model/training-policy";
import * as settingsStore from "@/features/fsrs-optimizer/server/settings-store";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";
import {
  buildLogRow,
  buildOptimizerMemoryEvent
} from "./helpers/fsrs-optimizer-fixture";

describe("fsrs optimizer model and training data", () => {
  let database: DatabaseClient;
  let databasePath = "";
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-fsrs-optimizer-data-"));
    databasePath = path.join(tempDir, "test.sqlite");
    database = createDatabaseClient({ databaseUrl: databasePath });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("allows automatic training inside the cron delivery tolerance", () => {
    expect(
      planFsrsOptimizerRun({
        config: {
          enabled: true,
          minDaysBetweenRuns: 30
        },
        force: false,
        newEligibleReviews: 3380,
        newReviewThreshold: 1219,
        now: new Date("2026-07-01T03:12:00.000Z"),
        state: {
          lastSuccessfulTrainingAt: "2026-06-01T03:29:00.000Z"
        }
      })
    ).toEqual({ action: "train" });
  });

  it("builds a trainable dataset grouped by subject and ordered by review history", () => {
    const dataset = buildFsrsTrainingDataset(
      [
        buildLogRow({
          answeredAt: "2026-01-01T09:00:00.000Z",
          cardType: "recognition",
          cardId: "recognition-card",
          elapsedDays: 0,
          id: "r1",
          rating: "good",
          subjectKey: "card:recognition-card"
        }),
        buildLogRow({
          answeredAt: "2026-01-03T09:00:00.000Z",
          cardType: "recognition",
          cardId: "recognition-card",
          elapsedDays: 2,
          id: "r2",
          rating: "hard",
          subjectKey: "card:recognition-card"
        }),
        buildLogRow({
          answeredAt: "2026-01-08T09:00:00.000Z",
          cardType: "recognition",
          cardId: "recognition-card",
          elapsedDays: 5,
          id: "r3",
          rating: "easy",
          subjectKey: "card:recognition-card"
        }),
        buildLogRow({
          answeredAt: "2026-01-02T09:00:00.000Z",
          cardType: "concept",
          cardId: "concept-card",
          elapsedDays: 0,
          id: "c1",
          rating: "good",
          subjectKey: "card:concept-card"
        })
      ],
      "recognition"
    );

    expect(dataset.reviewCount).toBe(3);
    expect(dataset.subjectCount).toBe(1);
    expect(dataset.itemCount).toBe(2);
    expect(dataset.items[0]?.map((review) => review.deltaT)).toEqual([0, 2]);
    expect(dataset.items[0]?.map((review) => review.rating)).toEqual([3, 2]);
    expect(dataset.items[1]?.map((review) => review.deltaT)).toEqual([0, 2, 5]);
  });

  it("emits a prefix only when its final review is a long-term target", () => {
    const dataset = buildFsrsTrainingDataset(
      [
        buildLogRow({
          answeredAt: "2026-01-01T09:00:00.000Z",
          cardType: "recognition",
          cardId: "same-day-card",
          elapsedDays: 0,
          id: "same-day-1",
          rating: "good",
          subjectKey: "same-day-memory"
        }),
        buildLogRow({
          answeredAt: "2026-01-03T09:00:00.000Z",
          cardType: "recognition",
          cardId: "same-day-card",
          elapsedDays: 2,
          id: "same-day-2",
          rating: "good",
          subjectKey: "same-day-memory"
        }),
        buildLogRow({
          answeredAt: "2026-01-03T12:00:00.000Z",
          cardType: "recognition",
          cardId: "same-day-card",
          elapsedDays: 0,
          id: "same-day-3",
          rating: "hard",
          subjectKey: "same-day-memory"
        }),
        buildLogRow({
          answeredAt: "2026-01-05T09:00:00.000Z",
          cardType: "recognition",
          cardId: "same-day-card",
          elapsedDays: 2,
          id: "same-day-4",
          rating: "easy",
          subjectKey: "same-day-memory"
        })
      ],
      "recognition"
    );

    expect(
      dataset.items.map((item) => item.map((review) => review.deltaT))
    ).toEqual([
      [0, 2],
      [0, 2, 0, 2]
    ]);
  });

  it("starts a new training sequence after reset and legacy new boundaries", () => {
    const common = {
      cardId: "reset-card",
      cardType: "recognition",
      subjectKey: "reset-memory"
    };
    const dataset = buildFsrsTrainingDataset(
      [
        buildLogRow({
          ...common,
          answeredAt: "2026-01-01T09:00:00.000Z",
          elapsedDays: 0,
          id: "reset-1",
          previousState: "new",
          rating: "good"
        }),
        buildLogRow({
          ...common,
          answeredAt: "2026-01-03T09:00:00.000Z",
          elapsedDays: 2,
          id: "reset-2",
          previousState: "review",
          rating: "good"
        }),
        buildLogRow({
          ...common,
          answeredAt: "2026-01-04T09:00:00.000Z",
          elapsedDays: 0,
          eventKind: "reset",
          id: "reset-event",
          rating: null
        }),
        buildLogRow({
          ...common,
          answeredAt: "2026-01-05T09:00:00.000Z",
          elapsedDays: 0,
          id: "reset-3",
          previousState: "new",
          rating: "hard"
        }),
        buildLogRow({
          ...common,
          answeredAt: "2026-01-07T09:00:00.000Z",
          elapsedDays: 2,
          id: "reset-4",
          previousState: "review",
          rating: "easy"
        })
      ],
      "recognition"
    );

    expect(
      dataset.items.map((item) => item.map((review) => review.rating))
    ).toEqual([
      [3, 3],
      [2, 4]
    ]);
  });

  it("prefers immutable elapsed days when the study-day policy changes", () => {
    const dataset = buildFsrsTrainingDataset(
      [
        buildLogRow({
          answeredAt: "2026-01-01T09:00:00.000Z",
          cardType: "recognition",
          cardId: "policy-card",
          elapsedDays: 0,
          id: "policy-1",
          rating: "good",
          studyDay: "2026-01-01",
          studyDayPolicy: "study-day:v0:UTC:rollover-0",
          subjectKey: "policy-memory"
        }),
        buildLogRow({
          answeredAt: "2026-01-03T09:00:00.000Z",
          cardType: "recognition",
          cardId: "policy-card",
          elapsedDays: 7,
          id: "policy-2",
          rating: "good",
          studyDay: "2026-01-03",
          studyDayPolicy: "study-day:v1:Europe/Rome:rollover-240",
          subjectKey: "policy-memory"
        }),
        buildLogRow({
          answeredAt: "2026-01-01T09:00:00.000Z",
          cardType: "recognition",
          cardId: "legacy-card",
          elapsedDays: 0,
          id: "legacy-1",
          rating: "good",
          subjectKey: "legacy-memory"
        }),
        buildLogRow({
          answeredAt: "2026-01-03T09:00:00.000Z",
          cardType: "recognition",
          cardId: "legacy-card",
          elapsedDays: null,
          id: "legacy-2",
          rating: "good",
          subjectKey: "legacy-memory"
        })
      ],
      "recognition"
    );
    const bySubject = new Map(
      dataset.sequences.map((sequence) => [
        sequence.subjectKey,
        sequence.reviews.map((review) => review.deltaT)
      ])
    );

    expect(bySubject.get("policy-memory")).toEqual([0, 7]);
    expect(bySubject.get("legacy-memory")).toEqual([0, 2]);
  });

  it("uses a chronological holdout and promotes only a guarded improvement", () => {
    const sequences = Array.from({ length: 250 }, (_, index) => ({
      targetAnsweredAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
    }));
    const split = splitFsrsTimeSeries(sequences);

    expect(split).not.toBeNull();
    expect(split?.training).toHaveLength(150);
    expect(split?.holdout).toHaveLength(100);
    expect(
      split!.training.at(-1)!.targetAnsweredAt <
        split!.holdout[0]!.targetAnsweredAt
    ).toBe(true);
    expect(
      decideFsrsCandidatePromotion({
        candidate: { logLoss: 0.45, rmseBins: 0.1 },
        incumbent: { logLoss: 0.5, rmseBins: 0.1 }
      }).promote
    ).toBe(true);
    expect(
      decideFsrsCandidatePromotion({
        candidate: { logLoss: 0.4999, rmseBins: 0.1 },
        incumbent: { logLoss: 0.5, rmseBins: 0.1 }
      }).promote
    ).toBe(false);
    expect(
      decideFsrsCandidatePromotion({
        candidate: { logLoss: 0.45, rmseBins: 0.2 },
        incumbent: { logLoss: 0.5, rmseBins: 0.1 }
      }).promote
    ).toBe(false);
  });

  it("plans readiness and watermarks independently for partial presets", () => {
    expect(
      planFsrsOptimizerPresetRuns({
        config: { enabled: true, minDaysBetweenRuns: 30 },
        force: false,
        lastAttemptAt: { concept: null, recognition: null },
        lastEvaluationAt: { concept: null, recognition: null },
        newEligibleReviews: { concept: 20, recognition: 600 },
        newReviewThreshold: { concept: 500, recognition: 500 },
        now: new Date("2026-04-01T09:00:00.000Z")
      })
    ).toEqual({
      action: "evaluate",
      presets: {
        concept: {
          action: "skip",
          reason: "insufficient-new-reviews"
        },
        recognition: { action: "evaluate" }
      }
    });
  });

  it("trains on logical study days across 23-hour and 25-hour DST days", () => {
    const rows = [
      buildLogRow({
        answeredAt: "2026-03-28T03:00:00.000Z",
        cardType: "recognition",
        cardId: "spring-card",
        elapsedDays: 0,
        id: "spring-1",
        rating: "good",
        subjectKey: "card:spring-card"
      }),
      buildLogRow({
        answeredAt: "2026-03-29T02:00:00.000Z",
        cardType: "recognition",
        cardId: "spring-card",
        elapsedDays: 1,
        id: "spring-2",
        rating: "good",
        subjectKey: "card:spring-card"
      }),
      buildLogRow({
        answeredAt: "2026-10-24T02:00:00.000Z",
        cardType: "recognition",
        cardId: "autumn-card",
        elapsedDays: 0,
        id: "autumn-1",
        rating: "good",
        subjectKey: "card:autumn-card"
      }),
      buildLogRow({
        answeredAt: "2026-10-25T03:00:00.000Z",
        cardType: "recognition",
        cardId: "autumn-card",
        elapsedDays: 1,
        id: "autumn-2",
        rating: "good",
        subjectKey: "card:autumn-card"
      })
    ];

    const dataset = buildFsrsTrainingDataset(rows, "recognition");

    expect(dataset.items).toHaveLength(2);
    expect(
      dataset.items.map((item) => item.map((review) => review.deltaT))
    ).toEqual([
      [0, 1],
      [0, 1]
    ]);
  });

  it("keeps recognition and concept as separate memories for one canonical subject", () => {
    const recognitionMemoryKey = "mnemonic:v1:recognition:group:term:shared";
    const conceptMemoryKey = "mnemonic:v1:concept:group:term:shared";
    const rows = [
      buildLogRow({
        answeredAt: "2026-01-01T09:00:00.000Z",
        cardType: "recognition",
        cardId: "recognition-card-1",
        elapsedDays: 0,
        id: "recognition-r1",
        rating: "good",
        subjectKey: recognitionMemoryKey
      }),
      buildLogRow({
        answeredAt: "2026-01-03T09:00:00.000Z",
        cardType: "recognition",
        cardId: "recognition-card-2",
        elapsedDays: 2,
        id: "recognition-r2",
        rating: "hard",
        subjectKey: recognitionMemoryKey
      }),
      buildLogRow({
        answeredAt: "2026-01-02T09:00:00.000Z",
        cardType: "concept",
        cardId: "concept-card-1",
        elapsedDays: 0,
        id: "concept-r1",
        rating: "good",
        subjectKey: conceptMemoryKey
      }),
      buildLogRow({
        answeredAt: "2026-01-04T09:00:00.000Z",
        cardType: "concept",
        cardId: "concept-card-2",
        elapsedDays: 2,
        id: "concept-r2",
        rating: "easy",
        subjectKey: conceptMemoryKey
      })
    ];
    const recognitionDataset = buildFsrsTrainingDataset(rows, "recognition");
    const conceptDataset = buildFsrsTrainingDataset(rows, "concept");

    expect(recognitionDataset).toMatchObject({
      itemCount: 1,
      reviewCount: 2,
      subjectCount: 1
    });
    expect(recognitionDataset.items[0]?.map((review) => review.deltaT)).toEqual(
      [0, 2]
    );
    expect(conceptDataset).toMatchObject({
      itemCount: 1,
      reviewCount: 2,
      subjectCount: 1
    });
    expect(conceptDataset.items[0]?.map((review) => review.deltaT)).toEqual([
      0, 2
    ]);
  });

  it("loads optimizer history by aliased effective memory and excludes non-grade events", async () => {
    const canonicalSubjectKey = "entry:term:optimizer-alias";
    const oldMemoryKey =
      "mnemonic:v1:recognition:entry:term:optimizer-alias-old";
    const currentMemoryKey =
      "mnemonic:v1:recognition:entry:term:optimizer-alias";

    await database.insert(reviewMemoryAlias).values({
      aliasMemoryKey: oldMemoryKey,
      currentMemoryKey,
      migratedAt: "2026-01-03T09:00:00.000Z",
      reason: "canonical_rekey"
    });
    await database.insert(reviewSubjectLog).values([
      buildOptimizerMemoryEvent({
        answeredAt: "2026-01-01T09:00:00.000Z",
        canonicalSubjectKey,
        id: "optimizer-alias-old",
        memoryKey: oldMemoryKey
      }),
      buildOptimizerMemoryEvent({
        answeredAt: "2026-01-03T09:00:00.000Z",
        canonicalSubjectKey,
        id: "optimizer-alias-current",
        memoryKey: currentMemoryKey
      }),
      {
        ...buildOptimizerMemoryEvent({
          answeredAt: "2026-01-04T09:00:00.000Z",
          canonicalSubjectKey,
          id: "optimizer-alias-reschedule",
          memoryKey: currentMemoryKey
        }),
        eventKind: "reschedule" as const
      }
    ]);

    const rows = await loadFsrsOptimizerLogRows(database);
    const aliasRows = rows.filter((row) =>
      row.id.startsWith("optimizer-alias-")
    );
    const dataset = buildFsrsTrainingDataset(aliasRows, "recognition");

    expect(aliasRows.map((row) => row.id)).toEqual([
      "optimizer-alias-old",
      "optimizer-alias-current"
    ]);
    expect(new Set(aliasRows.map((row) => row.subjectKey))).toEqual(
      new Set([currentMemoryKey])
    );
    expect(dataset).toMatchObject({
      itemCount: 1,
      reviewCount: 2,
      subjectCount: 1
    });
  });

  it("rejects invalid optimized parameter writes without clearing the previous preset", async () => {
    await settingsStore.writeFsrsOptimizedParameters(
      {
        desiredRetention: 0.9,
        presetKey: "recognition",
        trainedAt: "2026-01-01T09:00:00.000Z",
        trainingReviewCount: 42,
        weights: [...reviewSchedulerConfig.fsrs.w]
      },
      database,
      "2026-01-01T09:00:00.000Z"
    );

    await expect(
      settingsStore.writeFsrsOptimizedParameters(
        {
          desiredRetention: 0.9,
          presetKey: "recognition",
          trainedAt: "2026-01-02T09:00:00.000Z",
          trainingReviewCount: 43,
          weights: [1, 2, 3]
        },
        database,
        "2026-01-02T09:00:00.000Z"
      )
    ).rejects.toThrow("Invalid FSRS optimized parameters");

    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(snapshot.presets.recognition).toMatchObject({
      trainedAt: "2026-01-01T09:00:00.000Z",
      trainingReviewCount: 42
    });
  });
});

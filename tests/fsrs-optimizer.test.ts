import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  runMigrations,
  userSetting,
  type DatabaseClient
} from "@/db";
import {
  buildReviewSeedStateWithFsrsPreset,
  buildFsrsTrainingDataset,
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerConfigDefaults,
  getFsrsOptimizerSnapshot,
  getFsrsOptimizerStatus,
  writeFsrsOptimizerConfig,
  writeFsrsOptimizerState
} from "@/lib/fsrs-optimizer";
import { runFsrsOptimizer } from "@/lib/fsrs-optimizer-trainer";
import { buildReviewGradePreviews } from "@/lib/review-grade-previews";
import { applyReviewGrade } from "@/lib/review-service";
import { reviewSchedulerConfig, scheduleReview } from "@/lib/review-scheduler";

const execFileAsync = promisify(execFile);
const DAY = 24 * 60 * 60_000;

describe("fsrs optimizer", () => {
  let database: DatabaseClient;
  let databasePath = "";
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-fsrs-optimizer-"));
    databasePath = path.join(tempDir, "test.sqlite");
    database = createDatabaseClient({
      databaseUrl: databasePath
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
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

  it("skips automatic training when the last successful run is still too recent", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-03-15T10:00:00.000Z",
        lastCheckAt: "2026-03-15T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-03-15T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 0
      },
      database
    );
    const originalExecute = database.$client.execute.bind(database.$client);
    const executeSpy = vi
      .spyOn(database.$client, "execute")
      .mockImplementation(async (...args) => {
        const statement = args[0] as unknown;
        const sql =
          typeof statement === "string"
            ? statement
            : typeof statement === "object" &&
                statement !== null &&
                "sql" in statement
              ? String((statement as { sql: string }).sql)
              : "";

        if (sql.includes("rsl.id as id")) {
          throw new Error("too-soon path should not load the full FSRS log history");
        }

        return originalExecute(args[0]!);
      });

    try {
      const result = await runFsrsOptimizer({
        database,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result).toMatchObject({
        newEligibleReviews: 600,
        reason: "too-soon",
        status: "skipped",
        totalEligibleReviews: 600
      });
      expect(snapshot.state.lastCheckAt).toBe("2026-04-01T09:00:00.000Z");
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("skips automatic training until enough new eligible reviews accumulate", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-02-01T10:00:00.000Z",
        lastCheckAt: "2026-02-01T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-02-01T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 200
      },
      database
    );

    const result = await runFsrsOptimizer({
      database,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result).toMatchObject({
      newEligibleReviews: 400,
      reason: "insufficient-new-reviews",
      status: "skipped",
      totalEligibleReviews: 600
    });
    expect(snapshot.state.newEligibleReviewsSinceLastTraining).toBe(400);
  });

  it("does not rewrite the optimizer config on skipped runs when it is unchanged", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerConfig(
      getFsrsOptimizerConfigDefaults(),
      database,
      "2026-03-01T10:00:00.000Z"
    );
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-03-15T10:00:00.000Z",
        lastCheckAt: "2026-03-15T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-03-15T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 0
      },
      database
    );

    const initialConfigUpdatedAt = (
      await database.query.userSetting.findFirst({
        where: eq(userSetting.key, "fsrs_optimizer_config")
      })
    )?.updatedAt;
    const initialCacheKey = await getFsrsOptimizerCacheKeyPart(database);

    const result = await runFsrsOptimizer({
      database,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);
    const finalConfigUpdatedAt = (
      await database.query.userSetting.findFirst({
        where: eq(userSetting.key, "fsrs_optimizer_config")
      })
    )?.updatedAt;
    const finalCacheKey = await getFsrsOptimizerCacheKeyPart(database);

    expect(result).toMatchObject({
      reason: "too-soon",
      status: "skipped"
    });
    expect(initialConfigUpdatedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(finalConfigUpdatedAt).toBe(initialConfigUpdatedAt);
    expect(finalCacheKey).toBe(initialCacheKey);
    expect(snapshot.config).toEqual(getFsrsOptimizerConfigDefaults());
  });

  it("reports the full eligible review count before the first successful training", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });

    const status = await getFsrsOptimizerStatus(database);

    expect(status.newEligibleReviews).toBe(600);
    expect(status.state.newEligibleReviewsSinceLastTraining).toBe(600);
    expect(status.totalEligibleReviews).toBe(600);
  });

  it(
    "persists optimized parameters for both card-type presets on a forced run",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });

      const result = await runFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result.status).toBe("trained");
      expect(snapshot.config).toMatchObject({
        desiredRetention: 0.9,
        enabled: true,
        minDaysBetweenRuns: 30,
        minNewReviews: 500,
        presetStrategy: "card_type_v1"
      });
      expect(snapshot.presets.recognition?.weights).toHaveLength(
        reviewSchedulerConfig.fsrs.w.length
      );
      expect(snapshot.presets.concept?.weights).toHaveLength(
        reviewSchedulerConfig.fsrs.w.length
      );
      expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
        "2026-04-01T09:00:00.000Z"
      );
      expect(snapshot.state.totalEligibleReviewsAtLastTraining).toBe(24);
    },
    20_000
  );

  it(
    "keeps reviews that arrive during training in the post-training baseline",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });

      const concurrentDatabase = createDatabaseClient({
        databaseUrl: databasePath
      });
      let injected = false;
      const originalExecute = database.$client.execute.bind(database.$client);
      const executeSpy = vi
        .spyOn(database.$client, "execute")
        .mockImplementation(async (...args) => {
          const statement = args[0] as unknown;
          const sql =
            typeof statement === "string"
              ? statement
              : typeof statement === "object" &&
                  statement !== null &&
                  "sql" in statement
                ? String((statement as { sql: string }).sql)
                : "";

          const result = await originalExecute(args[0]!);

          if (!injected && sql.includes("from review_subject_log rsl")) {
            injected = true;
            await concurrentDatabase.insert(reviewSubjectLog).values(
              {
                answeredAt: "2026-04-01T09:05:00.000Z",
                cardId: "recognition-card",
                elapsedDays: 4,
                id: "review_subject_log_recognition_during_training",
                newState: "review",
                previousState: "review",
                rating: "good",
                responseMs: 940,
                scheduledDueAt: "2026-04-08T09:05:00.000Z",
                schedulerVersion: "fsrs_v1",
                subjectKey: "card:recognition-card"
              }
            );
          }

          return result;
        });

      try {
        const result = await runFsrsOptimizer({
          database,
          force: true,
          now: new Date("2026-04-01T09:00:00.000Z")
        });

        expect(result.status).toBe("trained");

        const snapshot = await getFsrsOptimizerSnapshot(database);
        const status = await getFsrsOptimizerStatus(database);

        expect(snapshot.state.totalEligibleReviewsAtLastTraining).toBe(24);
        expect(snapshot.state.newEligibleReviewsSinceLastTraining).toBe(1);
        expect(status.newEligibleReviews).toBe(1);
        expect(status.totalEligibleReviews).toBe(25);
      } finally {
        executeSpy.mockRestore();
        closeDatabaseClient(concurrentDatabase);
      }
    },
    20_000
  );

  it(
    "rolls back partial preset writes if the training transaction fails",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });

      const baseline = await runFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      expect(baseline.status).toBe("trained");

      const baselineSnapshot = await getFsrsOptimizerSnapshot(database);
      const baselineRecognition = baselineSnapshot.presets.recognition;
      const baselineConcept = baselineSnapshot.presets.concept;
      const baselineSuccessfulTrainingAt =
        baselineSnapshot.state.lastSuccessfulTrainingAt;

      await database.insert(reviewSubjectLog).values(
        buildReviewLogs({
          cardId: "recognition-card",
          count: 1,
          subjectKey: "card:recognition-card",
          startIndex: 12
        })[0]!
      );

      await installConceptWriteAbortTrigger(database);

      await expect(
        runFsrsOptimizer({
          database,
          force: true,
          now: new Date("2026-04-10T09:00:00.000Z")
        })
      ).rejects.toThrow(/fsrs_params_concept/i);

      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(snapshot.presets.recognition).toEqual(baselineRecognition);
      expect(snapshot.presets.concept).toEqual(baselineConcept);
      expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
        baselineSuccessfulTrainingAt
      );
    },
    40_000
  );

  it(
    "skips training for presets below the minimum size while still training the larger one",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 4,
        recognitionLogCount: 12
      });

      const result = await runFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result.status).toBe("trained");
      if (result.status !== "trained") {
        throw new Error("Expected trained result.");
      }
      expect(result.presetResults.recognition.status).toBe("trained");
      expect(result.presetResults.concept.status).toBe("unchanged");
      expect(snapshot.presets.recognition).not.toBeNull();
      expect(snapshot.presets.concept).toBeNull();
    },
    20_000
  );

  it(
    "allows a forced run even when the automatic optimizer is disabled",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });
      await writeFsrsOptimizerConfig(
        {
          ...getFsrsOptimizerConfigDefaults(),
          enabled: false
        },
        database,
        "2026-03-01T10:00:00.000Z"
      );

      const result = await runFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result.status).toBe("trained");
      expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
        "2026-04-01T09:00:00.000Z"
      );
      expect(snapshot.presets.recognition).not.toBeNull();
      expect(snapshot.presets.concept).not.toBeNull();
    },
    20_000
  );

  it(
    "does not attach optimized weights to unsupported card types",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });
      await runFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });

      const snapshot = await getFsrsOptimizerSnapshot(database);
      const productionSeedState = buildReviewSeedStateWithFsrsPreset(
        {
          difficulty: 3.1,
          dueAt: "2026-04-20T09:00:00.000Z",
          lapses: 1,
          lastReviewedAt: "2026-04-10T09:00:00.000Z",
          learningSteps: 0,
          reps: 4,
          scheduledDays: 10,
          stability: 4.2,
          state: "review"
        },
        "production",
        snapshot
      );

      expect(productionSeedState.fsrsDesiredRetention).toBe(0.9);
      expect(productionSeedState.fsrsWeights).toBeNull();
    },
    20_000
  );

  it(
    "uses the same optimized preset for preview scheduling and grading",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });
      await runFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });

      const snapshot = await getFsrsOptimizerSnapshot(database);
      const subjectState = await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, "card:recognition-card")
      });

      expect(subjectState).not.toBeNull();

      const baseSeedState = {
        difficulty: subjectState!.difficulty,
        dueAt: subjectState!.dueAt,
        lapses: subjectState!.lapses,
        lastReviewedAt: subjectState!.lastReviewedAt,
        learningSteps: subjectState!.learningSteps,
        reps: subjectState!.reps,
        scheduledDays: subjectState!.scheduledDays,
        stability: subjectState!.stability,
        state: subjectState!.state
      };
      const optimizedSeedState = buildReviewSeedStateWithFsrsPreset(
        baseSeedState,
        "recognition",
        snapshot
      );
      const now = new Date("2026-04-20T09:00:00.000Z");
      const expected = scheduleReview({
        current: {
          difficulty: optimizedSeedState.difficulty,
          dueAt: optimizedSeedState.dueAt,
          lapses: optimizedSeedState.lapses,
          lastReviewedAt: optimizedSeedState.lastReviewedAt,
          learningSteps: optimizedSeedState.learningSteps,
          reps: optimizedSeedState.reps,
          scheduledDays: optimizedSeedState.scheduledDays,
          stability: optimizedSeedState.stability,
          state: optimizedSeedState.state
        },
        now,
        rating: "good",
        scheduler: {
          desiredRetention: optimizedSeedState.fsrsDesiredRetention,
          weights: optimizedSeedState.fsrsWeights
        }
      });
      const previews = buildReviewGradePreviews(optimizedSeedState, now);

      expect(optimizedSeedState.fsrsWeights).toEqual(
        snapshot.presets.recognition?.weights ?? null
      );
      expect(previews).toHaveLength(4);
      expect(previews.find((preview) => preview.rating === "good")).toBeDefined();

      const result = await applyReviewGrade({
        cardId: "recognition-card",
        database,
        now,
        rating: "good"
      });
      const latestLog = await database.query.reviewSubjectLog.findFirst({
        orderBy: desc(reviewSubjectLog.answeredAt),
        where: eq(reviewSubjectLog.subjectKey, "card:recognition-card")
      });

      expect(result.dueAt).toBe(expected.dueAt);
      expect(latestLog?.scheduledDueAt).toBe(expected.dueAt);
    },
    20_000
  );

  it(
    "stores the training baseline from the same log snapshot used to fit the presets",
    async () => {
      await seedFsrsFixture(database, {
        conceptLogCount: 12,
        recognitionLogCount: 12
      });

      const originalExecute = database.$client.execute.bind(database.$client);
      let injectedLog = false;
      const executeSpy = vi
        .spyOn(database.$client, "execute")
        .mockImplementation(async (...args) => {
          const statement = args[0] as unknown;
          const sql =
            typeof statement === "string"
              ? statement
              : typeof statement === "object" &&
                  statement !== null &&
                  "sql" in statement
                ? String((statement as { sql: string }).sql)
                : "";

          if (!injectedLog && sql.includes("rsl.id as id")) {
            injectedLog = true;
            await database.insert(reviewSubjectLog).values({
              answeredAt: "2026-04-01T08:59:59.000Z",
              cardId: "recognition-card",
              elapsedDays: 4,
              id: "review_subject_log_recognition_snapshot_race",
              newState: "review",
              previousState: "review",
              rating: "good",
              responseMs: 900,
              scheduledDueAt: "2026-04-08T00:00:00.000Z",
              schedulerVersion: "fsrs_v1",
              subjectKey: "card:recognition-card"
            });
          }

          return originalExecute(args[0]!);
        });

      try {
        await runFsrsOptimizer({
          database,
          force: true,
          now: new Date("2026-04-01T09:00:00.000Z")
        });
      } finally {
        executeSpy.mockRestore();
      }

      const status = await getFsrsOptimizerStatus(database);
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(snapshot.state.totalEligibleReviewsAtLastTraining).toBe(25);
      expect(snapshot.state.newEligibleReviewsSinceLastTraining).toBe(0);
      expect(status.newEligibleReviews).toBe(0);
      expect(status.totalEligibleReviews).toBe(25);
    },
    20_000
  );

  it(
    "skips the scheduled script when the monthly gate is not yet satisfied",
    async () => {
      await recreateDatabaseWithFixture({
        conceptLogCount: 4,
        recognitionLogCount: 4
      });

    const { stdout } = await execNodeScript("scripts/fsrs-optimize-if-needed.ts");
    const reopened = createDatabaseClient({
      databaseUrl: databasePath
    });

    try {
      const snapshot = await getFsrsOptimizerSnapshot(reopened);

      expect(stdout).toContain("insufficient-new-reviews");
      expect(snapshot.presets.recognition).toBeNull();
      expect(snapshot.presets.concept).toBeNull();
    } finally {
        closeDatabaseClient(reopened);
      }
    },
    20_000
  );

  it(
    "runs the forced optimizer script and persists the trained presets",
    async () => {
      await recreateDatabaseWithFixture({
        conceptLogCount: 12,
        recognitionLogCount: 12
      });

    const { stdout } = await execNodeScript("scripts/fsrs-optimize.ts");
    const reopened = createDatabaseClient({
      databaseUrl: databasePath
    });

    try {
      const snapshot = await getFsrsOptimizerSnapshot(reopened);

      expect(stdout).toContain("FSRS optimizer completato");
      expect(snapshot.presets.recognition).not.toBeNull();
      expect(snapshot.presets.concept).not.toBeNull();
    } finally {
        closeDatabaseClient(reopened);
      }
    },
    20_000
  );

  it(
    "runs the forced optimizer script even when the automatic optimizer is disabled",
    async () => {
      await recreateDatabaseWithFixture({
        conceptLogCount: 12,
        recognitionLogCount: 12
      });
      await writeFsrsOptimizerConfig(
        {
          ...getFsrsOptimizerConfigDefaults(),
          enabled: false
        },
        database,
        "2026-03-01T10:00:00.000Z"
      );

      const { stdout } = await execNodeScript("scripts/fsrs-optimize.ts");
      const reopened = createDatabaseClient({
        databaseUrl: databasePath
      });

      try {
        const snapshot = await getFsrsOptimizerSnapshot(reopened);

        expect(stdout).toContain("FSRS optimizer completato");
        expect(snapshot.state.lastSuccessfulTrainingAt).not.toBeNull();
        expect(snapshot.presets.recognition).not.toBeNull();
        expect(snapshot.presets.concept).not.toBeNull();
      } finally {
        closeDatabaseClient(reopened);
      }
    },
    20_000
  );

  async function recreateDatabaseWithFixture(input: {
    conceptLogCount: number;
    recognitionLogCount: number;
  }) {
    closeDatabaseClient(database);
    database = createDatabaseClient({
      databaseUrl: databasePath
    });
    await runMigrations(database);
    await seedFsrsFixture(database, input);
    closeDatabaseClient(database);
    database = createDatabaseClient({
      databaseUrl: databasePath
    });
  }

  async function execNodeScript(scriptRelativePath: string) {
    return execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--experimental-default-type=module",
        path.join(process.cwd(), scriptRelativePath)
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: databasePath
        }
      }
    );
  }
});

async function seedFsrsFixture(
  database: DatabaseClient,
  input: {
    conceptLogCount: number;
    recognitionLogCount: number;
  }
) {
  const createdAt = "2026-03-01T09:00:00.000Z";
  const updatedAt = "2026-03-01T09:00:00.000Z";

  await database.insert(media).values({
    id: "media-fsrs",
    slug: "media-fsrs",
    title: "FSRS Fixture",
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: "Fixture minima per optimizer FSRS.",
    status: "active",
    createdAt,
    updatedAt
  });
  await database.insert(lesson).values({
    id: "lesson-fsrs",
    mediaId: "media-fsrs",
    segmentId: null,
    slug: "intro",
    title: "Intro",
    orderIndex: 1,
    difficulty: "beginner",
    summary: "Lesson fixture.",
    status: "active",
    sourceFile: "tests/fsrs-optimizer/intro.md",
    createdAt,
    updatedAt
  });
  await database.insert(lessonProgress).values({
    lessonId: "lesson-fsrs",
    status: "completed",
    completedAt: createdAt,
    lastOpenedAt: createdAt,
    startedAt: createdAt
  });
  await database.insert(card).values([
    {
      id: "recognition-card",
      mediaId: "media-fsrs",
      lessonId: "lesson-fsrs",
      segmentId: null,
      sourceFile: "tests/fsrs-optimizer/recognition.md",
      cardType: "recognition",
      front: "認識",
      normalizedFront: "認識",
      back: "recognition",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt,
      updatedAt
    },
    {
      id: "concept-card",
      mediaId: "media-fsrs",
      lessonId: "lesson-fsrs",
      segmentId: null,
      sourceFile: "tests/fsrs-optimizer/concept.md",
      cardType: "concept",
      front: "概念",
      normalizedFront: "概念",
      back: "concept",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 2,
      createdAt,
      updatedAt
    }
  ]);
  await database.insert(reviewSubjectState).values([
    {
      subjectKey: "card:recognition-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "recognition-card",
      state: "review",
      stability: 4.2,
      difficulty: 3.1,
      dueAt: "2026-04-20T09:00:00.000Z",
      lastReviewedAt: "2026-04-10T09:00:00.000Z",
      lastInteractionAt: "2026-04-10T09:00:00.000Z",
      scheduledDays: 10,
      learningSteps: 0,
      lapses: 1,
      reps: 4,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt,
      updatedAt
    },
    {
      subjectKey: "card:concept-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "concept-card",
      state: "review",
      stability: 3.4,
      difficulty: 3.7,
      dueAt: "2026-04-18T09:00:00.000Z",
      lastReviewedAt: "2026-04-08T09:00:00.000Z",
      lastInteractionAt: "2026-04-08T09:00:00.000Z",
      scheduledDays: 7,
      learningSteps: 0,
      lapses: 2,
      reps: 4,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt,
      updatedAt
    }
  ]);
  await database.insert(reviewSubjectLog).values([
    ...buildReviewLogs({
      cardId: "recognition-card",
      count: input.recognitionLogCount,
      subjectKey: "card:recognition-card"
    }),
    ...buildReviewLogs({
      cardId: "concept-card",
      count: input.conceptLogCount,
      subjectKey: "card:concept-card"
    })
  ]);
  await database.insert(userSetting).values({
    key: "review_daily_limit",
    valueJson: JSON.stringify(20),
    updatedAt
  });
}

async function installConceptWriteAbortTrigger(database: DatabaseClient) {
  await database.$client.execute({
    sql: `
      create trigger if not exists fsrs_params_concept_insert_block
      before insert on user_setting
      when new.key = 'fsrs_params_concept'
      begin
        select raise(abort, 'concept write blocked');
      end;
    `
  });
  await database.$client.execute({
    sql: `
      create trigger if not exists fsrs_params_concept_update_block
      before update on user_setting
      when new.key = 'fsrs_params_concept'
      begin
        select raise(abort, 'concept write blocked');
      end;
    `
  });
}

function buildReviewLogs(input: {
  cardId: string;
  count: number;
  subjectKey: string;
  startIndex?: number;
}): Array<typeof reviewSubjectLog.$inferInsert> {
  const baseTime = new Date("2026-01-01T09:00:00.000Z").getTime();
  const startIndex = input.startIndex ?? 0;
  const ratings = ["good", "hard", "easy", "good"] as const;

  return Array.from({ length: input.count }, (_, index) => {
    const reviewIndex = startIndex + index;
    const answeredAt = new Date(baseTime + reviewIndex * DAY).toISOString();
    const scheduledDueAt = new Date(
      baseTime + (reviewIndex + 1) * DAY
    ).toISOString();

    return {
      id: `${input.cardId}-log-${reviewIndex + 1}`,
      subjectKey: input.subjectKey,
      cardId: input.cardId,
      answeredAt,
      rating: ratings[reviewIndex % ratings.length],
      previousState: reviewIndex === 0 ? "new" : "review",
      newState: "review",
      scheduledDueAt,
      elapsedDays: reviewIndex === 0 ? 0 : reviewIndex,
      responseMs: 1_000 + reviewIndex,
      schedulerVersion: "fsrs_v1" as const
    };
  });
}

function buildLogRow(input: {
  answeredAt: string;
  cardId: string;
  cardType: string;
  elapsedDays: number | null;
  id: string;
  rating: string;
  subjectKey: string;
}) {
  return {
    answeredAt: input.answeredAt,
    cardType: input.cardType,
    elapsedDays: input.elapsedDays,
    id: input.id,
    rating: input.rating,
    subjectKey: input.subjectKey
  };
}

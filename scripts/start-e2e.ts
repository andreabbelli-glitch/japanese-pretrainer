import "dotenv/config";

import path from "node:path";
import { spawn } from "node:child_process";
import { readdir, rm, stat } from "node:fs/promises";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  segment,
  term,
  userSetting
} from "../src/db/index.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";
import { buildStartE2ERuntimeEnv, resolveStartE2EDatabaseUrl } from "./start-e2e-config.ts";

const database = createDatabaseClient({
  databaseUrl: resolveStartE2EDatabaseUrl(process.env)
});
const contentRoot = path.resolve(process.cwd(), "content");
const nextBuildIdPath = path.resolve(process.cwd(), ".next", "BUILD_ID");
const nextCachePath = path.resolve(process.cwd(), ".next", "cache");
const runtimeEnv = buildStartE2ERuntimeEnv(process.env);

try {
  await assertFreshProductionBuild();
  await runMigrations(database);

  const importResult = await importContentWorkspace({
    contentRoot,
    database
  });

  if (importResult.status === "failed") {
    console.error(importResult.message);

    for (const issue of importResult.issues) {
      console.error(
        `[${issue.category}] ${issue.code} - ${issue.location.filePath} - ${issue.message}`
      );
    }

    process.exit(1);
  }

  await purgeArchivedMedia(database);
  await seedE2ELessonProgress(database);
  await seedE2EUserSettings(database);
  await backfillReviewSubjectState(database);
  await seedKanjiClashE2EFixture(database);
} finally {
  closeDatabaseClient(database);
}

await rm(nextCachePath, { force: true, recursive: true });

const nextStart = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "start", "--port", "3100"],
  {
    cwd: process.cwd(),
    env: runtimeEnv,
    stdio: "inherit"
  }
);

function stopNextStart(signal: NodeJS.Signals = "SIGTERM") {
  if (nextStart.exitCode !== null || nextStart.signalCode !== null) {
    return;
  }

  nextStart.kill(signal);
}

nextStart.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

process.once("exit", () => {
  stopNextStart("SIGTERM");
});

for (const eventName of ["SIGINT", "SIGTERM"] as const) {
  process.once(eventName, () => {
    stopNextStart(eventName);
    process.exit(eventName === "SIGINT" ? 130 : 143);
  });
}

async function assertFreshProductionBuild() {
  const buildMarker = await statOrNull(nextBuildIdPath);

  if (!buildMarker) {
    throw new Error(
      [
        "Missing Next.js production build for E2E.",
        "Run ./scripts/with-node.sh pnpm build or ./scripts/with-node.sh pnpm test:e2e before starting the runner."
      ].join("\n")
    );
  }

  const newestSourceEntry = await findNewestSourceEntry([
    path.resolve(process.cwd(), "src"),
    path.resolve(process.cwd(), "package.json"),
    path.resolve(process.cwd(), "next.config.ts"),
    path.resolve(process.cwd(), "tsconfig.json")
  ]);

  if (!newestSourceEntry || newestSourceEntry.mtimeMs <= buildMarker.mtimeMs) {
    return;
  }

  throw new Error(
    [
      "Stale Next.js production build detected for E2E.",
      `Last build: ${formatFreshnessTimestamp(buildMarker.mtimeMs)} (.next/BUILD_ID)`,
      `Newest source: ${formatFreshnessTimestamp(newestSourceEntry.mtimeMs)} (${path.relative(process.cwd(), newestSourceEntry.filePath)})`,
      "Run ./scripts/with-node.sh pnpm build or ./scripts/with-node.sh pnpm test:e2e before retrying."
    ].join("\n")
  );
}

async function findNewestSourceEntry(entryPaths: string[]) {
  let newestEntry: FreshnessEntry | null = null;

  for (const entryPath of entryPaths) {
    const currentEntry = await findNewestEntryWithin(entryPath);

    if (!currentEntry) {
      continue;
    }

    if (!newestEntry || currentEntry.mtimeMs > newestEntry.mtimeMs) {
      newestEntry = currentEntry;
    }
  }

  return newestEntry;
}

type FreshnessEntry = {
  filePath: string;
  mtimeMs: number;
};

async function findNewestEntryWithin(
  entryPath: string
): Promise<FreshnessEntry | null> {
  const entryStat = await statOrNull(entryPath);

  if (!entryStat) {
    return null;
  }

  if (entryStat.isFile()) {
    return {
      filePath: entryPath,
      mtimeMs: entryStat.mtimeMs
    };
  }

  if (!entryStat.isDirectory()) {
    return null;
  }

  let newestEntry: FreshnessEntry | null = null;
  const directoryEntries = await readdir(entryPath, { withFileTypes: true });

  for (const directoryEntry of directoryEntries) {
    const childEntryPath = path.join(entryPath, directoryEntry.name);
    const currentEntry: FreshnessEntry | null =
      await findNewestEntryWithin(childEntryPath);

    if (!currentEntry) {
      continue;
    }

    if (!newestEntry || currentEntry.mtimeMs > newestEntry.mtimeMs) {
      newestEntry = currentEntry;
    }
  }

  return newestEntry;
}

async function statOrNull(filePath: string) {
  try {
    return await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function formatFreshnessTimestamp(value: number) {
  return new Date(value).toISOString();
}

async function seedE2ELessonProgress(database: DatabaseClient) {
  const duelMastersMedia = await database.query.media.findFirst({
    where: eq(media.slug, "duel-masters-dm25")
  });

  if (!duelMastersMedia) {
    return;
  }

  const reviewLessons = await database
    .select({
      lessonId: lesson.id
    })
    .from(card)
    .innerJoin(lesson, eq(card.lessonId, lesson.id))
    .where(
      and(eq(card.mediaId, duelMastersMedia.id), ne(lesson.slug, "tcg-core-overview"))
    )
    .groupBy(lesson.id, lesson.slug, lesson.orderIndex)
    .orderBy(asc(lesson.orderIndex), asc(lesson.slug))
    .limit(4);

  if (reviewLessons.length === 0) {
    return;
  }

  const nowIso = new Date().toISOString();

  await database
    .insert(lessonProgress)
    .values(
      reviewLessons.map((reviewLesson) => ({
        lessonId: reviewLesson.lessonId,
        status: "completed" as const,
        startedAt: nowIso,
        completedAt: nowIso,
        lastOpenedAt: nowIso
      }))
    )
    .onConflictDoUpdate({
      target: lessonProgress.lessonId,
      set: {
        status: "completed",
        startedAt: nowIso,
        completedAt: nowIso,
        lastOpenedAt: nowIso
      }
    });
}

async function seedE2EUserSettings(database: DatabaseClient) {
  const nowIso = new Date().toISOString();

  await database
    .insert(userSetting)
    .values([
      {
        key: "furigana_mode",
        updatedAt: nowIso,
        valueJson: JSON.stringify("hover")
      },
      {
        key: "glossary_default_sort",
        updatedAt: nowIso,
        valueJson: JSON.stringify("lesson_order")
      },
      {
        key: "review_daily_limit",
        updatedAt: nowIso,
        valueJson: JSON.stringify(20)
      },
      {
        key: "review_front_furigana",
        updatedAt: nowIso,
        valueJson: JSON.stringify(true)
      }
    ])
    .onConflictDoUpdate({
      target: userSetting.key,
      set: {
        updatedAt: nowIso,
        valueJson: sql`excluded.value_json`
      }
    });
}

async function seedKanjiClashE2EFixture(database: DatabaseClient) {
  const existingMedia = await database.query.media.findFirst({
    where: eq(media.slug, "zz-kanji-clash-e2e")
  });

  if (existingMedia) {
    return;
  }

  const nowIso = new Date().toISOString();

  await database
    .insert(media)
    .values({
      baseExplanationLanguage: "it",
      createdAt: nowIso,
      description: "Fixture Kanji Clash per E2E.",
      id: "media-kanji-clash-e2e",
      language: "ja",
      mediaType: "game",
      segmentKind: "chapter",
      slug: "zz-kanji-clash-e2e",
      status: "active",
      title: "ZZ Kanji Clash E2E",
      updatedAt: nowIso
    })
    .onConflictDoNothing();

  await database
    .insert(segment)
    .values({
      id: "segment-kanji-clash-e2e",
      mediaId: "media-kanji-clash-e2e",
      notes: null,
      orderIndex: 1,
      segmentType: "chapter",
      slug: "segment-kanji-clash-e2e",
      title: "Segment Kanji Clash E2E"
    })
    .onConflictDoNothing();

  await database
    .insert(lesson)
    .values({
      createdAt: nowIso,
      difficulty: "beginner",
      id: "lesson-kanji-clash-e2e",
      mediaId: "media-kanji-clash-e2e",
      orderIndex: 1,
      segmentId: "segment-kanji-clash-e2e",
      slug: "lesson-kanji-clash-e2e",
      sourceFile: "tests/e2e/kanji-clash-fixture.md",
      status: "active",
      summary: "Fixture Kanji Clash E2E",
      title: "Fixture Kanji Clash E2E",
      updatedAt: nowIso
    })
    .onConflictDoNothing();

  await database
    .insert(lessonProgress)
    .values({
      completedAt: nowIso,
      lastOpenedAt: nowIso,
      lessonId: "lesson-kanji-clash-e2e",
      startedAt: nowIso,
      status: "completed"
    })
    .onConflictDoNothing();

  const fixtureTerms = [
    {
      cardId: "card-kanji-clash-e2e-shokuhi",
      id: "term-kanji-clash-e2e-shokuhi",
      lemma: "食費",
      meaningIt: "spese per il cibo",
      reading: "しょくひ",
      reps: 3,
      stability: 8.2
    },
    {
      cardId: "card-kanji-clash-e2e-shokuhin",
      id: "term-kanji-clash-e2e-shokuhin",
      lemma: "食品",
      meaningIt: "alimento",
      reading: "しょくひん",
      reps: 4,
      stability: 9.1
    },
    {
      cardId: "card-kanji-clash-e2e-shokutaku",
      id: "term-kanji-clash-e2e-shokutaku",
      lemma: "食卓",
      meaningIt: "tavolo da pranzo",
      reading: "しょくたく",
      reps: 3,
      stability: 8.7
    },
    {
      cardId: "card-kanji-clash-e2e-inshoku",
      id: "term-kanji-clash-e2e-inshoku",
      lemma: "飲食",
      meaningIt: "cibo e bevande",
      reading: "いんしょく",
      reps: 5,
      stability: 10.2
    }
  ] as const;

  await database
    .insert(term)
    .values(
      fixtureTerms.map((fixtureTerm) =>
        buildKanjiClashE2ETermRow(fixtureTerm, nowIso)
      )
    )
    .onConflictDoNothing();

  await database
    .insert(card)
    .values(
      fixtureTerms.map((fixtureTerm) =>
        buildKanjiClashE2ECardRow(fixtureTerm, nowIso)
      )
    )
    .onConflictDoNothing();

  await database
    .insert(cardEntryLink)
    .values(
      fixtureTerms.map((fixtureTerm) =>
        buildKanjiClashE2ECardEntryLinkRow(fixtureTerm)
      )
    )
    .onConflictDoNothing();

  await database
    .insert(reviewSubjectState)
    .values(
      fixtureTerms.map((fixtureTerm) =>
        buildKanjiClashE2EReviewSubjectStateRow(fixtureTerm, nowIso)
      )
    )
    .onConflictDoNothing();
}

function buildKanjiClashE2ETermRow(
  fixtureTerm: {
    id: string;
    lemma: string;
    meaningIt: string;
    reading: string;
  },
  nowIso: string
): typeof term.$inferInsert {
  return {
    createdAt: nowIso,
    crossMediaGroupId: null,
    id: fixtureTerm.id,
    lemma: fixtureTerm.lemma,
    meaningIt: fixtureTerm.meaningIt,
    mediaId: "media-kanji-clash-e2e",
    reading: fixtureTerm.reading,
    romaji: fixtureTerm.reading,
    searchLemmaNorm: fixtureTerm.lemma,
    searchReadingNorm: fixtureTerm.reading,
    searchRomajiNorm: fixtureTerm.reading,
    segmentId: "segment-kanji-clash-e2e",
    sourceId: fixtureTerm.id,
    updatedAt: nowIso
  };
}

function buildKanjiClashE2ECardRow(
  fixtureTerm: {
    cardId: string;
    lemma: string;
  },
  nowIso: string
): typeof card.$inferInsert {
  return {
    back: `${fixtureTerm.lemma} meaning`,
    cardType: "recognition",
    createdAt: nowIso,
    front: fixtureTerm.lemma,
    id: fixtureTerm.cardId,
    lessonId: "lesson-kanji-clash-e2e",
    mediaId: "media-kanji-clash-e2e",
    normalizedFront: fixtureTerm.lemma,
    orderIndex: 1,
    segmentId: "segment-kanji-clash-e2e",
    sourceFile: `tests/${fixtureTerm.cardId}.md`,
    status: "active",
    updatedAt: nowIso
  };
}

function buildKanjiClashE2ECardEntryLinkRow(fixtureTerm: {
  cardId: string;
  id: string;
}): typeof cardEntryLink.$inferInsert {
  return {
    cardId: fixtureTerm.cardId,
    entryId: fixtureTerm.id,
    entryType: "term",
    id: `${fixtureTerm.cardId}-${fixtureTerm.id}`,
    relationshipType: "primary"
  };
}

function buildKanjiClashE2EReviewSubjectStateRow(
  fixtureTerm: {
    cardId: string;
    id: string;
    reps: number;
    stability: number;
  },
  nowIso: string
): typeof reviewSubjectState.$inferInsert {
  return {
    cardId: fixtureTerm.cardId,
    createdAt: nowIso,
    crossMediaGroupId: null,
    difficulty: 2.5,
    dueAt: nowIso,
    entryId: fixtureTerm.id,
    entryType: "term",
    lapses: 0,
    lastInteractionAt: nowIso,
    lastReviewedAt: nowIso,
    learningSteps: 0,
    manualOverride: false,
    reps: fixtureTerm.reps,
    scheduledDays: 3,
    schedulerVersion: "fsrs_v1",
    stability: fixtureTerm.stability,
    state: "review",
    subjectKey: `entry:term:${fixtureTerm.id}`,
    subjectType: "entry",
    suspended: false,
    updatedAt: nowIso
  };
}

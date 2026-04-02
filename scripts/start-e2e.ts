import "dotenv/config";

import path from "node:path";
import { spawn } from "node:child_process";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient,
  lesson,
  lessonProgress,
  media,
  runMigrations,
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
const runtimeEnv = buildStartE2ERuntimeEnv(process.env);

try {
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
} finally {
  closeDatabaseClient(database);
}

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

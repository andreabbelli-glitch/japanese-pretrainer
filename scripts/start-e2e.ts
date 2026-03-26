import "dotenv/config";

import path from "node:path";
import { spawn } from "node:child_process";
import { and, asc, eq, ne } from "drizzle-orm";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient,
  lesson,
  lessonProgress,
  media,
  runMigrations
} from "../src/db/index.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";
import { backfillReviewSubjectState } from "../src/lib/review-subject-state-backfill.ts";

const database = createDatabaseClient({
  databaseUrl: process.env.DATABASE_URL
});
const contentRoot = path.resolve(process.cwd(), "content");
const runtimeEnv = createE2ERuntimeEnv(process.env);

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

nextStart.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

for (const eventName of ["SIGINT", "SIGTERM"] as const) {
  process.on(eventName, () => {
    nextStart.kill(eventName);
  });
}

function createE2ERuntimeEnv(sourceEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...sourceEnv,
    AUTH_PASSWORD: "",
    AUTH_PASSWORD_HASH: "",
    AUTH_SESSION_SECRET: "",
    AUTH_USERNAME: ""
  };
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

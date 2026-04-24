import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";

import {
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lessonProgress,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";

type ReviewDatabaseFixture = {
  database: DatabaseClient;
  tempDir: string;
};

export async function setupReviewDatabase(options: {
  prefix: string;
  seedDevelopmentFixture?: boolean;
}): Promise<ReviewDatabaseFixture> {
  const tempDir = await mkdtemp(path.join(tmpdir(), options.prefix));
  const database = createDatabaseClient({
    databaseUrl: path.join(tempDir, "test.sqlite")
  });

  await runMigrations(database);

  if (options.seedDevelopmentFixture) {
    await seedDevelopmentDatabase(database);
    await markFixtureLessonCompleted(database);
  }

  return {
    database,
    tempDir
  };
}

export async function cleanupReviewDatabase({
  database,
  tempDir
}: ReviewDatabaseFixture) {
  closeDatabaseClient(database);
  await rm(tempDir, { recursive: true, force: true });
}

async function markFixtureLessonCompleted(client: DatabaseClient) {
  await client
    .update(lessonProgress)
    .set({
      status: "completed",
      completedAt: "2026-03-09T10:00:00.000Z"
    })
    .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
}

export async function markAllLessonsCompleted(
  client: DatabaseClient,
  completedAt: string
) {
  const lessons = await client.query.lesson.findMany();

  if (lessons.length === 0) {
    return;
  }

  await client
    .insert(lessonProgress)
    .values(
      lessons.map((lessonRow) => ({
        lessonId: lessonRow.id,
        status: "completed" as const,
        completedAt,
        lastOpenedAt: completedAt
      }))
    )
    .onConflictDoUpdate({
      target: lessonProgress.lessonId,
      set: {
        status: "completed",
        completedAt,
        lastOpenedAt: completedAt
      }
    });
}

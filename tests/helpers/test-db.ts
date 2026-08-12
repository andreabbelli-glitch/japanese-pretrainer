import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db/create-client";
import { lesson, lessonProgress } from "@/db/schema";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";

import { TEST_DATABASE_TEMPLATE_CONTEXT_KEY } from "./test-db-context";

export type TestDatabaseFixture = {
  database: DatabaseClient;
  databasePath: string;
  tempDir: string;
};

export type TestDatabaseCleanupFixture = Pick<
  TestDatabaseFixture,
  "database" | "tempDir"
>;

export type SetupTestDatabaseOptions = {
  markDevelopmentLessonCompleted?: boolean;
  prefix: string;
  seedDevelopmentFixture?: boolean;
};

export async function setupTestDatabase(
  options: SetupTestDatabaseOptions
): Promise<TestDatabaseFixture> {
  const tempDir = await mkdtemp(path.join(tmpdir(), options.prefix));
  const databasePath = path.join(tempDir, "test.sqlite");
  let database: DatabaseClient | undefined;

  try {
    const templatePath = await resolveTestDatabaseTemplatePath();

    if (templatePath) {
      await copyFile(templatePath, databasePath);
    }

    database = createDatabaseClient({
      databaseUrl: databasePath
    });

    if (!templatePath) {
      const { runMigrations } = await import("@/db/migrate");
      await runMigrations(database);
    }

    if (options.seedDevelopmentFixture) {
      await seedDevelopmentDatabase(database);
    }

    if (options.markDevelopmentLessonCompleted) {
      await markDevelopmentFixtureLessonCompleted(database);
    }

    return {
      database,
      databasePath,
      tempDir
    };
  } catch (error) {
    if (database) {
      closeDatabaseClient(database);
    }
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupTestDatabase({
  database,
  tempDir
}: TestDatabaseCleanupFixture) {
  closeDatabaseClient(database);
  await rm(tempDir, { recursive: true, force: true });
}

export async function withTestDatabase<T>(
  options: SetupTestDatabaseOptions,
  callback: (fixture: TestDatabaseFixture) => Promise<T>
): Promise<T> {
  const fixture = await setupTestDatabase(options);

  try {
    return await callback(fixture);
  } finally {
    await cleanupTestDatabase(fixture);
  }
}

export async function markLessonsCompleted(
  client: DatabaseClient,
  completedAt: string,
  options: {
    lessonIds?: string[];
  } = {}
) {
  const lessons =
    options.lessonIds && options.lessonIds.length > 0
      ? await client.query.lesson.findMany({
          where: inArray(lesson.id, options.lessonIds)
        })
      : await client.query.lesson.findMany();

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

async function markDevelopmentFixtureLessonCompleted(client: DatabaseClient) {
  await client
    .update(lessonProgress)
    .set({
      status: "completed",
      completedAt: "2026-03-09T10:00:00.000Z"
    })
    .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
}

async function resolveTestDatabaseTemplatePath(): Promise<string | undefined> {
  if (process.env.VITEST !== "true") {
    return undefined;
  }

  try {
    const { inject } = await import("vitest");
    return inject(TEST_DATABASE_TEMPLATE_CONTEXT_KEY);
  } catch {
    // Test helpers may also run in child processes that inherit VITEST without
    // Vitest's worker context. Falling back keeps those invocations correct.
    return undefined;
  }
}

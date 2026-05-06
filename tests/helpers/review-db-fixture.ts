import type { DatabaseClient } from "@/db";

import {
  cleanupTestDatabase,
  markLessonsCompleted,
  setupTestDatabase,
  type TestDatabaseCleanupFixture,
  type TestDatabaseFixture
} from "./test-db";

type ReviewDatabaseFixture = TestDatabaseFixture;

export async function setupReviewDatabase(options: {
  prefix: string;
  seedDevelopmentFixture?: boolean;
}): Promise<ReviewDatabaseFixture> {
  return setupTestDatabase({
    markDevelopmentLessonCompleted: options.seedDevelopmentFixture,
    prefix: options.prefix,
    seedDevelopmentFixture: options.seedDevelopmentFixture
  });
}

export async function cleanupReviewDatabase(
  fixture: TestDatabaseCleanupFixture
) {
  await cleanupTestDatabase(fixture);
}

export async function markAllLessonsCompleted(
  client: DatabaseClient,
  completedAt: string
) {
  await markLessonsCompleted(client, completedAt);
}

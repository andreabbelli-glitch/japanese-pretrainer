import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  lesson,
  media,
  runMigrations,
  type DatabaseClient
} from "@/db";
import { backfillCardLessonIdsFromContent } from "@/db/migrate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validContentRoot = path.join(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

describe("database migrations", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-migrate-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("backfills legacy card.lesson_id values from the content workspace", async () => {
    await database.insert(media).values({
      id: "media-sample-anime",
      slug: "sample-anime",
      title: "Sample Anime",
      mediaType: "anime",
      segmentKind: "episode",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture media for migration backfill.",
      status: "active",
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(lesson).values({
      id: "lesson-sample-anime-ep01-intro",
      mediaId: "media-sample-anime",
      segmentId: null,
      slug: "ep01-intro",
      title: "Episode 1 Intro",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson fixture for migration backfill.",
      status: "active",
      sourceFile: "media/sample-anime/textbook/001-intro.md",
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card-taberu-recognition",
      mediaId: "media-sample-anime",
      lessonId: null,
      segmentId: null,
      sourceFile: "media/sample-anime/cards/001-core.md",
      cardType: "recognition",
      front: "{{食|た}}べる",
      back: "mangiare",
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });

    const updated = await backfillCardLessonIdsFromContent(
      database,
      validContentRoot
    );

    const migratedCard = await database.query.card.findFirst({
      where: eq(card.id, "card-taberu-recognition")
    });

    expect(updated).toBe(1);
    expect(migratedCard?.lessonId).toBe("lesson-sample-anime-ep01-intro");
  });
});

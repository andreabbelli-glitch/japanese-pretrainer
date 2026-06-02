import { describe, expect, it } from "vitest";

import {
  buildAppProgressBrief,
  formatAppProgressBrief,
  sanitizeDatabaseDisplayPath
} from "@/features/progress/tooling/app-progress-brief";
import type { DatabaseClient } from "@/db";
import { lesson, lessonProgress, media, segment } from "@/db/schema";
import { withTestDatabase } from "./helpers/test-db";

describe("app progress brief tooling", () => {
  it("summarizes runtime progress without treating latest content as app state", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-app-progress-brief-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        await seedRuntimeProgressFixture(database);

        const result = await buildAppProgressBrief({
          database,
          databaseInfo: {
            configuredPath: "./runtime.sqlite",
            isRemote: false
          },
          limit: 5,
          mediaSlug: "sample-runtime"
        });

        expect(result.summary).toMatchObject({
          completedLessons: 1,
          inProgressLessons: 1,
          lessonsTotal: 3,
          mediaCount: 1,
          notStartedLessons: 1,
          progressPercent: 33
        });
        expect(result.resumeLesson?.slug).toBe("first-lesson");
        expect(result.resumeLesson?.status).toBe("not_started");
        expect(result.activeLesson?.slug).toBe("second-lesson");
        expect(result.latestOpenedLesson?.slug).toBe("third-lesson");
        expect(result.latestCompletedLesson?.slug).toBe("third-lesson");
        expect(result.latestCompletedLesson?.sourceFile).toBe(
          "content/media/sample-runtime/textbook/003-third.md"
        );
        expect(result.inProgressLessons).toHaveLength(1);

        const output = formatAppProgressBrief(result);
        expect(output).toContain(
          "APP_PROGRESS_BRIEF source=runtime-db remote=false"
        );
        expect(output).toContain("NOTE runtime_state=true");
        expect(output).toContain("content_source_of_truth=false");
        expect(output).toContain("SUMMARY media=sample-runtime");
        expect(output).toContain("RESUME_LESSON media=sample-runtime");
        expect(output).toContain("LATEST_COMPLETED_LESSON media=sample-runtime");
        expect(output).toContain(
          "source_file=content/media/sample-runtime/textbook/003-third.md"
        );
        expect(output).not.toContain("content:import");
        expect(output).not.toContain("content:editorial-lint");
      }
    );
  });

  it("keeps global resume null while still reporting latest runtime events", async () => {
    await withTestDatabase(
      {
        prefix: "jcs-app-progress-brief-global-",
        seedDevelopmentFixture: false
      },
      async ({ database }) => {
        await seedRuntimeProgressFixture(database);
        await database.insert(media).values({
          baseExplanationLanguage: "it",
          createdAt: "2026-04-01T00:00:00.000Z",
          description: null,
          id: "media-other-runtime",
          language: "ja",
          mediaType: "manga",
          segmentKind: "chapter",
          slug: "other-runtime",
          status: "active",
          title: "Other Runtime",
          updatedAt: "2026-04-01T00:00:00.000Z"
        });

        const result = await buildAppProgressBrief({
          database,
          databaseInfo: {
            configuredPath:
              "libsql://user:secret@example.turso.io?authToken=hidden",
            isRemote: true
          },
          limit: 5
        });

        expect(result.database).toMatchObject({
          configuredPath: "libsql://example.turso.io",
          isRemote: true
        });
        expect(result.summary.mediaCount).toBe(2);
        expect(result.resumeLesson).toBeNull();
        expect(result.latestCompletedLesson?.slug).toBe("third-lesson");
        expect(result.media).toHaveLength(2);
      }
    );
  });

  it("redacts credentials and query strings from database display paths", () => {
    expect(
      sanitizeDatabaseDisplayPath(
        "libsql://user:secret@example.turso.io?authToken=hidden#frag"
      )
    ).toBe("libsql://example.turso.io");
    expect(sanitizeDatabaseDisplayPath("./data/local.sqlite")).toBe(
      "./data/local.sqlite"
    );
  });
});

async function seedRuntimeProgressFixture(database: DatabaseClient) {
  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt: "2026-03-01T00:00:00.000Z",
    description: "Runtime fixture media.",
    id: "media-sample-runtime",
    language: "ja",
    mediaType: "manga",
    segmentKind: "chapter",
    slug: "sample-runtime",
    status: "active",
    title: "Sample Runtime",
    updatedAt: "2026-03-01T00:00:00.000Z"
  });
  await database.insert(segment).values({
    id: "segment-sample-runtime-main",
    mediaId: "media-sample-runtime",
    notes: null,
    orderIndex: 1,
    segmentType: "main",
    slug: "main",
    title: "Main"
  });
  await database.insert(lesson).values([
    {
      createdAt: "2026-03-01T00:00:00.000Z",
      difficulty: "n5",
      id: "lesson-sample-runtime-first",
      mediaId: "media-sample-runtime",
      orderIndex: 10,
      segmentId: "segment-sample-runtime-main",
      slug: "first-lesson",
      sourceFile: "content/media/sample-runtime/textbook/001-first.md",
      status: "active",
      summary: "First lesson.",
      title: "First Lesson",
      updatedAt: "2026-03-01T00:00:00.000Z"
    },
    {
      createdAt: "2026-03-02T00:00:00.000Z",
      difficulty: "n5",
      id: "lesson-sample-runtime-second",
      mediaId: "media-sample-runtime",
      orderIndex: 20,
      segmentId: "segment-sample-runtime-main",
      slug: "second-lesson",
      sourceFile: "content/media/sample-runtime/textbook/002-second.md",
      status: "active",
      summary: "Second lesson.",
      title: "Second Lesson",
      updatedAt: "2026-03-02T00:00:00.000Z"
    },
    {
      createdAt: "2026-03-03T00:00:00.000Z",
      difficulty: "n5",
      id: "lesson-sample-runtime-third",
      mediaId: "media-sample-runtime",
      orderIndex: 30,
      segmentId: "segment-sample-runtime-main",
      slug: "third-lesson",
      sourceFile: "content/media/sample-runtime/textbook/003-third.md",
      status: "active",
      summary: "Third lesson.",
      title: "Third Lesson",
      updatedAt: "2026-03-03T00:00:00.000Z"
    }
  ]);
  await database.insert(lessonProgress).values([
    {
      completedAt: null,
      lastOpenedAt: "2026-03-11T10:00:00.000Z",
      lessonId: "lesson-sample-runtime-second",
      startedAt: "2026-03-11T09:00:00.000Z",
      status: "in_progress"
    },
    {
      completedAt: "2026-03-12T10:00:00.000Z",
      lastOpenedAt: "2026-03-12T10:15:00.000Z",
      lessonId: "lesson-sample-runtime-third",
      startedAt: "2026-03-12T09:00:00.000Z",
      status: "completed"
    }
  ]);
}

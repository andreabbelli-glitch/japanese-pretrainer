import { describe, expect, it } from "vitest";

import type { LessonListItem } from "@/db";
import { buildLessonMetrics } from "@/lib/study-metrics";

describe("buildLessonMetrics", () => {
  it("uses the most recently opened in-progress lesson for segment previews", () => {
    const metrics = buildLessonMetrics([
      buildLesson({
        id: "lesson-1",
        slug: "intro",
        title: "Intro",
        orderIndex: 1,
        progress: {
          status: "in_progress",
          lastOpenedAt: "2026-04-10T08:00:00.000Z"
        }
      }),
      buildLesson({
        id: "lesson-2",
        slug: "dialogues",
        title: "Dialoghi",
        orderIndex: 2,
        progress: {
          status: "in_progress",
          lastOpenedAt: "2026-04-10T09:00:00.000Z"
        }
      })
    ]);

    expect(metrics.inProgressLessons).toBe(2);
    expect(metrics.segments).toHaveLength(1);
    expect(metrics.segments[0]?.currentLessonTitle).toBe("Dialoghi");
  });
});

function buildLesson(input: {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
  progress?: {
    status: "in_progress" | "completed";
    lastOpenedAt: string | null;
  } | null;
}): LessonListItem {
  return {
    id: input.id,
    mediaId: "media-fixture",
    slug: input.slug,
    title: input.title,
    summary: null,
    orderIndex: input.orderIndex,
    difficulty: null,
    segmentId: "segment-1",
    status: "active",
    sourceFile: "fixtures/study-metrics.md",
    createdAt: "2026-04-10T07:00:00.000Z",
    updatedAt: "2026-04-10T07:00:00.000Z",
    segment: {
      id: "segment-1",
      mediaId: "media-fixture",
      slug: "segment-1",
      title: "Blocco 1",
      orderIndex: 1,
      segmentType: "chapter",
      notes: null
    },
    progress: input.progress
      ? {
          lessonId: input.id,
          status: input.progress.status,
          startedAt: input.progress.lastOpenedAt,
          lastOpenedAt: input.progress.lastOpenedAt,
          completedAt:
            input.progress.status === "completed"
              ? input.progress.lastOpenedAt
              : null
        }
      : null,
    content: {
      excerpt: null
    }
  } as LessonListItem;
}

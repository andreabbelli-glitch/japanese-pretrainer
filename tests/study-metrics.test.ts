import { describe, expect, it } from "vitest";

import {
  buildLessonMetrics,
  type LessonMetricsListItem
} from "@/features/study/model/metrics";

describe("buildLessonMetrics", () => {
  it("leaves resume and next lesson empty when every lesson is completed", () => {
    const metrics = buildLessonMetrics([
      buildLesson({
        id: "lesson-1",
        slug: "intro",
        title: "Intro",
        orderIndex: 1,
        progress: {
          status: "completed",
          lastOpenedAt: "2026-04-10T08:00:00.000Z"
        }
      }),
      buildLesson({
        id: "lesson-2",
        slug: "dialogues",
        title: "Dialoghi",
        orderIndex: 2,
        progress: {
          status: "completed",
          lastOpenedAt: "2026-04-10T09:00:00.000Z"
        }
      })
    ]);

    expect(metrics.lessonsCompleted).toBe(2);
    expect(metrics.nextLesson).toBeNull();
    expect(metrics.resumeLesson).toBeNull();
  });

  it("uses the first non-completed lesson as the next resume target", () => {
    const metrics = buildLessonMetrics([
      buildLesson({
        id: "lesson-1",
        slug: "intro",
        title: "Intro",
        orderIndex: 1,
        progress: {
          status: "completed",
          lastOpenedAt: "2026-04-10T08:00:00.000Z"
        }
      }),
      buildLesson({
        id: "lesson-2",
        slug: "dialogues",
        title: "Dialoghi",
        orderIndex: 2
      }),
      buildLesson({
        id: "lesson-3",
        slug: "boss",
        title: "Boss",
        orderIndex: 3,
        progress: {
          status: "in_progress",
          lastOpenedAt: "2026-04-10T09:00:00.000Z"
        }
      })
    ]);

    expect(metrics.nextLesson?.slug).toBe("dialogues");
    expect(metrics.resumeLesson?.slug).toBe("dialogues");
  });

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

  it("tracks the most recent completed lesson timestamp", () => {
    const metrics = buildLessonMetrics([
      buildLesson({
        id: "lesson-1",
        slug: "intro",
        title: "Intro",
        orderIndex: 1,
        progress: {
          status: "completed",
          lastOpenedAt: "2026-04-10T08:00:00.000Z"
        }
      }),
      buildLesson({
        id: "lesson-2",
        slug: "dialogues",
        title: "Dialoghi",
        orderIndex: 2,
        progress: {
          status: "completed",
          lastOpenedAt: "2026-04-12T09:00:00.000Z"
        }
      }),
      buildLesson({
        id: "lesson-3",
        slug: "boss",
        title: "Boss",
        orderIndex: 3,
        progress: {
          status: "in_progress",
          lastOpenedAt: "2026-04-13T09:00:00.000Z"
        }
      })
    ]);

    expect(metrics.latestCompletedLessonAt).toBe("2026-04-12T09:00:00.000Z");
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
}): LessonMetricsListItem {
  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    orderIndex: input.orderIndex,
    difficulty: null,
    summary: null,
    segment: {
      id: "segment-1",
      title: "Blocco 1",
      notes: null
    },
    progress: {
      status: input.progress?.status ?? "not_started",
      lastOpenedAt: input.progress?.lastOpenedAt ?? null,
      completedAt:
        input.progress?.status === "completed"
          ? input.progress.lastOpenedAt
          : null
    },
    content: {
      excerpt: null
    }
  };
}

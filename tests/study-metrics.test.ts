import { describe, expect, it } from "vitest";

import type { LessonListItem } from "@/db/queries";
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

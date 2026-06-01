import { eq, sql } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import { lessonProgress } from "@/db/schema";
import { updateStudySettings, type FuriganaMode } from "@/features/settings/server";
import {
  applyLessonOpenedState,
  LESSON_OPEN_WRITE_THROTTLE_MS,
  type LessonOpenState
} from "@/features/textbook/client/reader-state";
import type { TextbookLessonData } from "@/features/textbook/types";

export { applyLessonOpenedState };
export type { LessonOpenState };

type LessonProgressMutationClient = DatabaseQueryClient &
  Pick<DatabaseClient, "insert" | "update">;

export async function recordLessonOpened(
  lessonId: string,
  database: DatabaseClient = db
): Promise<LessonOpenState> {
  const now = new Date();
  const nowIso = now.toISOString();
  const existing = await database.query.lessonProgress.findFirst({
    where: eq(lessonProgress.lessonId, lessonId)
  });

  if (existing && shouldReuseRecentLessonOpen(existing, now)) {
    return toLessonOpenState(existing, nowIso);
  }

  const [updated] = await database
    .insert(lessonProgress)
    .values({
      lessonId,
      status: "in_progress",
      startedAt: nowIso,
      completedAt: null,
      lastOpenedAt: nowIso
    })
    .onConflictDoUpdate({
      target: lessonProgress.lessonId,
      set: {
        status: sql`case
          when ${lessonProgress.status} = 'completed'
            then ${lessonProgress.status}
          else 'in_progress'
        end`,
        startedAt: sql`case
          when ${lessonProgress.status} = 'not_started'
            or ${lessonProgress.startedAt} is null
            then excluded.started_at
          else ${lessonProgress.startedAt}
        end`,
        completedAt: sql`case
          when ${lessonProgress.status} = 'completed'
            then ${lessonProgress.completedAt}
          else null
        end`,
        lastOpenedAt: sql`excluded.last_opened_at`
      }
    })
    .returning({
      lastOpenedAt: lessonProgress.lastOpenedAt,
      startedAt: lessonProgress.startedAt,
      status: lessonProgress.status
    });

  return {
    lastOpenedAt: updated?.lastOpenedAt ?? nowIso,
    startedAt: updated?.startedAt ?? nowIso,
    status: updated?.status === "completed" ? "completed" : "in_progress"
  };
}

export async function settleLessonOpenedStateForRender(
  data: TextbookLessonData,
  openedState: Promise<LessonOpenState>,
  onError: (error: unknown) => void = defaultLessonOpenRenderErrorHandler
) {
  try {
    const state = await openedState;
    return applyLessonOpenedState(data, state);
  } catch (error) {
    onError(error);
    return data;
  }
}

export async function setLessonCompletionState(
  lessonId: string,
  completed: boolean,
  database: LessonProgressMutationClient = db
) {
  const nowIso = new Date().toISOString();
  const existing = await database.query.lessonProgress.findFirst({
    where: eq(lessonProgress.lessonId, lessonId)
  });

  if (!existing) {
    if (!completed) {
      return {
        completedNow: false,
        previousStatus: "not_started" as const,
        status: "not_started" as const
      };
    }

    await database.insert(lessonProgress).values({
      lessonId,
      status: "completed",
      startedAt: nowIso,
      completedAt: nowIso,
      lastOpenedAt: nowIso
    });

    return {
      completedNow: true,
      previousStatus: "not_started" as const,
      status: "completed" as const
    };
  }

  if (!completed && existing.status === "not_started") {
    return {
      completedNow: false,
      previousStatus: existing.status,
      status: existing.status
    };
  }

  await database
    .update(lessonProgress)
    .set({
      status: completed ? "completed" : "in_progress",
      startedAt:
        completed || existing.status !== "not_started"
          ? (existing.startedAt ?? nowIso)
          : null,
      completedAt: completed ? nowIso : null,
      lastOpenedAt: nowIso
    })
    .where(eq(lessonProgress.lessonId, lessonId));

  const nextStatus = completed ? "completed" : "in_progress";

  return {
    completedNow: completed && existing.status !== "completed",
    previousStatus: existing.status,
    status: nextStatus
  };
}

export async function setFuriganaMode(
  mode: FuriganaMode,
  database: DatabaseClient = db
) {
  await updateStudySettings(
    {
      furiganaMode: mode
    },
    database
  );
}

function defaultLessonOpenRenderErrorHandler(error: unknown) {
  console.error("Unable to record textbook lesson open.", error);
}

type ExistingLessonOpenRow = NonNullable<
  Awaited<ReturnType<DatabaseClient["query"]["lessonProgress"]["findFirst"]>>
>;

function shouldReuseRecentLessonOpen(
  existing: ExistingLessonOpenRow,
  now: Date
) {
  if (
    existing.status === "not_started" ||
    !existing.startedAt ||
    !existing.lastOpenedAt
  ) {
    return false;
  }

  const lastOpenedAtMs = Date.parse(existing.lastOpenedAt);

  return (
    Number.isFinite(lastOpenedAtMs) &&
    now.getTime() - lastOpenedAtMs < LESSON_OPEN_WRITE_THROTTLE_MS
  );
}

function toLessonOpenState(
  progress: Pick<
    ExistingLessonOpenRow,
    "lastOpenedAt" | "startedAt" | "status"
  >,
  fallbackIso: string
): LessonOpenState {
  return {
    lastOpenedAt: progress.lastOpenedAt ?? fallbackIso,
    startedAt: progress.startedAt ?? fallbackIso,
    status: progress.status === "completed" ? "completed" : "in_progress"
  };
}

import { invalidateLessonCompletionChanged } from "@/features/cache/server/invalidation-policy";
import { getMediaBySlugCachedDefault } from "@/features/cache/server/data-cache";
import { setLessonCompletionWithConsolidation } from "@/features/consolidation/server";
import { consolidationLessonHref } from "@/features/navigation";

export async function setLessonCompletionForAction(input: {
  lessonId: string;
  mediaSlug: string;
  lessonSlug: string;
  completed: boolean;
}) {
  const mediaPromise = getMediaBySlugCachedDefault(input.mediaSlug);
  const completion = await setLessonCompletionWithConsolidation({
    completed: input.completed,
    lessonId: input.lessonId
  });
  const media = await mediaPromise;

  invalidateLessonCompletionChanged({
    mediaId: media?.id
  });

  return {
    consolidationHref:
      input.completed && completion.consolidation.createdCount > 0
        ? consolidationLessonHref(input.mediaSlug, input.lessonSlug)
        : null,
    ok: true as const,
    status: input.completed ? "completed" : "in_progress"
  };
}

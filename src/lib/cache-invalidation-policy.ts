import { revalidatePath } from "next/cache";

import {
  revalidateGlossarySummaryCache,
  revalidateMediaListCache,
  revalidateReviewSummaryCache,
  revalidateSettingsCache,
  revalidateTextbookLessonBodyCache,
  revalidateTextbookTooltipCache,
  updateGlossarySummaryCache,
  updateMediaListCache,
  updateReviewSummaryCache,
  updateSettingsCache
} from "@/lib/data-cache";
import {
  mediaGlossaryHref,
  mediaHref,
  mediaStudyHref,
  mediaTextbookLessonHref,
  mediaTextbookLessonTooltipsHref,
  reviewHref
} from "@/lib/site";

export type ReviewMutationCachePolicy = "review" | "entry-status";

type ImportedContentLesson = {
  lessonSlug: string;
  mediaSlug: string;
};

export function invalidateStudySettingsSaved() {
  revalidateSettingsCache();
}

export function invalidateFuriganaModeChanged() {
  updateSettingsCache();
}

export function invalidateLessonCompletionChanged(input: {
  mediaId?: string | null;
}) {
  updateMediaListCache();
  updateReviewSummaryCache(input.mediaId);
}

export function invalidateReviewMutationCaches(input: {
  mediaId?: string;
  policy: ReviewMutationCachePolicy;
}) {
  updateReviewSummaryCache(input.mediaId);

  if (input.policy !== "entry-status") {
    return;
  }

  updateGlossarySummaryCache();

  if (input.mediaId) {
    updateGlossarySummaryCache(input.mediaId);
  }
}

export function invalidateImportedContentCaches(input: {
  lessons: ImportedContentLesson[];
  mediaIds: string[];
  mediaSlugs: string[];
}) {
  revalidateMediaListCache();
  revalidateGlossarySummaryCache();
  revalidateReviewSummaryCache();

  for (const mediaId of input.mediaIds) {
    revalidateGlossarySummaryCache(mediaId);
    revalidateReviewSummaryCache(mediaId);
  }

  revalidatePath("/");
  revalidatePath("/glossary");
  revalidatePath("/media");
  revalidatePath(reviewHref());

  for (const mediaSlug of input.mediaSlugs) {
    revalidatePath(mediaHref(mediaSlug));
    revalidatePath(mediaGlossaryHref(mediaSlug));
    revalidatePath(mediaStudyHref(mediaSlug, "glossary"));
    revalidatePath(mediaStudyHref(mediaSlug, "progress"));
    revalidatePath(mediaStudyHref(mediaSlug, "review"));
    revalidatePath(mediaStudyHref(mediaSlug, "textbook"));
  }

  for (const lesson of input.lessons) {
    revalidateTextbookLessonBodyCache(lesson);
    revalidateTextbookTooltipCache(lesson);
    revalidatePath(
      mediaTextbookLessonHref(lesson.mediaSlug, lesson.lessonSlug)
    );
    revalidatePath(
      mediaTextbookLessonTooltipsHref(lesson.mediaSlug, lesson.lessonSlug)
    );
  }
}

export function invalidateKanjiClashManualContrastChanged() {
  try {
    revalidatePath("/kanji-clash");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("static generation store missing")
    ) {
      throw error;
    }
  }
}

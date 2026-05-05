import { revalidatePath } from "next/cache";

import {
  GLOSSARY_SUMMARY_TAG,
  MEDIA_LIST_TAG,
  REVIEW_FIRST_CANDIDATE_TAG,
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  buildTextbookLessonBodyTags,
  buildTextbookTooltipTags,
  revalidateDataCacheTags,
  updateGlossarySummaryCache,
  updateMediaListCache,
  updateReviewSummaryCache,
  updateSettingsCache
} from "@/lib/data-cache";
import {
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
  updateSettingsCache();
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
  revalidateDataCacheTags([
    MEDIA_LIST_TAG,
    REVIEW_FIRST_CANDIDATE_TAG,
    GLOSSARY_SUMMARY_TAG,
    ...buildGlossarySummaryTags(input.mediaIds),
    ...buildReviewSummaryTags(input.mediaIds),
    ...input.lessons.flatMap((lesson) => [
      ...buildTextbookLessonBodyTags(lesson),
      ...buildTextbookTooltipTags(lesson)
    ])
  ]);

  revalidatePath("/");
  revalidatePath("/glossary");
  revalidatePath("/media");
  revalidatePath(reviewHref());

  for (const mediaSlug of input.mediaSlugs) {
    revalidatePath(mediaHref(mediaSlug));
    revalidatePath(mediaStudyHref(mediaSlug, "progress"));
    revalidatePath(mediaStudyHref(mediaSlug, "review"));
    revalidatePath(mediaStudyHref(mediaSlug, "textbook"));
  }

  for (const lesson of input.lessons) {
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

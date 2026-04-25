import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePathMock, revalidateTagMock, updateTagMock } = vi.hoisted(
  () => ({
    revalidatePathMock: vi.fn(),
    revalidateTagMock: vi.fn(),
    updateTagMock: vi.fn()
  })
);

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
  updateTag: updateTagMock,
  unstable_cache: vi.fn()
}));

import {
  invalidateFuriganaModeChanged,
  invalidateImportedContentCaches,
  invalidateKanjiClashManualContrastChanged,
  invalidateLessonCompletionChanged,
  invalidateReviewMutationCaches,
  invalidateStudySettingsSaved
} from "@/lib/cache-invalidation-policy";
import {
  GLOSSARY_SUMMARY_TAG,
  MEDIA_LIST_TAG,
  REVIEW_FIRST_CANDIDATE_TAG,
  REVIEW_SUMMARY_TAG,
  SETTINGS_TAG,
  TEXTBOOK_LESSON_BODY_TAG,
  TEXTBOOK_TOOLTIP_TAG
} from "@/lib/data-cache";

describe("cache invalidation policy", () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    updateTagMock.mockReset();
  });

  it("revalidates settings caches after the settings form saves", () => {
    invalidateStudySettingsSaved();

    expect(revalidateTagMock.mock.calls).toEqual([
      [SETTINGS_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"]
    ]);
    expect(updateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("updates settings caches immediately after furigana mode changes", () => {
    invalidateFuriganaModeChanged();

    expect(updateTagMock.mock.calls).toEqual([
      [SETTINGS_TAG],
      [REVIEW_FIRST_CANDIDATE_TAG]
    ]);
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("updates media and review caches after lesson completion changes", () => {
    invalidateLessonCompletionChanged({ mediaId: "media_dm" });

    expect(updateTagMock.mock.calls).toEqual([
      [MEDIA_LIST_TAG],
      [REVIEW_FIRST_CANDIDATE_TAG],
      [REVIEW_SUMMARY_TAG],
      [REVIEW_FIRST_CANDIDATE_TAG],
      [`${REVIEW_SUMMARY_TAG}:media_dm`]
    ]);
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("updates review caches for review-only mutations", () => {
    invalidateReviewMutationCaches({
      mediaId: "media_dm",
      policy: "review"
    });

    expect(updateTagMock.mock.calls).toEqual([
      [REVIEW_SUMMARY_TAG],
      [REVIEW_FIRST_CANDIDATE_TAG],
      [`${REVIEW_SUMMARY_TAG}:media_dm`]
    ]);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("updates review and glossary caches for entry-status mutations", () => {
    invalidateReviewMutationCaches({
      mediaId: "media_dm",
      policy: "entry-status"
    });

    expect(updateTagMock.mock.calls).toEqual([
      [REVIEW_SUMMARY_TAG],
      [REVIEW_FIRST_CANDIDATE_TAG],
      [`${REVIEW_SUMMARY_TAG}:media_dm`],
      [REVIEW_FIRST_CANDIDATE_TAG],
      [GLOSSARY_SUMMARY_TAG],
      [REVIEW_FIRST_CANDIDATE_TAG],
      [`${GLOSSARY_SUMMARY_TAG}:media_dm`]
    ]);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("revalidates the current imported-content tags and paths", () => {
    invalidateImportedContentCaches({
      lessons: [
        { lessonSlug: "lesson-1", mediaSlug: "duel-masters" },
        { lessonSlug: "lesson-2", mediaSlug: "persona" }
      ],
      mediaIds: ["media_dm", "media_p5"],
      mediaSlugs: ["duel-masters", "persona"]
    });

    expect(revalidateTagMock.mock.calls).toEqual([
      [MEDIA_LIST_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [GLOSSARY_SUMMARY_TAG, "max"],
      [REVIEW_SUMMARY_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [`${GLOSSARY_SUMMARY_TAG}:media_dm`, "max"],
      [REVIEW_SUMMARY_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [`${REVIEW_SUMMARY_TAG}:media_dm`, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [`${GLOSSARY_SUMMARY_TAG}:media_p5`, "max"],
      [REVIEW_SUMMARY_TAG, "max"],
      [REVIEW_FIRST_CANDIDATE_TAG, "max"],
      [`${REVIEW_SUMMARY_TAG}:media_p5`, "max"],
      [TEXTBOOK_LESSON_BODY_TAG, "max"],
      [`${TEXTBOOK_LESSON_BODY_TAG}:duel-masters`, "max"],
      [`${TEXTBOOK_LESSON_BODY_TAG}:duel-masters:lesson-1`, "max"],
      [TEXTBOOK_TOOLTIP_TAG, "max"],
      [`${TEXTBOOK_TOOLTIP_TAG}:duel-masters`, "max"],
      [`${TEXTBOOK_TOOLTIP_TAG}:duel-masters:lesson-1`, "max"],
      [TEXTBOOK_LESSON_BODY_TAG, "max"],
      [`${TEXTBOOK_LESSON_BODY_TAG}:persona`, "max"],
      [`${TEXTBOOK_LESSON_BODY_TAG}:persona:lesson-2`, "max"],
      [TEXTBOOK_TOOLTIP_TAG, "max"],
      [`${TEXTBOOK_TOOLTIP_TAG}:persona`, "max"],
      [`${TEXTBOOK_TOOLTIP_TAG}:persona:lesson-2`, "max"]
    ]);
    expect(revalidatePathMock.mock.calls).toEqual([
      ["/"],
      ["/glossary"],
      ["/media"],
      ["/review"],
      ["/media/duel-masters"],
      ["/glossary?media=duel-masters"],
      ["/media/duel-masters/progress"],
      ["/media/duel-masters/review"],
      ["/media/duel-masters/textbook"],
      ["/media/persona"],
      ["/glossary?media=persona"],
      ["/media/persona/progress"],
      ["/media/persona/review"],
      ["/media/persona/textbook"],
      ["/media/duel-masters/textbook/lesson-1"],
      ["/media/duel-masters/textbook/lesson-1/tooltips"],
      ["/media/persona/textbook/lesson-2"],
      ["/media/persona/textbook/lesson-2/tooltips"]
    ]);
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("safely revalidates Kanji Clash manual contrast pages", () => {
    invalidateKanjiClashManualContrastChanged();

    expect(revalidatePathMock).toHaveBeenCalledWith("/kanji-clash");
  });

  it("ignores the static generation store miss for Kanji Clash path revalidation", () => {
    revalidatePathMock.mockImplementationOnce(() => {
      throw new Error("Invariant: static generation store missing");
    });

    expect(() => invalidateKanjiClashManualContrastChanged()).not.toThrow();
  });

  it("rethrows unexpected Kanji Clash path revalidation failures", () => {
    revalidatePathMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    expect(() => invalidateKanjiClashManualContrastChanged()).toThrow("boom");
  });
});

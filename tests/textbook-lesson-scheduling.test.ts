import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("textbook lesson query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("next/cache");
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/features/settings/server");
  });

  it("returns null on a missing media slug without waiting for furigana settings", async () => {
    const schedule = createQuerySchedulingHarness();
    const mediaGate = schedule.gate<null>("media");
    const furiganaGate = schedule.gate<"hover">("furigana");
    const noStoreMock = vi.fn();

    vi.doMock("next/cache", () => ({
      unstable_noStore: noStoreMock
    }));
    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      getLessonAstBySlug: vi.fn(),
      getLessonIdBySlug: vi.fn(),
      listLessonEntryLinks: vi.fn(),
      listLessonsByMediaId: vi.fn()
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildTextbookLessonBodyTags: vi.fn(() => []),
      buildTextbookTooltipTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => true),
      getMediaBySlugCached: vi.fn(mediaGate.loader()),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/features/settings/server", () => ({
      getFuriganaModeSetting: vi.fn(furiganaGate.loader())
    }));

    const { getTextbookLessonData } =
      await import("@/features/textbook/server");
    let resolved = false;
    const lessonDataPromise = getTextbookLessonData(
      "missing-media",
      "missing-lesson"
    ).then((result) => {
      resolved = true;
      return result;
    });

    await schedule.expectStarted("media", "furigana");
    mediaGate.resolve(null);

    try {
      await schedule.expectResolvesWhileBlocked(
        lessonDataPromise,
        "furigana",
        "Expected missing lesson media lookup to resolve immediately."
      );
      expect(resolved).toBe(true);
      await expect(lessonDataPromise).resolves.toBeNull();
      expect(noStoreMock).toHaveBeenCalledTimes(1);
    } finally {
      await schedule.releaseAll();
    }
  });
});

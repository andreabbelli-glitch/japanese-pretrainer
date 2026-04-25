import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForTruthy(
  predicate: () => boolean,
  message: string,
  attempts = 50
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(message);
}

describe("textbook lesson query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("next/cache");
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/settings");
  });

  it("returns null on a missing media slug without waiting for furigana settings", async () => {
    const mediaDeferred = createDeferred<null>();
    const furiganaDeferred = createDeferred<"hover">();
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
      getMediaBySlugCached: vi.fn(() => mediaDeferred.promise),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/settings", () => ({
      getFuriganaModeSetting: vi.fn(() => furiganaDeferred.promise)
    }));

    const { getTextbookLessonData } = await import("@/lib/textbook");
    let resolved = false;
    const lessonDataPromise = getTextbookLessonData(
      "missing-media",
      "missing-lesson"
    ).then((result) => {
      resolved = true;
      return result;
    });

    await flushMicrotasks();
    mediaDeferred.resolve(null);

    try {
      await waitForTruthy(
        () => resolved,
        "Expected missing lesson media lookup to resolve immediately."
      );
      await expect(lessonDataPromise).resolves.toBeNull();
      expect(noStoreMock).toHaveBeenCalledTimes(1);
    } finally {
      furiganaDeferred.resolve("hover");
      await lessonDataPromise;
    }
  });
});

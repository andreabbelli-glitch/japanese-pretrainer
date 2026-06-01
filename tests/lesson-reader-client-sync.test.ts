import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMinimalDom,
  type MinimalDomElement,
  uninstallMinimalDom
} from "./helpers/minimal-dom";
import { createDeferred, flushMicrotasks } from "./helpers/async";

import type { TextbookLessonData } from "@/features/textbook/types";

const mocks = vi.hoisted(() => ({
  latestToggleLessonCompletion: null as null | (() => void),
  recordLessonOpenedAction: vi.fn(),
  routerPush: vi.fn(),
  setFuriganaModeAction: vi.fn(),
  setLessonCompletionAction: vi.fn()
}));

vi.mock("@/actions/textbook", () => ({
  recordLessonOpenedAction: mocks.recordLessonOpenedAction,
  setFuriganaModeAction: mocks.setFuriganaModeAction,
  setLessonCompletionAction: mocks.setLessonCompletionAction
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush
  })
}));

vi.mock("@/components/textbook/lesson-article", async () => {
  const React = await import("react");

  return {
    EntryTooltipCard: () => React.createElement("div", null, "tooltip"),
    getTooltipEntryKey: (entry: { id: string; kind: string }) =>
      `${entry.kind}:${entry.id}`,
    hasLessonTooltipTargets: () => false,
    LessonArticle: () => React.createElement("div", null, "article")
  };
});

vi.mock("@/components/textbook/lesson-reader-ui", async () => {
  const React = await import("react");

  return {
    LessonReaderFooter: () => React.createElement("div", null, "footer"),
    LessonReaderHeader: (props: {
      lesson: { statusLabel: string; title: string };
      onToggleLessonCompletion: () => void;
    }) => {
      mocks.latestToggleLessonCompletion = props.onToggleLessonCompletion;

      return React.createElement(
        "div",
        null,
        `${props.lesson.title} ${props.lesson.statusLabel}`
      );
    },
    LessonReaderMobileStrip: () =>
      React.createElement("div", null, "mobile-strip"),
    MemoizedLessonRail: () => React.createElement("div", null, "rail"),
    MobileSheet: (props: { children: React.ReactNode }) =>
      React.createElement("div", null, props.children),
    ReaderImageLightbox: () => React.createElement("div", null, "lightbox")
  };
});

import { LessonReaderClient } from "@/components/textbook/lesson-reader-client";

describe("LessonReaderClient prop sync", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.latestToggleLessonCompletion = null;
    mocks.recordLessonOpenedAction.mockReset();
    mocks.routerPush.mockReset();
    mocks.setFuriganaModeAction.mockReset();
    mocks.setLessonCompletionAction.mockReset();
    mocks.recordLessonOpenedAction.mockResolvedValue({
      lastOpenedAt: "2026-04-25T10:00:00.000Z",
      ok: true,
      startedAt: "2026-04-25T10:00:00.000Z",
      status: "in_progress"
    });
    mocks.setLessonCompletionAction.mockResolvedValue({
      consolidationHref: null,
      ok: true,
      status: "completed"
    });
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });

    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("syncs refreshed server data for the current lesson", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Summary before refresh"
          })
        })
      );
    });

    expect(readReaderRoot(container)?.attributes["data-furigana-mode"]).toBe(
      "hover"
    );
    expect(container.textContent).toContain("Summary before refresh");

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "off",
            status: "completed",
            statusLabel: "Completata",
            summary: "Summary after refresh"
          })
        })
      );
    });

    expect(readReaderRoot(container)?.attributes["data-furigana-mode"]).toBe(
      "off"
    );
    expect(container.textContent).toContain("Summary after refresh");
    expect(container.textContent).not.toContain("Summary before refresh");
  });

  it("records the opened lesson from the client after mounting", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Summary before open"
          })
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(1);
    expect(mocks.recordLessonOpenedAction).toHaveBeenCalledWith({
      lessonId: "lesson-001"
    });
    expect(container.textContent).toContain("In corso");
  });

  it("records a lesson again after returning beyond the client throttle window", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-25T10:00:00.000Z"));

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "First lesson",
              title: "Intro"
            })
          })
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              lessonId: "lesson-002",
              lessonSlug: "second",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "Second lesson",
              title: "Second"
            })
          })
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      vi.setSystemTime(new Date("2026-04-25T10:11:00.000Z"));

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "First lesson again",
              title: "Intro"
            })
          })
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(3);
      expect(mocks.recordLessonOpenedAction).toHaveBeenNthCalledWith(1, {
        lessonId: "lesson-001"
      });
      expect(mocks.recordLessonOpenedAction).toHaveBeenNthCalledWith(2, {
        lessonId: "lesson-002"
      });
      expect(mocks.recordLessonOpenedAction).toHaveBeenNthCalledWith(3, {
        lessonId: "lesson-001"
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reuses the remembered open state when returning within the client throttle window", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-25T10:04:00.000Z"));

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "First lesson"
            })
          })
        );
        await flushMicrotasks();
      });

      expect(container.textContent).toContain("In corso");

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              lessonId: "lesson-002",
              lessonSlug: "second",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "Second lesson",
              title: "Second"
            })
          })
        );
        await flushMicrotasks();
      });

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "First lesson stale route data"
            })
          })
        );
        await flushMicrotasks();
      });

      expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain("In corso");
      expect(container.textContent).not.toContain("Da iniziare");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not extend the client throttle beyond the server last opened timestamp", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-25T10:09:00.000Z"));
      mocks.recordLessonOpenedAction
        .mockResolvedValueOnce({
          lastOpenedAt: "2026-04-25T10:00:00.000Z",
          ok: true,
          startedAt: "2026-04-25T09:00:00.000Z",
          status: "in_progress"
        })
        .mockResolvedValueOnce({
          lastOpenedAt: "2026-04-25T10:09:00.000Z",
          ok: true,
          startedAt: "2026-04-25T10:09:00.000Z",
          status: "in_progress"
        })
        .mockResolvedValueOnce({
          lastOpenedAt: "2026-04-25T10:18:00.000Z",
          ok: true,
          startedAt: "2026-04-25T09:00:00.000Z",
          status: "in_progress"
        });

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "First lesson"
            })
          })
        );
        await flushMicrotasks();
      });

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              lessonId: "lesson-002",
              lessonSlug: "second",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "Second lesson",
              title: "Second"
            })
          })
        );
        await flushMicrotasks();
      });

      vi.setSystemTime(new Date("2026-04-25T10:18:00.000Z"));

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "First lesson again"
            })
          })
        );
        await flushMicrotasks();
      });

      expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(3);
      expect(mocks.recordLessonOpenedAction).toHaveBeenNthCalledWith(3, {
        lessonId: "lesson-001"
      });
      expect(container.textContent).toContain("In corso");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reapplies remembered open state after same-lesson stale prop refresh", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date("2026-04-25T10:04:00.000Z"));

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "Summary before open"
            })
          })
        );
        await flushMicrotasks();
      });

      expect(container.textContent).toContain("In corso");

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "Stale same-lesson refresh"
            })
          })
        );
        await flushMicrotasks();
      });

      expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("In corso");
      expect(container.textContent).not.toContain("Da iniziare");
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the in-flight open request when returning within the client throttle window", async () => {
    container = document.createElement("div");
    root = createRoot(container);
    const firstLessonOpen = createDeferred<{
      lastOpenedAt: string;
      ok: true;
      startedAt: string;
      status: "in_progress";
    }>();

    mocks.recordLessonOpenedAction.mockReturnValueOnce(firstLessonOpen.promise);

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "First lesson pending"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            lessonId: "lesson-002",
            lessonSlug: "second",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Second lesson",
            title: "Second"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "First lesson stale route data"
          })
        })
      );
      await flushMicrotasks();
    });

    expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstLessonOpen.resolve({
        lastOpenedAt: "2026-04-25T10:00:00.000Z",
        ok: true,
        startedAt: "2026-04-25T10:00:00.000Z",
        status: "in_progress"
      });
      await flushMicrotasks();
    });

    expect(container.textContent).toContain("In corso");
    expect(container.textContent).not.toContain("Da iniziare");
  });

  it("invalidates remembered completed open state when reopening a lesson", async () => {
    container = document.createElement("div");
    root = createRoot(container);
    mocks.recordLessonOpenedAction
      .mockResolvedValueOnce({
        lastOpenedAt: "2026-04-25T10:00:00.000Z",
        ok: true,
        startedAt: "2026-04-25T09:00:00.000Z",
        status: "completed"
      })
      .mockResolvedValueOnce({
        lastOpenedAt: "2026-04-25T10:01:00.000Z",
        ok: true,
        startedAt: "2026-04-25T10:01:00.000Z",
        status: "in_progress"
      })
      .mockResolvedValueOnce({
        lastOpenedAt: "2026-04-25T10:02:00.000Z",
        ok: true,
        startedAt: "2026-04-25T09:00:00.000Z",
        status: "in_progress"
      });
    mocks.setLessonCompletionAction.mockResolvedValueOnce({
      consolidationHref: null,
      ok: true,
      status: "in_progress"
    });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "completed",
            statusLabel: "Completata",
            summary: "Completed lesson"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      mocks.latestToggleLessonCompletion?.();
      await flushMicrotasks();
    });

    expect(container.textContent).toContain("In corso");

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            lessonId: "lesson-002",
            lessonSlug: "second",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Second lesson",
            title: "Second"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "in_progress",
            statusLabel: "In corso",
            summary: "Reopened lesson"
          })
        })
      );
      await flushMicrotasks();
    });

    expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain("In corso");
    expect(container.textContent).not.toContain("Completata");
  });

  it("invalidates remembered in-progress open state when completing a lesson", async () => {
    container = document.createElement("div");
    root = createRoot(container);
    mocks.recordLessonOpenedAction
      .mockResolvedValueOnce({
        lastOpenedAt: "2026-04-25T10:00:00.000Z",
        ok: true,
        startedAt: "2026-04-25T10:00:00.000Z",
        status: "in_progress"
      })
      .mockResolvedValueOnce({
        lastOpenedAt: "2026-04-25T10:01:00.000Z",
        ok: true,
        startedAt: "2026-04-25T10:01:00.000Z",
        status: "in_progress"
      })
      .mockResolvedValueOnce({
        lastOpenedAt: "2026-04-25T10:02:00.000Z",
        ok: true,
        startedAt: "2026-04-25T10:00:00.000Z",
        status: "completed"
      });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Lesson before completion"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      mocks.latestToggleLessonCompletion?.();
      await flushMicrotasks();
    });

    expect(container.textContent).toContain("Completata");

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            lessonId: "lesson-002",
            lessonSlug: "second",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Second lesson",
            title: "Second"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "in_progress",
            statusLabel: "In corso",
            summary: "Stale route data after completion"
          })
        })
      );
      await flushMicrotasks();
    });

    expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain("Completata");
    expect(container.textContent).not.toContain("In corso");
  });

  it("does not let a stale opened lesson response override a completion toggle", async () => {
    container = document.createElement("div");
    root = createRoot(container);
    const openedState = createDeferred<{
      lastOpenedAt: string;
      ok: true;
      startedAt: string;
      status: "in_progress";
    }>();

    mocks.recordLessonOpenedAction.mockReturnValueOnce(openedState.promise);

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Summary before completion"
          })
        })
      );
      await flushMicrotasks();
    });

    await act(async () => {
      mocks.latestToggleLessonCompletion?.();
      await flushMicrotasks();
    });

    expect(container.textContent).toContain("Completata");

    await act(async () => {
      openedState.resolve({
        lastOpenedAt: "2026-04-25T10:00:00.000Z",
        ok: true,
        startedAt: "2026-04-25T10:00:00.000Z",
        status: "in_progress"
      });
      await flushMicrotasks();
    });

    expect(container.textContent).toContain("Completata");
    expect(container.textContent).not.toContain("In corso");
  });

  it("retries opening the current lesson after a failed open action", async () => {
    container = document.createElement("div");
    root = createRoot(container);

    vi.useFakeTimers();

    try {
      mocks.recordLessonOpenedAction
        .mockRejectedValueOnce(new Error("temporary write failure"))
        .mockResolvedValueOnce({
          lastOpenedAt: "2026-04-25T10:00:30.000Z",
          ok: true,
          startedAt: "2026-04-25T10:00:30.000Z",
          status: "in_progress"
        });

      await act(async () => {
        root!.render(
          createElement(LessonReaderClient, {
            data: buildLessonData({
              furiganaMode: "hover",
              status: "not_started",
              statusLabel: "Da iniziare",
              summary: "Summary before retry"
            })
          })
        );
        await flushMicrotasks();
      });

      expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
        await flushMicrotasks();
      });

      expect(mocks.recordLessonOpenedAction).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain("In corso");
    } finally {
      vi.useRealTimers();
    }
  });

  it("navigates to consolidation after a newly completed lesson creates pending subjects", async () => {
    container = document.createElement("div");
    root = createRoot(container);
    mocks.setLessonCompletionAction.mockResolvedValueOnce({
      consolidationHref: "/consolidation/media/sample-media/lesson/intro",
      ok: true,
      status: "completed"
    });

    await act(async () => {
      root!.render(
        createElement(LessonReaderClient, {
          data: buildLessonData({
            furiganaMode: "hover",
            status: "not_started",
            statusLabel: "Da iniziare",
            summary: "Summary before completion"
          })
        })
      );
    });

    await act(async () => {
      mocks.latestToggleLessonCompletion?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.setLessonCompletionAction).toHaveBeenCalledWith({
      completed: true,
      lessonId: "lesson-001",
      lessonSlug: "intro",
      mediaSlug: "sample-media"
    });
    expect(mocks.routerPush).toHaveBeenCalledWith(
      "/consolidation/media/sample-media/lesson/intro"
    );
  });
});

function readReaderRoot(container: HTMLDivElement | null) {
  return (container?.firstChild as MinimalDomElement | null) ?? null;
}

function buildLessonData(
  input: Pick<TextbookLessonData, "furiganaMode"> & {
    lessonId?: string;
    lessonSlug?: string;
    status: TextbookLessonData["lesson"]["status"];
    statusLabel: string;
    summary: string;
    title?: string;
  }
): TextbookLessonData {
  const lessonId = input.lessonId ?? "lesson-001";
  const lessonSlug = input.lessonSlug ?? "intro";
  const title = input.title ?? "Intro";
  const lesson = {
    completedAt:
      input.status === "completed" ? "2026-04-10T10:00:00.000Z" : null,
    difficulty: null,
    excerpt: null,
    id: lessonId,
    lastOpenedAt: null,
    orderIndex: 1,
    segmentId: "segment-001",
    segmentTitle: "Segment 1",
    slug: lessonSlug,
    status: input.status,
    statusLabel: input.statusLabel,
    summary: input.summary,
    title
  };

  return {
    activeLesson: lesson,
    completedLessons: input.status === "completed" ? 1 : 0,
    entries: [],
    furiganaMode: input.furiganaMode,
    glossaryHref: "/" as never,
    groups: [
      {
        completedLessons: input.status === "completed" ? 1 : 0,
        id: "segment-001",
        lessons: [lesson],
        note: null,
        title: "Segment 1",
        totalLessons: 1
      }
    ],
    lesson: {
      ast: null,
      completedAt: lesson.completedAt,
      difficulty: lesson.difficulty,
      excerpt: lesson.excerpt,
      id: lesson.id,
      segmentTitle: lesson.segmentTitle,
      slug: lesson.slug,
      status: lesson.status,
      statusLabel: lesson.statusLabel,
      summary: lesson.summary,
      title: lesson.title
    },
    lessons: [lesson],
    media: {
      description: "Sample media",
      id: "media-001",
      mediaTypeLabel: "Anime",
      segmentKindLabel: "episodi",
      slug: "sample-media",
      title: "Sample media"
    },
    nextLesson: null,
    previousLesson: null,
    resumeLesson: lesson,
    textbookProgressPercent: input.status === "completed" ? 100 : 0,
    totalLessons: 1
  };
}

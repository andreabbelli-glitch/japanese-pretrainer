import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMinimalDom,
  type MinimalDomElement,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

import type { TextbookLessonData } from "@/lib/textbook-types";

const mocks = vi.hoisted(() => ({
  setFuriganaModeAction: vi.fn(),
  setLessonCompletionAction: vi.fn()
}));

vi.mock("@/actions/textbook", () => ({
  setFuriganaModeAction: mocks.setFuriganaModeAction,
  setLessonCompletionAction: mocks.setLessonCompletionAction
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
    LessonReaderHeader: (props: { lesson: { title: string } }) =>
      React.createElement("div", null, props.lesson.title),
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
    mocks.setFuriganaModeAction.mockReset();
    mocks.setLessonCompletionAction.mockReset();
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
});

function readReaderRoot(container: HTMLDivElement | null) {
  return (container?.firstChild as MinimalDomElement | null) ?? null;
}

function buildLessonData(
  input: Pick<TextbookLessonData, "furiganaMode"> & {
    status: TextbookLessonData["lesson"]["status"];
    statusLabel: string;
    summary: string;
  }
): TextbookLessonData {
  const lesson = {
    completedAt:
      input.status === "completed" ? "2026-04-10T10:00:00.000Z" : null,
    difficulty: null,
    excerpt: null,
    id: "lesson-001",
    lastOpenedAt: null,
    orderIndex: 1,
    segmentId: "segment-001",
    segmentTitle: "Segment 1",
    slug: "intro",
    status: input.status,
    statusLabel: input.statusLabel,
    summary: input.summary,
    title: "Intro"
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

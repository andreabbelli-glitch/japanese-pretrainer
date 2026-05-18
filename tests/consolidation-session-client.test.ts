import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMinimalDom,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

import type { ConsolidationSessionData } from "@/lib/consolidation";

const mocks = vi.hoisted(() => ({
  markConsolidationKnownAction: vi.fn(),
  submitConsolidationAnswerAction: vi.fn()
}));

vi.mock("@/actions/consolidation", () => ({
  markConsolidationKnownAction: mocks.markConsolidationKnownAction,
  submitConsolidationAnswerAction: mocks.submitConsolidationAnswerAction
}));

vi.mock("next/link", async () => {
  const React = await import("react");

  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
    }) => React.createElement("a", { ...props, href }, children)
  };
});

import { ConsolidationSessionClient } from "@/components/consolidation/consolidation-session-client";

describe("ConsolidationSessionClient", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    installMinimalDom();
    mocks.markConsolidationKnownAction.mockReset();
    mocks.submitConsolidationAnswerAction.mockReset();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    uninstallMinimalDom();
    vi.useRealTimers();
    container = null;
    root = null;
  });

  it("does not render option text during the 2 second retrieval phase", async () => {
    await act(async () => {
      root!.render(createElement(ConsolidationSessionClient, { data: buildData() }));
    });

    expect(container?.textContent).toContain("読む");
    expect(container?.textContent).not.toContain("よむ");
    expect(container?.textContent).not.toContain("かく");
    expect(container?.textContent).not.toContain("leggere");

    await act(async () => {
      vi.advanceTimersByTime(1999);
      await Promise.resolve();
    });

    expect(container?.textContent).not.toContain("よむ");
    expect(container?.textContent).not.toContain("かく");

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("よむ");
    expect(container?.textContent).toContain("かく");
  });

  it("renders the review CTA when the consolidation session is empty", async () => {
    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, {
          data: {
            ...buildData(),
            subjects: [],
            totalPending: 0
          }
        })
      );
    });

    expect(container?.textContent).toContain("Vai alla review");
  });
});

function buildData(): ConsolidationSessionData {
  return {
    hubHref: "/consolidation" as never,
    lesson: {
      id: "lesson-001",
      slug: "intro",
      title: "Intro"
    },
    media: {
      id: "media-001",
      slug: "sample-media",
      title: "Sample Media"
    },
    reviewHref: "/review" as never,
    subjects: [
      {
        attemptCount: 0,
        back: "leggere",
        front: "{{読|よ}}む",
        representativeCardId: "card-001",
        subjectKey: "entry:term:term-yomu",
        steps: [
          {
            answerLabel: "よむ",
            options: [
              {
                kind: "term",
                label: "よむ",
                subjectKey: "entry:term:term-yomu"
              },
              {
                kind: "term",
                label: "かく",
                subjectKey: "entry:term:term-kaku"
              }
            ],
            step: "reading"
          },
          {
            answerLabel: "leggere",
            options: [
              {
                kind: "term",
                label: "leggere",
                subjectKey: "entry:term:term-yomu"
              },
              {
                kind: "term",
                label: "scrivere",
                subjectKey: "entry:term:term-kaku"
              }
            ],
            step: "meaning"
          }
        ]
      }
    ],
    totalPending: 1
  };
}

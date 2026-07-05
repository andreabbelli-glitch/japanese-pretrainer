import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchWindowKeyboardEvent,
  installMinimalDom,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

import type { ConsolidationSessionData } from "@/features/consolidation/server";

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

vi.mock("@/components/ui/pitch-accent-notation", async () => {
  const React = await import("react");

  return {
    PitchAccentNotation: ({
      pitchAccent
    }: {
      pitchAccent: { downstep: number; morae: string[] };
    }) =>
      React.createElement(
        "span",
        {},
        `Pitch ${pitchAccent.morae.join("")} ${pitchAccent.downstep}`
      )
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
      root!.render(
        createElement(ConsolidationSessionClient, { data: buildData() })
      );
    });

    expect(container?.textContent).toContain("読む");
    expect(container?.textContent).not.toContain("Già nota");
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
    expect(container?.textContent).toContain("Già nota");
  });

  it("resets the local queue when rerendered with another lesson session", async () => {
    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, {
          data: buildData(),
          key: "lesson-001"
        })
      );
    });

    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, {
          data: buildData({
            front: "{{見|み}}る",
            lessonId: "lesson-002",
            lessonTitle: "Seconda lezione",
            reading: "みる",
            subjectKey: "entry:term:term-miru"
          }),
          key: "lesson-002"
        })
      );
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("Seconda lezione");
    expect(container?.textContent).toContain("見る");
    expect(container?.textContent).not.toContain("読む");
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

  it("does not render mark-known for FSRS retraining sessions", async () => {
    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, {
          data: buildData({
            canMarkKnown: false
          })
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(container?.textContent).not.toContain("Già nota");
  });

  it("renders number key hints next to visible answer options", async () => {
    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, { data: buildData() })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("1よむ");
    expect(container?.textContent).toContain("2かく");
  });

  it("renders pitch accent notation beside visible hiragana reading options", async () => {
    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, {
          data: buildData({
            distractorPitchAccentDownstep: 0,
            pitchAccentDownstep: 1
          })
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(container?.textContent).toContain("Pitch よむ 1");
    expect(container?.textContent).toContain("Pitch かく 0");
  });

  it("submits visible answers with number keys during the answering phase", async () => {
    mocks.submitConsolidationAnswerAction.mockResolvedValue({
      attemptCount: 1,
      completed: false,
      correct: false,
      nextStep: "reading",
      reinsertionIndex: 0,
      subjectKey: "entry:term:term-yomu"
    });

    await act(async () => {
      root!.render(
        createElement(ConsolidationSessionClient, { data: buildData() })
      );
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(mocks.submitConsolidationAnswerAction).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(mocks.submitConsolidationAnswerAction).toHaveBeenCalledWith({
      selectedSubjectKey: "entry:term:term-kaku",
      step: "reading",
      subjectKey: "entry:term:term-yomu"
    });
  });
});

function buildData(
  overrides: {
    canMarkKnown?: boolean;
    distractorPitchAccentDownstep?: number;
    front?: string;
    lessonId?: string;
    lessonTitle?: string;
    pitchAccentDownstep?: number;
    reading?: string;
    subjectKey?: string;
  } = {}
): ConsolidationSessionData {
  const subjectKey = overrides.subjectKey ?? "entry:term:term-yomu";
  const reading = overrides.reading ?? "よむ";

  return {
    hubHref: "/consolidation" as never,
    lesson: {
      id: overrides.lessonId ?? "lesson-001",
      slug: "intro",
      title: overrides.lessonTitle ?? "Intro"
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
        canMarkKnown: overrides.canMarkKnown ?? true,
        front: overrides.front ?? "{{読|よ}}む",
        representativeCardId: "card-001",
        subjectKey,
        steps: [
          {
            answerLabel: reading,
            options: [
              {
                kind: "term",
                label: reading,
                pitchAccent:
                  overrides.pitchAccentDownstep === undefined
                    ? undefined
                    : {
                        downstep: overrides.pitchAccentDownstep,
                        levels:
                          overrides.pitchAccentDownstep === 1
                            ? ["high", "low"]
                            : ["low", "high"],
                        morae: [...reading],
                        shape:
                          overrides.pitchAccentDownstep === 0
                            ? "heiban"
                            : "atamadaka",
                        trailingLevel:
                          overrides.pitchAccentDownstep === 0 ? "high" : "low"
                      },
                subjectKey
              },
              {
                kind: "term",
                label: "かく",
                pitchAccent:
                  overrides.distractorPitchAccentDownstep === undefined
                    ? undefined
                    : {
                        downstep: overrides.distractorPitchAccentDownstep,
                        levels: ["low", "high"],
                        morae: ["か", "く"],
                        shape: "heiban",
                        trailingLevel: "high"
                      },
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
                subjectKey
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

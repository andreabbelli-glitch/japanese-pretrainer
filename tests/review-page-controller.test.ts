import { createElement, act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewPageControllerResult } from "@/components/review/use-review-page-controller";
import type { ReviewPageClientData } from "@/components/review/review-page-state";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/lib/glossary";
import type { ReviewFirstCandidatePageData, ReviewQueueCard } from "@/lib/review-types";

const mocks = vi.hoisted(() => ({
  gradeReviewCardSessionAction: vi.fn(),
  loadReviewPageDataSessionAction: vi.fn(),
  markLinkedEntryKnownSessionAction: vi.fn(),
  prefetchReviewCardSessionAction: vi.fn(),
  resetReviewCardSessionAction: vi.fn(),
  setLinkedEntryLearningSessionAction: vi.fn(),
  setReviewCardSuspendedSessionAction: vi.fn(),
  useGlossaryAutocomplete: vi.fn(),
  useSearchParams: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.useSearchParams()
}));

vi.mock("@/actions/review", () => ({
  gradeReviewCardSessionAction: mocks.gradeReviewCardSessionAction,
  loadReviewPageDataSessionAction: mocks.loadReviewPageDataSessionAction,
  markLinkedEntryKnownSessionAction: mocks.markLinkedEntryKnownSessionAction,
  prefetchReviewCardSessionAction: mocks.prefetchReviewCardSessionAction,
  resetReviewCardSessionAction: mocks.resetReviewCardSessionAction,
  setLinkedEntryLearningSessionAction: mocks.setLinkedEntryLearningSessionAction,
  setReviewCardSuspendedSessionAction: mocks.setReviewCardSuspendedSessionAction
}));

vi.mock("@/components/glossary/use-glossary-autocomplete", () => ({
  useGlossaryAutocomplete: (input: unknown) => mocks.useGlossaryAutocomplete(input)
}));

import { useReviewPageController } from "@/components/review/use-review-page-controller";

const contrastSuggestion: GlobalGlossaryAutocompleteSuggestion = {
  aliases: [],
  hasCards: true,
  hasCardlessVariant: false,
  kind: "term",
  label: "コスト",
  localHits: [
    {
      hasCards: true,
      mediaSlug: "duel-masters-dm25",
      studyKey: "review"
    }
  ],
  meaning: "costo",
  mediaCount: 1,
  reading: "こすと",
  resultKey: "term:entry:cost",
  romaji: "kosuto"
};

describe("useReviewPageController first-candidate grading", () => {
  const emptySearchParams = {
    getAll: () => [],
    keys: function* () {
      yield* [];
    },
    size: 0
  };

  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.useSearchParams.mockReturnValue(emptySearchParams);
    mocks.gradeReviewCardSessionAction.mockReset();
    mocks.loadReviewPageDataSessionAction.mockReset();
    mocks.markLinkedEntryKnownSessionAction.mockReset();
    mocks.prefetchReviewCardSessionAction.mockReset();
    mocks.resetReviewCardSessionAction.mockReset();
    mocks.setLinkedEntryLearningSessionAction.mockReset();
    mocks.setReviewCardSuspendedSessionAction.mockReset();
    mocks.useGlossaryAutocomplete.mockImplementation(
      ({ isOpen, query }: { isOpen: boolean; query: string }) => ({
        listboxId: "review-contrast-listbox",
        shouldShowSuggestions: isOpen && query.trim().length > 0,
        suggestions: query.trim().length > 0 ? [contrastSuggestion] : [],
        suggestionsKey: query.trim()
      })
    );
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

  it("keeps the first-candidate grading path optimistic while full hydration is pending", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Intentionally left pending to keep the hydration window open.
        })
    );
    mocks.gradeReviewCardSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Intentionally left pending so the test can inspect the optimistic state.
        })
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    const data = buildFirstCandidateReviewPageData();

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data,
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledTimes(1);
    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledWith({
      scope: "global",
      searchParams: {
        answered: "0",
        card: "card-a"
      }
    });
    expect(mocks.prefetchReviewCardSessionAction).not.toHaveBeenCalled();

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    expect(controller().isFullReviewPageData).toBe(false);
    expect(controller().isHydratingFullData).toBe(true);
    expect(controller().isAnswerRevealed).toBe(false);

    act(() => {
      controller().handleRevealAnswer();
    });

    expect(controller().isAnswerRevealed).toBe(true);
    expect((controller().viewData as ReviewFirstCandidatePageData).selectedCardContext.showAnswer).toBe(true);

    act(() => {
      controller().handleGradeCard("good");
    });

    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledTimes(1);
    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        answeredCount: 0,
        cardId: "card-a",
        cardMediaSlug: "duel-masters-dm25",
        candidateCardIds: ["card-b", "card-c"],
        canonicalCandidateCardIds: ["card-b", "card-c"],
        extraNewCount: 0,
        expectedUpdatedAt: "2026-04-02T11:00:00.000Z",
        gradedCardBucket: "due",
        gradedCardIds: ["card-a"],
        mediaSlug: undefined,
        nextCardId: "card-b",
        rating: "good",
        scope: "global",
        segmentId: null,
        sessionQueue: undefined,
        sessionSettings: undefined
      })
    );

    expect(controller().isFullReviewPageData).toBe(false);
    expect(controller().isHydratingFullData).toBe(true);
    expect(controller().isAnswerRevealed).toBe(false);
    expect(controller().viewData.selectedCard?.id).toBe("card-b");
    expect((controller().viewData as ReviewFirstCandidatePageData).nextCardId).toBe("card-c");
    expect(controller().viewData.session.answeredCount).toBe(1);
    expect(controller().viewData.selectedCardContext.position).toBe(1);
    expect(controller().viewData.selectedCardContext.remainingCount).toBe(1);
  });

  it("passes the selected forced contrast payload and disables optimistic advance", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep hydration pending while inspecting client state.
        })
    );
    mocks.gradeReviewCardSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Intentionally left pending.
        })
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data: buildFirstCandidateReviewPageData(),
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      controller().handleRevealAnswer();
    });
    act(() => {
      controller().handleOpenForcedContrast();
    });
    act(() => {
      controller().handleForcedContrastQueryChange("kosuto");
    });
    act(() => {
      controller().handleForcedContrastSelect(contrastSuggestion);
    });
    act(() => {
      controller().handleGradeCard("good");
    });

    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledTimes(1);
    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: "2026-04-02T11:00:00.000Z",
        forcedKanjiClashContrast: {
          source: "review-grading",
          targetLabel: "コスト",
          targetResultKey: "term:entry:cost"
        }
      })
    );
    expect(controller().forcedContrastSelection?.resultKey).toBe(
      "term:entry:cost"
    );
    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().viewData.session.answeredCount).toBe(0);
  });

  it("keeps the grade button single-flight while a submission is in progress", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep hydration pending while the submission lock is exercised.
        })
    );
    mocks.gradeReviewCardSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep the first submission in flight.
        })
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data: buildFirstCandidateReviewPageData(),
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      controller().handleRevealAnswer();
      controller().handleGradeCard("good");
      controller().handleGradeCard("easy");
    });

    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledTimes(1);
    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: "2026-04-02T11:00:00.000Z",
        rating: "good"
      })
    );
  });

  it("surfaces allowlisted forced contrast validation errors without advancing the card", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep hydration pending while inspecting client state.
        })
    );
    mocks.gradeReviewCardSessionAction.mockRejectedValue(
      new Error("Il contrasto selezionato non è più disponibile.")
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data: buildFirstCandidateReviewPageData(),
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      controller().handleRevealAnswer();
    });
    act(() => {
      controller().handleOpenForcedContrast();
    });
    act(() => {
      controller().handleForcedContrastQueryChange("kosuto");
    });
    act(() => {
      controller().handleForcedContrastSelect(contrastSuggestion);
    });

    await act(async () => {
      controller().handleGradeCard("good");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(controller().clientError).toBe(
      "Il contrasto selezionato non è più disponibile."
    );
    expect(controller().forcedContrastSelection?.resultKey).toBe(
      "term:entry:cost"
    );
    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().viewData.session.answeredCount).toBe(0);
  });

  it("keeps non-allowlisted forced contrast failures generic", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep hydration pending while inspecting client state.
        })
    );
    mocks.gradeReviewCardSessionAction.mockRejectedValue(
      new Error("Forced contrast persistence failed.")
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data: buildFirstCandidateReviewPageData(),
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      controller().handleRevealAnswer();
    });
    act(() => {
      controller().handleOpenForcedContrast();
    });
    act(() => {
      controller().handleForcedContrastQueryChange("kosuto");
    });
    act(() => {
      controller().handleForcedContrastSelect(contrastSuggestion);
    });

    await act(async () => {
      controller().handleGradeCard("good");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(controller().clientError).toBe(
      "Non sono riuscito ad aggiornare la review. Riprova un attimo."
    );
    expect(controller().forcedContrastSelection?.resultKey).toBe(
      "term:entry:cost"
    );
    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().viewData.session.answeredCount).toBe(0);
  });

  it("ignores typed-but-unselected contrast text and preserves optimistic advance", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep hydration pending while inspecting client state.
        })
    );
    mocks.gradeReviewCardSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Intentionally left pending.
        })
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data: buildFirstCandidateReviewPageData(),
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    act(() => {
      controller().handleRevealAnswer();
    });
    act(() => {
      controller().handleOpenForcedContrast();
    });
    act(() => {
      controller().handleForcedContrastQueryChange("kosuto");
    });
    act(() => {
      controller().handleGradeCard("good");
    });

    const actionInput = mocks.gradeReviewCardSessionAction.mock.calls[0]?.[0];

    expect(actionInput).not.toHaveProperty("forcedKanjiClashContrast");
    expect(controller().forcedContrastSelection).toBeNull();
    expect(controller().viewData.selectedCard?.id).toBe("card-b");
    expect(controller().viewData.session.answeredCount).toBe(1);
  });

  it("opens and closes the forced contrast UI with C and Escape after reveal", async () => {
    mocks.loadReviewPageDataSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageClientData>(() => {
          // Keep hydration pending while inspecting keyboard shortcuts.
        })
    );

    let latestController: ReviewPageControllerResult | null = null;

    function Probe(props: {
      data: ReviewPageClientData;
      searchParams?: Record<string, string | string[] | undefined>;
    }) {
      const controller = useReviewPageController(props);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          data: buildFirstCandidateReviewPageData(),
          searchParams: { answered: "0", card: "card-a" }
        })
      );
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    expect(controller().isForcedContrastOpen).toBe(false);

    act(() => {
      controller().handleRevealAnswer();
    });
    act(() => {
      dispatchWindowKeyboardEvent("c");
    });

    expect(controller().isForcedContrastOpen).toBe(true);

    act(() => {
      dispatchWindowKeyboardEvent("Escape");
    });

    expect(controller().isForcedContrastOpen).toBe(false);
  });
});

function buildFirstCandidateReviewPageData(): ReviewFirstCandidatePageData {
  return {
    media: {
      glossaryHref: "/glossary",
      href: "/",
      reviewHref: "/review",
      slug: "global-review",
      title: "Review globale"
    },
    nextCardId: "card-b",
    queueCardIds: ["card-a", "card-b", "card-c"],
    queue: {
      advanceCards: [buildQueueCard("card-b"), buildQueueCard("card-c")],
      dailyLimit: 20,
      dueCount: 3,
      effectiveDailyLimit: 20,
      introLabel: "3 card da ripassare adesso.",
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: 3,
      queueLabel: "3 card da ripassare adesso.",
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCount: 0
    },
    scope: "global",
    selectedCard: buildQueueCard("card-a") as ReviewFirstCandidatePageData["selectedCard"],
    selectedCardContext: {
      bucket: "due",
      isQueueCard: true,
      position: 1,
      remainingCount: 2,
      reviewStateUpdatedAt: "2026-04-02T11:00:00.000Z",
      showAnswer: false
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: 0,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildQueueCard(id: string): ReviewQueueCard {
  return {
    back: id === "card-a" ? "costo / cost" : "casella / slot",
    bucket: "due",
    bucketDetail: "Richiede attenzione oggi.",
    bucketLabel: "Da ripassare",
    contexts: [],
    createdAt: "2026-04-02T00:00:00.000Z",
    dueAt: "2026-04-02T12:00:00.000Z",
    effectiveState: "review",
    effectiveStateLabel: "Review",
    entries: [],
    exampleIt: undefined,
    exampleJp: undefined,
    front: id === "card-a" ? "コスト" : "札",
    gradePreviews: [],
    href: `/media/duel-masters-dm25/review/card/${id}` as ReviewQueueCard["href"],
    id,
    mediaSlug: "duel-masters-dm25",
    mediaTitle: "Duel Masters",
    notes: undefined,
    orderIndex: 1,
    pronunciations: [],
    rawReviewLabel: "In review",
    reading: "やまふだ",
    reviewSeedState: {
      difficulty: 2.5,
      dueAt: "2026-04-02T12:00:00.000Z",
      fsrsDesiredRetention: 0.9,
      fsrsWeights: null,
      lapses: 0,
      lastReviewedAt: "2026-04-01T12:00:00.000Z",
      learningSteps: 0,
      reps: 1,
      scheduledDays: 1,
      stability: 2,
      state: "review"
    },
    segmentTitle: "Tcg Core",
    typeLabel: "Recognition"
  };
}

function installMinimalDom() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  const doc = new DocumentStub();
  const listeners = new Map<string, Set<(event: EventLike) => void>>();

  Object.defineProperty(g, "window", {
    configurable: true,
    value: g
  });
  Object.defineProperty(g, "document", {
    configurable: true,
    value: doc
  });
  Object.defineProperty(g, "navigator", {
    configurable: true,
    value: {
      userAgent: "node"
    }
  });
  Object.defineProperty(g, "Element", {
    configurable: true,
    value: ElementStub
  });
  Object.defineProperty(g, "HTMLElement", {
    configurable: true,
    value: ElementStub
  });
  Object.defineProperty(g, "HTMLIFrameElement", {
    configurable: true,
    value: HTMLIFrameElementStub
  });
  Object.defineProperty(g, "Node", {
    configurable: true,
    value: NodeStub
  });
  Object.defineProperty(g, "Text", {
    configurable: true,
    value: TextStub
  });
  Object.defineProperty(g, "Comment", {
    configurable: true,
    value: CommentStub
  });
  Object.defineProperty(g, "SVGElement", {
    configurable: true,
    value: ElementStub
  });
  Object.defineProperty(g, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
    writable: true
  });
  Object.defineProperty(g, "history", {
    configurable: true,
    value: {
      replaceState: vi.fn()
    }
  });
  Object.defineProperty(g, "location", {
    configurable: true,
    value: {
      pathname: "/",
      search: ""
    }
  });
  Object.defineProperty(g, "requestAnimationFrame", {
    configurable: true,
    value: () => 1
  });
  Object.defineProperty(g, "cancelAnimationFrame", {
    configurable: true,
    value: () => {}
  });
  Object.defineProperty(g, "addEventListener", {
    configurable: true,
    value: (type: string, listener: (event: EventLike) => void) => {
      const listenersForType = listeners.get(type) ?? new Set();
      listenersForType.add(listener);
      listeners.set(type, listenersForType);
    }
  });
  Object.defineProperty(g, "removeEventListener", {
    configurable: true,
    value: (type: string, listener: (event: EventLike) => void) => {
      listeners.get(type)?.delete(listener);
    }
  });
  Object.defineProperty(g, "dispatchEvent", {
    configurable: true,
    value: (event: EventLike) => {
      for (const listener of listeners.get(event.type) ?? []) {
        listener(event);
      }

      return true;
    }
  });

  doc.defaultView = g as typeof globalThis;
  doc.activeElement = doc.body;
}

function uninstallMinimalDom() {
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  for (const key of [
    "window",
    "document",
    "navigator",
    "Element",
    "HTMLElement",
    "HTMLIFrameElement",
    "Node",
    "Text",
    "Comment",
    "SVGElement",
    "IS_REACT_ACT_ENVIRONMENT",
    "history",
    "location",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "addEventListener",
    "removeEventListener",
    "dispatchEvent"
  ]) {
    delete g[key];
  }
}

type EventLike = {
  altKey?: boolean;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  key?: string;
  metaKey?: boolean;
  preventDefault: () => void;
  shiftKey?: boolean;
  target?: EventTarget | null;
  type: string;
};

function dispatchWindowKeyboardEvent(key: string) {
  const event: EventLike = {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    key,
    metaKey: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
    shiftKey: false,
    target: document.body as unknown as EventTarget,
    type: "keydown"
  };

  window.dispatchEvent(event as unknown as Event);
}

class NodeStub {
  childNodes: NodeStub[] = [];
  parentNode: NodeStub | null = null;

  appendChild<T extends NodeStub>(node: T) {
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore<T extends NodeStub>(node: T, before: NodeStub | null) {
    if (before === null) {
      return this.appendChild(node);
    }

    const index = this.childNodes.indexOf(before);

    if (index < 0) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild<T extends NodeStub>(node: T) {
    const index = this.childNodes.indexOf(node);

    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }

    node.parentNode = null;
    return node;
  }

  addEventListener() {}

  removeEventListener() {}
}

class ElementStub extends NodeStub {
  readonly nodeType = 1;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  attributes: Record<string, string> = {};
  nodeName: string;
  ownerDocument: DocumentStub;
  style: Record<string, string> = {};
  tagName: string;

  constructor(tagName: string, ownerDocument: DocumentStub) {
    super();
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.ownerDocument = ownerDocument;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get textContent() {
    return this.childNodes
      .map((child) => ("textContent" in child ? child.textContent : ""))
      .join("");
  }

  set textContent(value: string) {
    this.childNodes = value.length > 0 ? [new TextStub(value, this.ownerDocument)] : [];
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  scrollIntoView() {}
}

class TextStub extends NodeStub {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  ownerDocument: DocumentStub;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: DocumentStub) {
    super();
    this.ownerDocument = ownerDocument;
    this.data = text;
    this.nodeValue = text;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class CommentStub extends NodeStub {
  readonly nodeType = 8;
  readonly nodeName = "#comment";
  ownerDocument: DocumentStub;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: DocumentStub) {
    super();
    this.ownerDocument = ownerDocument;
    this.data = text;
    this.nodeValue = text;
  }
}

class HTMLIFrameElementStub extends ElementStub {}

class DocumentStub extends NodeStub {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  activeElement: ElementStub | null = null;
  body: ElementStub;
  defaultView: typeof globalThis | null = null;
  documentElement: ElementStub;

  constructor() {
    super();
    this.documentElement = new ElementStub("html", this);
    this.body = new ElementStub("body", this);
    this.activeElement = this.body;
  }

  createElement(tagName: string) {
    return new ElementStub(tagName, this);
  }

  createElementNS(_namespaceURI: string, tagName: string) {
    return this.createElement(tagName);
  }

  createTextNode(text: string) {
    return new TextStub(text, this);
  }

  createComment(text: string) {
    return new CommentStub(text, this);
  }

  querySelector() {
    return null;
  }

  addEventListener() {}

  removeEventListener() {}
}

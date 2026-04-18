import { createElement, act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewPageControllerResult } from "@/components/review/use-review-page-controller";
import type { ReviewPageClientData } from "@/components/review/review-page-state";
import type { ReviewFirstCandidatePageData, ReviewQueueCard } from "@/lib/review-types";

const mocks = vi.hoisted(() => ({
  gradeReviewCardSessionAction: vi.fn(),
  loadReviewPageDataSessionAction: vi.fn(),
  markLinkedEntryKnownSessionAction: vi.fn(),
  prefetchReviewCardSessionAction: vi.fn(),
  resetReviewCardSessionAction: vi.fn(),
  setLinkedEntryLearningSessionAction: vi.fn(),
  setReviewCardSuspendedSessionAction: vi.fn(),
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

import { useReviewPageController } from "@/components/review/use-review-page-controller";

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
    "cancelAnimationFrame"
  ]) {
    delete g[key];
  }
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

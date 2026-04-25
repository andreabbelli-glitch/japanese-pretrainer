import {
  act,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from "react";
import type { Route } from "next";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ReviewForcedContrastSelection,
  ReviewPageClientData
} from "@/components/review/review-page-state";
import type { ReviewGradeValue } from "@/components/review/review-page-helpers";
import type {
  ReviewSessionUpdateOptions,
  useReviewSessionUpdateRunner
} from "@/components/review/use-review-session-update-runner";
import { useReviewGradeSubmissionController } from "@/components/review/use-review-grade-submission-controller";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";

const mocks = vi.hoisted(() => ({
  gradeReviewCardSessionAction: vi.fn()
}));

vi.mock("@/actions/review", () => ({
  gradeReviewCardSessionAction: mocks.gradeReviewCardSessionAction
}));

type SessionUpdateRunner = ReturnType<typeof useReviewSessionUpdateRunner>;
type RunSessionUpdate = SessionUpdateRunner["runSessionUpdate"];
type EnqueueOptimisticGradeSessionUpdate =
  SessionUpdateRunner["enqueueOptimisticGradeSessionUpdate"];

type ControllerSnapshot = Omit<
  ReturnType<typeof useReviewGradeSubmissionController>,
  "handleGradeCard"
> & {
  applyViewData: (
    nextData: ReviewPageClientData,
    nextQueueCardIds?: string[]
  ) => void;
  handleGradeCard: (rating: ReviewGradeValue) => void;
  queueCardIds: string[];
  setClientError: (clientError: string | null) => void;
  viewData: ReviewPageClientData;
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

describe("useReviewGradeSubmissionController", () => {
  beforeEach(() => {
    installMinimalDom();
    mocks.gradeReviewCardSessionAction.mockReset();
    mocks.gradeReviewCardSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageData>(() => {
          // Keep default submissions in flight for lock and pending-state checks.
        })
    );
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    vi.restoreAllMocks();
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("optimistically advances queue grades and tracks submitted/pending ids", async () => {
    const initialData = buildReviewPageData("card-a");
    const controller = await renderGradeSubmissionController(initialData);

    act(() => {
      controller().handleGradeCard("good");
    });

    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: "card-a",
        candidateCardIds: ["card-b", "card-c"],
        canonicalCandidateCardIds: ["card-b", "card-c"],
        gradedCardIds: ["card-a"],
        nextCardId: "card-b",
        rating: "good"
      })
    );
    expect(controller().viewData.selectedCard?.id).toBe("card-b");
    expect(controller().viewData.session.answeredCount).toBe(1);
    expect(controller().queueCardIds).toEqual(["card-b", "card-c"]);
    expect(Array.from(controller().submittedGradeCardIds)).toEqual(["card-a"]);
    expect(Array.from(controller().pendingGradeCardIds)).toEqual(["card-a"]);
    expect(controller().getGradedCardIds()).toEqual(["card-a"]);
  });

  it("rolls back failed optimistic grades and allows retry", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const failure = new Error("Persistence failed.");
    mocks.gradeReviewCardSessionAction.mockRejectedValue(failure);
    const controller = await renderGradeSubmissionController(
      buildReviewPageData("card-a"),
      { runnerMode: "execute" }
    );

    await act(async () => {
      controller().handleGradeCard("good");
      await flushPromises();
    });

    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().viewData.session.answeredCount).toBe(0);
    expect(controller().queueCardIds).toEqual(["card-a", "card-b", "card-c"]);
    expect(controller().submittedGradeCardIds.has("card-a")).toBe(false);
    expect(controller().pendingGradeCardIds.has("card-a")).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(failure);

    act(() => {
      controller().setClientError(null);
    });
    mocks.gradeReviewCardSessionAction.mockResolvedValue(
      buildReviewPageData("card-b", {
        answeredCount: 1,
        queueCardIds: ["card-b", "card-c"]
      })
    );

    await act(async () => {
      controller().handleGradeCard("good");
      await flushPromises();
    });

    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledTimes(2);
  });

  it("keeps forced contrast submissions blocking and non-optimistic", async () => {
    mocks.gradeReviewCardSessionAction.mockImplementation(
      () =>
        new Promise<ReviewPageData>(() => {
          // Keep the submission in flight while inspecting the lock.
        })
    );
    const forcedContrastSelection: ReviewForcedContrastSelection = {
      kind: "term",
      label: "コスト",
      meaning: "costo",
      reading: "こすと",
      resultKey: "term:entry:cost",
      romaji: "kosuto",
      title: undefined
    };
    const controller = await renderGradeSubmissionController(
      buildReviewPageData("card-a"),
      { forcedContrastSelection }
    );

    act(() => {
      controller().handleGradeCard("good");
      controller().handleGradeCard("easy");
    });

    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledTimes(1);
    expect(mocks.gradeReviewCardSessionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        forcedKanjiClashContrast: {
          source: "review-grading",
          targetLabel: "コスト",
          targetResultKey: "term:entry:cost"
        },
        rating: "good"
      })
    );
    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().viewData.session.answeredCount).toBe(0);
    expect(controller().hasBlockingGradeSubmissionInFlight).toBe(true);
  });
});

async function renderGradeSubmissionController(
  initialData: ReviewPageClientData,
  options?: {
    forcedContrastSelection?: ReviewForcedContrastSelection | null;
    runnerMode?: "capture" | "execute";
  }
) {
  let latestController: ControllerSnapshot | null = null;

  function Probe() {
    const [viewData, setViewData] = useState<ReviewPageClientData>(initialData);
    const [queueCardIds, setQueueCardIds] = useState<string[]>(
      initialData.queueCardIds
    );
    const [clientError, setClientError] = useState<string | null>(null);
    const latestViewDataRef = useRef<ReviewPageClientData>(initialData);
    const selectedCard = viewData.selectedCard;
    const activeQueueCardIds = queueCardIds;
    const advanceWindowCardIds = useMemo(
      () =>
        selectedCard
          ? activeQueueCardIds.filter((cardId) => cardId !== selectedCard.id)
          : [],
      [activeQueueCardIds, selectedCard]
    );
    const runSessionUpdate = buildRunSessionUpdate({
      latestViewDataRef,
      mode: options?.runnerMode ?? "capture",
      setClientError,
      setQueueCardIds,
      setViewData
    });
    const enqueueOptimisticGradeSessionUpdate: EnqueueOptimisticGradeSessionUpdate =
      (loadNextData, updateOptions) => {
        if (options?.runnerMode === "execute") {
          const rollbackOptimisticUpdate = updateOptions?.optimisticUpdate?.();
          void loadNextData()
            .then((nextData) => {
              latestViewDataRef.current = nextData;
              setViewData(nextData);
              if (updateOptions?.shouldSyncQueueCardIds?.(nextData) ?? true) {
                setQueueCardIds(nextData.queueCardIds);
              }
              updateOptions?.onSuccess?.(nextData);
            })
            .catch((error) => {
              if (updateOptions?.shouldLogError?.(error) ?? true) {
                console.error(error);
              }
              rollbackOptimisticUpdate?.({ force: true });
              updateOptions?.onError?.();
              setClientError(
                updateOptions?.errorResolver?.(error) ??
                  "Non sono riuscito ad aggiornare la review. Riprova un attimo."
              );
            });
          return;
        }

        updateOptions?.optimisticUpdate?.();
        void loadNextData();
      };
    const controller = useReviewGradeSubmissionController({
      clientError,
      enqueueOptimisticGradeSessionUpdate,
      forcedContrastSelection: options?.forcedContrastSelection ?? null,
      latestViewDataRef,
      runSessionUpdate,
      setPendingAnsweredCountScroll: () => {},
      setQueueCardIds,
      setViewData
    });
    const buildSubmissionContext = useCallback(
      () => ({
        activeQueueCardIds,
        advanceWindowCardIds,
        isHydratingFullData: false,
        isQueueCard: true,
        prefetchedCards: new Map<string, ReviewQueueCard>(),
        queueCardIds,
        selectedCard,
        viewData
      }),
      [
        activeQueueCardIds,
        advanceWindowCardIds,
        queueCardIds,
        selectedCard,
        viewData
      ]
    );

    useEffect(() => {
      latestController = {
        ...controller,
        applyViewData: (nextData, nextQueueCardIds = nextData.queueCardIds) => {
          latestViewDataRef.current = nextData;
          setViewData(nextData);
          setQueueCardIds(nextQueueCardIds);
        },
        handleGradeCard: (rating) =>
          controller.handleGradeCard(rating, buildSubmissionContext()),
        queueCardIds,
        setClientError,
        viewData
      };
    }, [buildSubmissionContext, controller, queueCardIds, viewData]);

    return null;
  }

  container = document.createElement("div");
  root = createRoot(container);

  await act(async () => {
    root!.render(createElement(Probe));
  });

  return () => {
    if (!latestController) {
      throw new Error("controller not mounted");
    }

    return latestController;
  };
}

function buildRunSessionUpdate(input: {
  latestViewDataRef: RefObject<ReviewPageClientData>;
  mode: "capture" | "execute";
  setClientError: (clientError: string | null) => void;
  setQueueCardIds: (queueCardIds: string[]) => void;
  setViewData: (nextData: ReviewPageClientData) => void;
}): RunSessionUpdate {
  return (loadNextData, options?: ReviewSessionUpdateOptions) => {
    input.setClientError(null);
    const rollbackOptimisticUpdate = options?.optimisticUpdate?.();

    if (input.mode === "capture") {
      void loadNextData();
      return;
    }

    void loadNextData()
      .then((nextData) => {
        input.latestViewDataRef.current = nextData;
        input.setViewData(nextData);
        if (options?.shouldSyncQueueCardIds?.(nextData) ?? true) {
          input.setQueueCardIds(nextData.queueCardIds);
        }
        options?.onSuccess?.(nextData);
      })
      .catch((error) => {
        if (options?.shouldLogError?.(error) ?? true) {
          console.error(error);
        }
        rollbackOptimisticUpdate?.();
        options?.onError?.();
        input.setClientError(
          options?.errorResolver?.(error) ??
            "Non sono riuscito ad aggiornare la review. Riprova un attimo."
        );
      });
  };
}

function buildReviewPageData(
  selectedCardId: string,
  options?: {
    answeredCount?: number;
    queueCardIds?: string[];
  }
): ReviewPageData {
  const queueCardIds = options?.queueCardIds ?? ["card-a", "card-b", "card-c"];
  const cards = queueCardIds.map((cardId) => buildQueueCard(cardId));
  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ??
    buildQueueCard(selectedCardId);
  const advanceCards = cards.filter((card) => card.id !== selectedCard.id);

  return {
    media: {
      glossaryHref: "/glossary",
      href: "/media/duel-masters-dm25" as Route,
      reviewHref: "/review",
      slug: "duel-masters-dm25",
      title: "Duel Masters DM25"
    },
    queue: {
      advanceCards,
      cards,
      dailyLimit: 20,
      dueCount: cards.length,
      effectiveDailyLimit: 20,
      introLabel: "3 card da ripassare adesso.",
      manualCards: [],
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: cards.length,
      queueLabel: "3 card da ripassare adesso.",
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    queueCardIds,
    scope: "global",
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      gradePreviews: [],
      isQueueCard: true,
      position: 1,
      remainingCount: Math.max(0, queueCardIds.length - 1),
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: true
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: options?.answeredCount ?? 0,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildQueueCard(cardId: string): ReviewQueueCard {
  return {
    back: `Answer ${cardId}`,
    bucket: "due",
    bucketDetail: "Richiede attenzione oggi.",
    bucketLabel: "Da ripassare",
    contexts: [],
    createdAt: "2026-04-02T00:00:00.000Z",
    dueAt: "2026-04-02T11:00:00.000Z",
    effectiveState: "review",
    effectiveStateLabel: "Review",
    entries: [],
    exampleIt: undefined,
    exampleJp: undefined,
    front: `Front ${cardId}`,
    gradePreviews: [],
    href: `/media/duel-masters-dm25/review/card/${cardId}` as Route,
    id: cardId,
    mediaSlug: "duel-masters-dm25",
    mediaTitle: "Duel Masters DM25",
    notes: undefined,
    orderIndex: 1,
    pronunciations: [],
    rawReviewLabel: "In review",
    reading: undefined,
    reviewStateUpdatedAt:
      cardId === "card-a"
        ? "2026-04-02T11:00:00.000Z"
        : "2026-04-02T11:30:00.000Z",
    reviewSeedState: {
      difficulty: 2.5,
      dueAt: "2026-04-02T11:00:00.000Z",
      fsrsDesiredRetention: 0.9,
      fsrsWeights: null,
      lapses: 0,
      lastReviewedAt: "2026-04-01T11:00:00.000Z",
      learningSteps: 0,
      reps: 1,
      scheduledDays: 1,
      stability: 2,
      state: "review"
    },
    segmentTitle: undefined,
    typeLabel: "Recognition"
  };
}

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
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
    "addEventListener",
    "removeEventListener",
    "dispatchEvent"
  ]) {
    delete g[key];
  }
}

type EventLike = {
  type: string;
};

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
    this.childNodes =
      value.length > 0 ? [new TextStub(value, this.ownerDocument)] : [];
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }
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

  addEventListener() {}

  removeEventListener() {}
}

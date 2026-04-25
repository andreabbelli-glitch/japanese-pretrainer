import { createElement, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useReviewSessionUpdateRunner,
  type ReviewOptimisticRollback
} from "@/components/review/use-review-session-update-runner";
import type { ReviewPageClientData } from "@/components/review/review-page-state";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";

type RunnerSnapshot = ReturnType<typeof useReviewSessionUpdateRunner> & {
  applyViewData: (
    nextData: ReviewPageClientData,
    nextQueueCardIds?: string[]
  ) => void;
  clientError: string | null;
  queueCardIds: string[];
  revealedCardId: string | null;
  viewData: ReviewPageClientData;
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

describe("useReviewSessionUpdateRunner", () => {
  beforeEach(() => {
    installMinimalDom();
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

  it("accepts fresh updates by merging data, syncing queue ids, revealing the server answer, and calling onSuccess", async () => {
    const initialData = buildReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });
    const nextData = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b"],
      selectedCardId: "card-b",
      showAnswer: true
    });
    const onSuccess = vi.fn();
    const controller = await renderRunner(initialData);

    await act(async () => {
      controller().runSessionUpdate(() => Promise.resolve(nextData), {
        onSuccess
      });
      await flushPromises();
    });

    expect(controller().viewData.selectedCard?.id).toBe("card-b");
    expect(controller().viewData.session.answeredCount).toBe(1);
    expect(controller().queueCardIds).toEqual(["card-b"]);
    expect(controller().revealedCardId).toBe("card-b");
    expect(controller().clientError).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedCard: expect.objectContaining({ id: "card-b" })
      })
    );
  });

  it("discards stale updates without overwriting the current view data", async () => {
    const initialData = buildReviewPageData({
      answeredCount: 2,
      queueCardIds: ["card-c"],
      selectedCardId: "card-c"
    });
    const staleData = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });
    const onDiscarded = vi.fn();
    const controller = await renderRunner(initialData);

    await act(async () => {
      controller().runSessionUpdate(() => Promise.resolve(staleData), {
        onDiscarded
      });
      await flushPromises();
    });

    expect(onDiscarded).toHaveBeenCalledWith(staleData);
    expect(controller().viewData.selectedCard?.id).toBe("card-c");
    expect(controller().viewData.session.answeredCount).toBe(2);
    expect(controller().queueCardIds).toEqual(["card-c"]);
  });

  it("accepts same-counter mutation updates that advance to a different selected card", async () => {
    const initialData = buildReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });
    const nextData = buildReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-b"],
      selectedCardId: "card-b"
    });
    const onDiscarded = vi.fn();
    const controller = await renderRunner(initialData);

    await act(async () => {
      controller().runSessionUpdate(() => Promise.resolve(nextData), {
        acceptSameProgressSelectionChange: true,
        onDiscarded
      });
      await flushPromises();
    });

    expect(onDiscarded).not.toHaveBeenCalled();
    expect(controller().viewData.selectedCard?.id).toBe("card-b");
    expect(controller().viewData.session.answeredCount).toBe(0);
    expect(controller().queueCardIds).toEqual(["card-b"]);
  });

  it("handles errors with rollback, callbacks, default and custom messages, and controlled logging", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const initialData = buildReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });
    const optimisticData = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b"],
      selectedCardId: "card-b"
    });
    const controller = await renderRunner(initialData);
    const onError = vi.fn();
    const rollbackOptions: Array<Parameters<ReviewOptimisticRollback>[0]> = [];

    await act(async () => {
      controller().runSessionUpdate(
        () => Promise.reject(new Error("Persistence failed.")),
        {
          onError,
          optimisticUpdate: () => {
            const previousData = controller().viewData;
            const previousQueueCardIds = controller().queueCardIds;
            controller().applyViewData(optimisticData, optimisticData.queueCardIds);

            return (options) => {
              rollbackOptions.push(options);
              controller().applyViewData(previousData, previousQueueCardIds);
            };
          }
        }
      );
      await flushPromises();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(rollbackOptions).toEqual([undefined]);
    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().clientError).toBe(
      "Non sono riuscito ad aggiornare la review. Riprova un attimo."
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockClear();

    await act(async () => {
      controller().runSessionUpdate(
        () => Promise.reject(new Error("Expected validation failure.")),
        {
          errorResolver: () => "Errore controllato.",
          shouldLogError: () => false
        }
      );
      await flushPromises();
    });

    expect(controller().clientError).toBe("Errore controllato.");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("applies optimistic queued updates immediately while persisting them sequentially", async () => {
    const initialData = buildReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-a", "card-b", "card-c"],
      selectedCardId: "card-a"
    });
    const optimisticB = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });
    const optimisticC = buildReviewPageData({
      answeredCount: 2,
      queueCardIds: ["card-c"],
      selectedCardId: "card-c"
    });
    const persistedB = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });
    const persistedC = buildReviewPageData({
      answeredCount: 2,
      queueCardIds: ["card-c"],
      selectedCardId: "card-c"
    });
    const firstPersistence = createDeferred<ReviewPageData>();
    const secondPersistence = createDeferred<ReviewPageData>();
    const loadFirst = vi.fn(() => firstPersistence.promise);
    const loadSecond = vi.fn(() => secondPersistence.promise);
    const controller = await renderRunner(initialData);

    act(() => {
      controller().enqueueOptimisticGradeSessionUpdate(loadFirst, {
        optimisticUpdate: buildOptimisticViewDataUpdate(
          controller,
          optimisticB
        )
      });
      controller().enqueueOptimisticGradeSessionUpdate(loadSecond, {
        optimisticUpdate: buildOptimisticViewDataUpdate(
          controller,
          optimisticC
        )
      });
    });

    expect(controller().viewData.selectedCard?.id).toBe("card-c");
    expect(controller().viewData.session.answeredCount).toBe(2);
    expect(loadFirst).toHaveBeenCalledTimes(1);
    expect(loadSecond).not.toHaveBeenCalled();

    await act(async () => {
      firstPersistence.resolve(persistedB);
      await flushPromises();
    });

    expect(loadSecond).toHaveBeenCalledTimes(1);

    await act(async () => {
      secondPersistence.resolve(persistedC);
      await flushPromises();
    });

    expect(controller().viewData.selectedCard?.id).toBe("card-c");
    expect(controller().clientError).toBeNull();
  });

  it("stops queued optimistic persistence after a failure, force-rolls back, and resets for later queued work", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const initialData = buildReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-a", "card-b", "card-c"],
      selectedCardId: "card-a"
    });
    const optimisticB = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });
    const optimisticC = buildReviewPageData({
      answeredCount: 2,
      queueCardIds: ["card-c"],
      selectedCardId: "card-c"
    });
    const persistedB = buildReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });
    const firstPersistence = createDeferred<ReviewPageData>();
    const thirdPersistence = createDeferred<ReviewPageData>();
    const loadFirst = vi.fn(() => firstPersistence.promise);
    const loadSecond = vi.fn(() => Promise.resolve(optimisticC));
    const loadThird = vi.fn(() => thirdPersistence.promise);
    const firstRollbackOptions: Array<
      Parameters<ReviewOptimisticRollback>[0]
    > = [];
    const secondRollback = vi.fn();
    const firstError = vi.fn();
    const secondError = vi.fn();
    const controller = await renderRunner(initialData);

    act(() => {
      controller().enqueueOptimisticGradeSessionUpdate(loadFirst, {
        onError: firstError,
        optimisticUpdate: buildOptimisticViewDataUpdate(
          controller,
          optimisticB,
          firstRollbackOptions
        )
      });
      controller().enqueueOptimisticGradeSessionUpdate(loadSecond, {
        onError: secondError,
        optimisticUpdate: () => {
          const rollback = buildOptimisticViewDataUpdate(
            controller,
            optimisticC
          )();

          return (options) => {
            secondRollback(options);
            rollback?.(options);
          };
        }
      });
    });

    expect(controller().viewData.selectedCard?.id).toBe("card-c");
    expect(loadFirst).toHaveBeenCalledTimes(1);
    expect(loadSecond).not.toHaveBeenCalled();

    await act(async () => {
      firstPersistence.reject(new Error("Persistence failed."));
      await flushPromises();
    });

    expect(firstError).toHaveBeenCalledTimes(1);
    expect(secondError).toHaveBeenCalledTimes(1);
    expect(firstRollbackOptions).toEqual([{ force: true }]);
    expect(secondRollback).not.toHaveBeenCalled();
    expect(loadSecond).not.toHaveBeenCalled();
    expect(controller().viewData.selectedCard?.id).toBe("card-a");
    expect(controller().viewData.session.answeredCount).toBe(0);
    expect(controller().clientError).toBe(
      "Non sono riuscito ad aggiornare la review. Riprova un attimo."
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    act(() => {
      controller().resetQueuedGradeFailure();
      controller().enqueueOptimisticGradeSessionUpdate(loadThird, {
        optimisticUpdate: buildOptimisticViewDataUpdate(
          controller,
          optimisticB
        )
      });
    });

    expect(loadThird).toHaveBeenCalledTimes(1);
    expect(controller().clientError).toBeNull();

    await act(async () => {
      thirdPersistence.resolve(persistedB);
      await flushPromises();
    });

    expect(controller().viewData.selectedCard?.id).toBe("card-b");
  });
});

async function renderRunner(
  initialData: ReviewPageData,
  options?: {
    isGlobalReview?: boolean;
    requestedSelectedCardId?: string | null;
  }
) {
  let latestSnapshot: RunnerSnapshot | null = null;

  function Probe() {
    const latestViewDataRef = useRef<ReviewPageClientData>(initialData);
    const [viewData, setViewDataState] =
      useState<ReviewPageClientData>(initialData);
    const [queueCardIds, setQueueCardIds] = useState(initialData.queueCardIds);
    const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const applyViewData = (
      nextData: ReviewPageClientData,
      nextQueueCardIds?: string[]
    ) => {
      latestViewDataRef.current = nextData;
      setViewDataState(nextData);
      if (nextQueueCardIds) {
        setQueueCardIds(nextQueueCardIds);
      }
    };
    const runner = useReviewSessionUpdateRunner({
      getLatestViewData: () => latestViewDataRef.current,
      isGlobalReview: options?.isGlobalReview ?? true,
      requestedSelectedCardId: options?.requestedSelectedCardId ?? null,
      setClientError,
      setLatestViewData: (nextData) => {
        latestViewDataRef.current = nextData;
      },
      setQueueCardIds,
      setRevealedCardId,
      setViewData: setViewDataState
    });

    useEffect(() => {
      latestSnapshot = {
        ...runner,
        applyViewData,
        clientError,
        queueCardIds,
        revealedCardId,
        viewData
      };
    });

    return null;
  }

  container = document.createElement("div");
  root = createRoot(container);

  await act(async () => {
    root!.render(createElement(Probe));
    await flushPromises();
  });

  return () => {
    if (!latestSnapshot) {
      throw new Error("Runner was not mounted.");
    }

    return latestSnapshot;
  };
}

function buildOptimisticViewDataUpdate(
  controller: () => RunnerSnapshot,
  optimisticData: ReviewPageData,
  rollbackOptions?: Array<Parameters<ReviewOptimisticRollback>[0]>
) {
  return () => {
    const previousData = controller().viewData;
    const previousQueueCardIds = controller().queueCardIds;
    controller().applyViewData(optimisticData, optimisticData.queueCardIds);

    return (options: Parameters<ReviewOptimisticRollback>[0]) => {
      rollbackOptions?.push(options);
      controller().applyViewData(previousData, previousQueueCardIds);
    };
  };
}

function buildReviewPageData(input: {
  answeredCount: number;
  queueCardIds: string[];
  selectedCardId: string;
  showAnswer?: boolean;
}): ReviewPageData {
  const selectedCard = buildQueueCard(input.selectedCardId);
  const advanceCards = input.queueCardIds
    .filter((cardId) => cardId !== input.selectedCardId)
    .map((cardId) => buildQueueCard(cardId));

  return {
    media: {
      glossaryHref: "/glossary",
      href: "/",
      reviewHref: "/review",
      slug: "global-review",
      title: "Review globale"
    },
    queue: {
      advanceCards,
      cards: [selectedCard, ...advanceCards],
      dailyLimit: 20,
      dueCount: input.queueCardIds.length,
      effectiveDailyLimit: 20,
      introLabel: `${input.queueCardIds.length} card da ripassare adesso.`,
      manualCards: [],
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: input.queueCardIds.length,
      queueLabel: `${input.queueCardIds.length} card da ripassare adesso.`,
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    queueCardIds: input.queueCardIds,
    scope: "global",
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      gradePreviews: [],
      isQueueCard: true,
      position: input.answeredCount + 1,
      remainingCount: Math.max(input.queueCardIds.length - 1, 0),
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: input.showAnswer ?? false
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: input.answeredCount,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildQueueCard(id: string): ReviewQueueCard {
  const updatedAtByCardId = new Map([
    ["card-a", "2026-04-02T11:00:00.000Z"],
    ["card-b", "2026-04-02T11:30:00.000Z"],
    ["card-c", "2026-04-02T12:00:00.000Z"]
  ]);

  return {
    back: `${id} back`,
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
    front: id,
    gradePreviews: [],
    href: `/media/duel-masters-dm25/review/card/${id}` as ReviewQueueCard["href"],
    id,
    mediaSlug: "duel-masters-dm25",
    mediaTitle: "Duel Masters",
    notes: undefined,
    orderIndex: 1,
    pronunciations: [],
    rawReviewLabel: "In review",
    reading: "yamafuda",
    reviewStateUpdatedAt: updatedAtByCardId.get(id) ?? null,
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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

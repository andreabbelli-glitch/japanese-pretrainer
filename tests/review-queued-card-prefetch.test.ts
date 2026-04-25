import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import type { ReviewQueueCard } from "@/lib/review-types";

const mocks = vi.hoisted(() => ({
  prefetchReviewCardSessionAction: vi.fn()
}));

vi.mock("@/actions/review", () => ({
  prefetchReviewCardSessionAction: mocks.prefetchReviewCardSessionAction
}));

import {
  useReviewQueuedCardPrefetch,
  type ReviewQueuedCardPrefetchInput
} from "@/components/review/use-review-queued-card-prefetch";

type HookSnapshot = ReturnType<typeof useReviewQueuedCardPrefetch>;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

describe("useReviewQueuedCardPrefetch", () => {
  beforeEach(() => {
    installMinimalDom();
    mocks.prefetchReviewCardSessionAction.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await flushPromises();
    });
    vi.restoreAllMocks();
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("prefetches only missing queued cards that are not covered by the server advance window", async () => {
    mocks.prefetchReviewCardSessionAction.mockImplementation(
      ({ cardId }: { cardId: string }) =>
        Promise.resolve(buildQueueCard(cardId))
    );
    await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b", "card-c", "card-d"],
      queueCardIds: ["card-a", "card-b", "card-c", "card-d"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a"),
      serverAdvanceCardIds: new Set(["card-b"])
    });

    expect(prefetchedCardIds()).toEqual(["card-c", "card-d"]);
  });

  it("does not refetch cards that are already buffered or already in flight", async () => {
    const cardC = createDeferred<ReviewQueueCard | null>();
    const queueCardIds = ["card-a", "card-b", "card-c"];
    const selectedCard = buildQueueCard("card-a");
    mocks.prefetchReviewCardSessionAction.mockImplementation(
      ({ cardId }: { cardId: string }) =>
        cardId === "card-c"
          ? cardC.promise
          : Promise.resolve(buildQueueCard(cardId))
    );
    const controller = await renderPrefetchHook({
      activeQueueCardIds: queueCardIds,
      queueCardIds,
      queueIndex: 0,
      selectedCard
    });

    expect(prefetchedCardIds()).toEqual(["card-b", "card-c"]);
    expect(controller().getPrefetchedCards().has("card-b")).toBe(true);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: [...queueCardIds],
          queueCardIds: [...queueCardIds],
          queueIndex: 0,
          selectedCard
        })
      );
      await flushPromises();
    });

    expect(prefetchedCardIds()).toEqual(["card-b", "card-c"]);
  });

  it("prunes buffered and in-flight cards when the queue changes", async () => {
    const firstCardC = createDeferred<ReviewQueueCard | null>();
    let cardCPrefetches = 0;
    mocks.prefetchReviewCardSessionAction.mockImplementation(
      ({ cardId }: { cardId: string }) => {
        if (cardId === "card-c") {
          cardCPrefetches += 1;
          return cardCPrefetches === 1
            ? firstCardC.promise
            : Promise.resolve(buildQueueCard(cardId));
        }

        return Promise.resolve(buildQueueCard(cardId));
      }
    );
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b", "card-c"],
      queueCardIds: ["card-a", "card-b", "card-c"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });

    expect(controller().getPrefetchedCards().has("card-b")).toBe(true);
    expect(prefetchedCardIds()).toEqual(["card-b", "card-c"]);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: ["card-a", "card-d"],
          isQueueCard: false,
          queueCardIds: ["card-a", "card-d"],
          queueIndex: 0,
          selectedCard: buildQueueCard("card-a")
        })
      );
      await flushPromises();
    });

    expect([...controller().getPrefetchedCards().keys()]).toEqual([]);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: ["card-a", "card-c"],
          queueCardIds: ["card-a", "card-c"],
          queueIndex: 0,
          selectedCard: buildQueueCard("card-a")
        })
      );
      await flushPromises();
    });

    expect(prefetchedCardIds()).toEqual(["card-b", "card-c", "card-c"]);
  });

  it("ignores async prefetch results after the queue changes or the hook unmounts", async () => {
    const cardB = createDeferred<ReviewQueueCard | null>();
    const cardD = createDeferred<ReviewQueueCard | null>();
    mocks.prefetchReviewCardSessionAction.mockImplementation(
      ({ cardId }: { cardId: string }) =>
        cardId === "card-b" ? cardB.promise : cardD.promise
    );
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b"],
      queueCardIds: ["card-a", "card-b"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: ["card-a", "card-d"],
          queueCardIds: ["card-a", "card-d"],
          queueIndex: 0,
          selectedCard: buildQueueCard("card-a")
        })
      );
      await flushPromises();
    });

    await act(async () => {
      cardB.resolve(buildQueueCard("card-b"));
      await flushPromises();
    });

    expect(controller().getPrefetchedCards().has("card-b")).toBe(false);

    await act(async () => {
      root?.unmount();
      await flushPromises();
    });
    root = null;

    await act(async () => {
      cardD.resolve(buildQueueCard("card-d"));
      await flushPromises();
    });

    expect(controller().getPrefetchedCards().has("card-d")).toBe(false);
  });

  it("returns a stable getter that reads the current prefetch buffer", async () => {
    const cardB = createDeferred<ReviewQueueCard | null>();
    mocks.prefetchReviewCardSessionAction.mockReturnValue(cardB.promise);
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b"],
      queueCardIds: ["card-a", "card-b"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });
    const getPrefetchedCards = controller().getPrefetchedCards;

    expect(getPrefetchedCards().has("card-b")).toBe(false);

    await act(async () => {
      cardB.resolve(buildQueueCard("card-b"));
      await flushPromises();
    });

    expect(controller().getPrefetchedCards).toBe(getPrefetchedCards);
    expect(getPrefetchedCards().get("card-b")?.id).toBe("card-b");
  });
});

function Probe(props: Partial<ReviewQueuedCardPrefetchInput>) {
  const activeQueueCardIds = props.activeQueueCardIds ?? ["card-a", "card-b"];
  const queueIndex = props.queueIndex ?? 0;
  const result = useReviewQueuedCardPrefetch({
    activeQueueCardIds,
    isQueueCard: props.isQueueCard ?? true,
    queueCardIds: props.queueCardIds ?? activeQueueCardIds,
    queueIndex,
    selectedCard:
      props.selectedCard ?? buildQueueCard(activeQueueCardIds[queueIndex]!),
    serverAdvanceCardIds: props.serverAdvanceCardIds ?? new Set()
  });

  useEffect(() => {
    latestHookSnapshot = result;
  });

  return null;
}

let latestHookSnapshot: HookSnapshot | null = null;

async function renderPrefetchHook(
  input: Partial<ReviewQueuedCardPrefetchInput>
) {
  latestHookSnapshot = null;
  container = document.createElement("div");
  root = createRoot(container);

  await act(async () => {
    root!.render(createElement(Probe, input));
    await flushPromises();
  });

  return getLatestHookSnapshot;
}

function getLatestHookSnapshot() {
  if (!latestHookSnapshot) {
    throw new Error("Hook was not mounted.");
  }

  return latestHookSnapshot;
}

function prefetchedCardIds() {
  return mocks.prefetchReviewCardSessionAction.mock.calls.map(([input]) => {
    return (input as { cardId: string }).cardId;
  });
}

function buildQueueCard(id: string): ReviewQueueCard {
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

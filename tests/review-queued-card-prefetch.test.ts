import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDeferred, flushMicrotasks } from "./helpers/async";
import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import type { ReviewQueueCard } from "@/features/review/types";

type ReviewCardPrefetchResult = {
  card: ReviewQueueCard | null;
  cardId: string;
};

const mocks = vi.hoisted(() => ({
  preloadAudioSources: vi.fn(),
  prefetchReviewCardsSessionAction: vi.fn()
}));

vi.mock("@/actions/review", () => ({
  prefetchReviewCardsSessionAction: mocks.prefetchReviewCardsSessionAction
}));

vi.mock("@/components/ui/audio-preload", () => ({
  preloadAudioSources: mocks.preloadAudioSources
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
    mocks.preloadAudioSources.mockReset();
    mocks.prefetchReviewCardsSessionAction.mockReset();
    mocks.prefetchReviewCardsSessionAction.mockImplementation(
      ({ cardIds }: { cardIds: string[] }) =>
        Promise.resolve(cardIds.map((cardId) => buildPrefetchResult(cardId)))
    );
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await flushMicrotasks(3);
    });
    vi.restoreAllMocks();
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("prefetches only missing queued cards that are not covered by the server advance window", async () => {
    await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b", "card-c", "card-d"],
      queueCardIds: ["card-a", "card-b", "card-c", "card-d"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a"),
      serverAdvanceCardIds: new Set(["card-b"])
    });

    expect(prefetchBatches()).toEqual([["card-c", "card-d"]]);
    expect(mocks.prefetchReviewCardsSessionAction).toHaveBeenCalledTimes(1);
  });

  it("collapses a three-card canonical prefetch window into one action invocation", async () => {
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b", "card-c", "card-d", "card-e"],
      queueCardIds: ["card-a", "card-b", "card-c", "card-d", "card-e"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });

    expect(prefetchBatches()).toEqual([["card-b", "card-c", "card-d"]]);
    expect(mocks.prefetchReviewCardsSessionAction).toHaveBeenCalledTimes(1);
    expect([...controller().getPrefetchedCards().keys()]).toEqual([
      "card-b",
      "card-c",
      "card-d"
    ]);
  });

  it("keeps successful batch cards buffered when another card falls back", async () => {
    mocks.prefetchReviewCardsSessionAction.mockResolvedValue([
      { card: null, cardId: "card-b" },
      buildPrefetchResult("card-c")
    ]);
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b", "card-c"],
      queueCardIds: ["card-a", "card-b", "card-c"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });

    expect(prefetchBatches()).toEqual([["card-b", "card-c"]]);
    expect(controller().getPrefetchedCards().has("card-b")).toBe(false);
    expect(controller().getPrefetchedCards().get("card-c")?.id).toBe("card-c");
  });

  it("preloads audio from server advance cards without refetching them", async () => {
    const serverAdvanceCard = buildQueueCard("card-b", {
      audioSrc: "/media/duel-masters-dm25/assets/audio/card-b.mp3"
    });
    await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b", "card-c"],
      queueCardIds: ["card-a", "card-b", "card-c"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a"),
      serverAdvanceCardIds: new Set(["card-b"]),
      serverAdvanceCards: [serverAdvanceCard]
    });

    expect(prefetchBatches()).toEqual([["card-c"]]);
    expect(mocks.preloadAudioSources).toHaveBeenCalledWith(
      ["/media/duel-masters-dm25/assets/audio/card-b.mp3"],
      { role: "next" }
    );
  });

  it("preloads audio from newly accepted prefetched cards", async () => {
    const cardB = createDeferred<ReviewCardPrefetchResult[]>();
    mocks.prefetchReviewCardsSessionAction.mockReturnValue(cardB.promise);
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b"],
      queueCardIds: ["card-a", "card-b"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });

    expect(mocks.preloadAudioSources).not.toHaveBeenCalled();

    await act(async () => {
      cardB.resolve([
        buildPrefetchResult("card-b", {
          audioSrc: "/media/duel-masters-dm25/assets/audio/card-b.mp3"
        })
      ]);
      await flushMicrotasks(3);
    });

    expect(controller().getPrefetchedCards().has("card-b")).toBe(true);
    expect(mocks.preloadAudioSources).toHaveBeenCalledWith(
      ["/media/duel-masters-dm25/assets/audio/card-b.mp3"],
      { role: "next" }
    );
  });

  it("does not refetch cards that are already buffered or already in flight", async () => {
    const batch = createDeferred<ReviewCardPrefetchResult[]>();
    const queueCardIds = ["card-a", "card-b", "card-c"];
    const selectedCard = buildQueueCard("card-a");
    mocks.prefetchReviewCardsSessionAction.mockReturnValue(batch.promise);
    const controller = await renderPrefetchHook({
      activeQueueCardIds: queueCardIds,
      queueCardIds,
      queueIndex: 0,
      selectedCard
    });

    expect(prefetchBatches()).toEqual([["card-b", "card-c"]]);
    expect(controller().getPrefetchedCards().size).toBe(0);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: [...queueCardIds],
          queueCardIds: [...queueCardIds],
          queueIndex: 0,
          selectedCard
        })
      );
      await flushMicrotasks(3);
    });

    expect(prefetchBatches()).toEqual([["card-b", "card-c"]]);

    await act(async () => {
      batch.resolve([
        buildPrefetchResult("card-b"),
        buildPrefetchResult("card-c")
      ]);
      await flushMicrotasks(3);
    });

    expect([...controller().getPrefetchedCards().keys()]).toEqual([
      "card-b",
      "card-c"
    ]);
  });

  it("keeps in-flight prefetch results across an equivalent rerender", async () => {
    const batch = createDeferred<ReviewCardPrefetchResult[]>();
    const queueCardIds = ["card-a", "card-b", "card-c"];
    const selectedCard = buildQueueCard("card-a");
    mocks.prefetchReviewCardsSessionAction.mockReturnValue(batch.promise);
    const controller = await renderPrefetchHook({
      activeQueueCardIds: queueCardIds,
      queueCardIds,
      queueIndex: 0,
      selectedCard
    });

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: [...queueCardIds],
          queueCardIds: [...queueCardIds],
          queueIndex: 0,
          selectedCard,
          serverAdvanceCardIds: new Set<string>()
        })
      );
      await flushMicrotasks(3);
    });

    expect(prefetchBatches()).toEqual([["card-b", "card-c"]]);

    await act(async () => {
      batch.resolve([
        buildPrefetchResult("card-b"),
        buildPrefetchResult("card-c")
      ]);
      await flushMicrotasks(3);
    });

    expect(controller().getPrefetchedCards().get("card-c")?.id).toBe("card-c");
  });

  it("prunes buffered and in-flight cards when the queue changes", async () => {
    const firstCardC = createDeferred<ReviewCardPrefetchResult[]>();
    let cardCPrefetches = 0;
    mocks.prefetchReviewCardsSessionAction.mockImplementation(
      ({ cardIds }: { cardIds: string[] }) => {
        if (cardIds.includes("card-c")) {
          cardCPrefetches += 1;
          return cardCPrefetches === 1
            ? firstCardC.promise
            : Promise.resolve(
                cardIds.map((cardId) => buildPrefetchResult(cardId))
              );
        }

        return Promise.resolve(
          cardIds.map((cardId) => buildPrefetchResult(cardId))
        );
      }
    );
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b"],
      queueCardIds: ["card-a", "card-b"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });

    expect(controller().getPrefetchedCards().has("card-b")).toBe(true);
    expect(prefetchBatches()).toEqual([["card-b"]]);

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: ["card-a", "card-b", "card-c"],
          queueCardIds: ["card-a", "card-b", "card-c"],
          queueIndex: 0,
          selectedCard: buildQueueCard("card-a")
        })
      );
      await flushMicrotasks(3);
    });

    expect(prefetchBatches()).toEqual([["card-b"], ["card-c"]]);

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
      await flushMicrotasks(3);
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
      await flushMicrotasks(3);
    });

    expect(prefetchBatches()).toEqual([["card-b"], ["card-c"], ["card-c"]]);
  });

  it("ignores async prefetch results after the queue changes or the hook unmounts", async () => {
    const cardB = createDeferred<ReviewCardPrefetchResult[]>();
    const cardD = createDeferred<ReviewCardPrefetchResult[]>();
    mocks.prefetchReviewCardsSessionAction.mockImplementation(
      ({ cardIds }: { cardIds: string[] }) =>
        cardIds.includes("card-b") ? cardB.promise : cardD.promise
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
      await flushMicrotasks(3);
    });

    await act(async () => {
      cardB.resolve([
        buildPrefetchResult("card-b", {
          audioSrc: "/media/duel-masters-dm25/assets/audio/card-b.mp3"
        })
      ]);
      await flushMicrotasks(3);
    });

    expect(controller().getPrefetchedCards().has("card-b")).toBe(false);
    expect(mocks.preloadAudioSources).not.toHaveBeenCalled();

    await act(async () => {
      root?.unmount();
      await flushMicrotasks(3);
    });
    root = null;

    await act(async () => {
      cardD.resolve([
        buildPrefetchResult("card-d", {
          audioSrc: "/media/duel-masters-dm25/assets/audio/card-d.mp3"
        })
      ]);
      await flushMicrotasks(3);
    });

    expect(controller().getPrefetchedCards().has("card-d")).toBe(false);
    expect(mocks.preloadAudioSources).not.toHaveBeenCalled();
  });

  it("keeps the newest prefetch when an older card request resolves after re-entering the queue", async () => {
    const firstCardB = createDeferred<ReviewCardPrefetchResult[]>();
    const secondCardB = createDeferred<ReviewCardPrefetchResult[]>();
    let cardBPrefetches = 0;

    mocks.prefetchReviewCardsSessionAction.mockImplementation(
      ({ cardIds }: { cardIds: string[] }) => {
        if (cardIds.includes("card-b")) {
          cardBPrefetches += 1;
          return cardBPrefetches === 1
            ? firstCardB.promise
            : secondCardB.promise;
        }

        return Promise.resolve(
          cardIds.map((cardId) => buildPrefetchResult(cardId))
        );
      }
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
          activeQueueCardIds: ["card-a", "card-c"],
          queueCardIds: ["card-a", "card-c"],
          queueIndex: 0,
          selectedCard: buildQueueCard("card-a")
        })
      );
      await flushMicrotasks(3);
    });

    await act(async () => {
      root!.render(
        createElement(Probe, {
          activeQueueCardIds: ["card-a", "card-b"],
          queueCardIds: ["card-a", "card-b"],
          queueIndex: 0,
          selectedCard: buildQueueCard("card-a")
        })
      );
      await flushMicrotasks(3);
    });

    await act(async () => {
      secondCardB.resolve([
        {
          card: {
            ...buildQueueCard("card-b"),
            front: "fresh card-b"
          },
          cardId: "card-b"
        }
      ]);
      await flushMicrotasks(3);
    });

    expect(controller().getPrefetchedCards().get("card-b")?.front).toBe(
      "fresh card-b"
    );

    await act(async () => {
      firstCardB.resolve([
        {
          card: {
            ...buildQueueCard("card-b"),
            front: "stale card-b"
          },
          cardId: "card-b"
        }
      ]);
      await flushMicrotasks(3);
    });

    expect(controller().getPrefetchedCards().get("card-b")?.front).toBe(
      "fresh card-b"
    );
  });

  it("returns a stable getter that reads the current prefetch buffer", async () => {
    const cardB = createDeferred<ReviewCardPrefetchResult[]>();
    mocks.prefetchReviewCardsSessionAction.mockReturnValue(cardB.promise);
    const controller = await renderPrefetchHook({
      activeQueueCardIds: ["card-a", "card-b"],
      queueCardIds: ["card-a", "card-b"],
      queueIndex: 0,
      selectedCard: buildQueueCard("card-a")
    });
    const getPrefetchedCards = controller().getPrefetchedCards;

    expect(getPrefetchedCards().has("card-b")).toBe(false);

    await act(async () => {
      cardB.resolve([buildPrefetchResult("card-b")]);
      await flushMicrotasks(3);
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
    serverAdvanceCardIds: props.serverAdvanceCardIds ?? new Set(),
    serverAdvanceCards: props.serverAdvanceCards ?? []
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
    await flushMicrotasks(3);
  });

  return getLatestHookSnapshot;
}

function getLatestHookSnapshot() {
  if (!latestHookSnapshot) {
    throw new Error("Hook was not mounted.");
  }

  return latestHookSnapshot;
}

function prefetchBatches() {
  return mocks.prefetchReviewCardsSessionAction.mock.calls.map(([input]) => {
    return (input as { cardIds: string[] }).cardIds;
  });
}

function buildPrefetchResult(
  cardId: string,
  options: {
    audioSrc?: string;
  } = {}
): ReviewCardPrefetchResult {
  return {
    card: buildQueueCard(cardId, options),
    cardId
  };
}

function buildQueueCard(
  id: string,
  options: {
    audioSrc?: string;
  } = {}
): ReviewQueueCard {
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
    pronunciations: options.audioSrc
      ? [
          {
            audio: {
              src: options.audioSrc as ReviewQueueCard["pronunciations"][number]["audio"]["src"]
            },
            kind: "term",
            label: id,
            meaning: `${id} meaning`,
            relationshipLabel: "Voce"
          }
        ]
      : [],
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

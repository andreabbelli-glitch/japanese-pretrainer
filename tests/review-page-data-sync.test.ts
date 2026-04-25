import { createElement, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import type { ReviewPageClientData } from "@/components/review/review-page-state";
import { useReviewPageDataSync } from "@/components/review/use-review-page-data-sync";
import type {
  ReviewFirstCandidateCard,
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";

const mocks = vi.hoisted(() => ({
  loadReviewPageDataSessionAction: vi.fn()
}));

vi.mock("@/actions/review", () => ({
  loadReviewPageDataSessionAction: mocks.loadReviewPageDataSessionAction
}));

type HookProps = {
  currentSearchParams?: Record<string, string | string[] | undefined>;
  data: ReviewPageClientData;
  globalHydrationRequestKey: string | null;
  initialClientError?: string | null;
  isGlobalReview: boolean;
  requestedSelectedCardId: string | null;
  resetQueuedGradeFailure: () => void;
};

type HookSnapshot = {
  clientError: string | null;
  latestViewData: ReviewPageClientData;
  queueCardIds: string[];
  revealedCardId: string | null;
  viewData: ReviewPageClientData;
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

describe("useReviewPageDataSync", () => {
  beforeEach(() => {
    installMinimalDom();
    mocks.loadReviewPageDataSessionAction.mockReset();
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

  it("does not start duplicate hydration when full global data is already accepted", async () => {
    const resetQueuedGradeFailure = vi.fn();
    const harness = renderDataSync({
      currentSearchParams: { answered: "0", card: "card-a" },
      data: buildFullReviewPageData({
        queueCardIds: ["card-a", "card-b"],
        selectedCardId: "card-a"
      }),
      globalHydrationRequestKey: "answered=0&card=card-a",
      isGlobalReview: true,
      requestedSelectedCardId: "card-a",
      resetQueuedGradeFailure
    });

    await act(async () => {
      await flushPromises();
    });

    expect(mocks.loadReviewPageDataSessionAction).not.toHaveBeenCalled();
    expect(harness.snapshot().viewData.selectedCard?.id).toBe("card-a");
    expect(resetQueuedGradeFailure).not.toHaveBeenCalled();
  });

  it("hydrates a global first-candidate payload once per request key and syncs data on success", async () => {
    const hydration = createDeferred<ReviewPageData>();
    const resetQueuedGradeFailure = vi.fn();
    mocks.loadReviewPageDataSessionAction.mockReturnValue(hydration.promise);
    const harness = renderDataSync({
      currentSearchParams: { answered: "0", card: "card-a" },
      data: buildFirstCandidateReviewPageData({
        queueCardIds: ["card-a", "card-b", "card-c"],
        selectedCardId: "card-a"
      }),
      globalHydrationRequestKey: "answered=0&card=card-a",
      isGlobalReview: true,
      requestedSelectedCardId: "card-a",
      resetQueuedGradeFailure
    });

    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledTimes(1);
    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledWith({
      scope: "global",
      searchParams: { answered: "0", card: "card-a" }
    });

    await act(async () => {
      hydration.resolve(
        buildFullReviewPageData({
          queueCardIds: ["card-b", "card-c"],
          selectedCardId: "card-b"
        })
      );
      await flushPromises();
    });

    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledTimes(1);
    expect(harness.snapshot().viewData.selectedCard?.id).toBe("card-b");
    expect(harness.snapshot().latestViewData.selectedCard?.id).toBe("card-b");
    expect(harness.snapshot().queueCardIds).toEqual(["card-b", "card-c"]);
    expect(harness.snapshot().clientError).toBeNull();
    expect(resetQueuedGradeFailure).not.toHaveBeenCalled();
  });

  it("keeps the current stage and surfaces the hydration error message on failure", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const resetQueuedGradeFailure = vi.fn();
    mocks.loadReviewPageDataSessionAction.mockRejectedValue(
      new Error("Hydration failed.")
    );
    const harness = renderDataSync({
      currentSearchParams: { answered: "0", card: "card-a" },
      data: buildFirstCandidateReviewPageData({
        queueCardIds: ["card-a", "card-b"],
        selectedCardId: "card-a"
      }),
      globalHydrationRequestKey: "answered=0&card=card-a",
      isGlobalReview: true,
      requestedSelectedCardId: "card-a",
      resetQueuedGradeFailure
    });

    await act(async () => {
      await flushPromises();
    });

    expect(harness.snapshot().viewData.selectedCard?.id).toBe("card-a");
    expect(harness.snapshot().queueCardIds).toEqual(["card-a", "card-b"]);
    expect(harness.snapshot().clientError).toBe(
      "Non sono riuscito a completare i dettagli della review. La stage resta disponibile."
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(resetQueuedGradeFailure).not.toHaveBeenCalled();
  });

  it("clears client errors and resets queued grade failures after an accepted server refresh", async () => {
    const resetQueuedGradeFailure = vi.fn();
    const initialData = buildFullReviewPageData({
      answeredCount: 0,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });
    const nextData = buildFullReviewPageData({
      answeredCount: 1,
      queueCardIds: ["card-b"],
      selectedCardId: "card-b"
    });
    const harness = renderDataSync({
      data: initialData,
      globalHydrationRequestKey: null,
      initialClientError: "Errore precedente.",
      isGlobalReview: true,
      requestedSelectedCardId: null,
      resetQueuedGradeFailure
    });

    await act(async () => {
      harness.render({
        data: nextData,
        globalHydrationRequestKey: null,
        isGlobalReview: true,
        requestedSelectedCardId: null,
        resetQueuedGradeFailure
      });
      await flushPromises();
    });

    expect(harness.snapshot().clientError).toBeNull();
    expect(harness.snapshot().viewData.selectedCard?.id).toBe("card-b");
    expect(harness.snapshot().queueCardIds).toEqual(["card-b"]);
    expect(harness.snapshot().revealedCardId).toBeNull();
    expect(resetQueuedGradeFailure).toHaveBeenCalledTimes(1);
  });

  it("does not let a cancelled hydration overwrite newer accepted state", async () => {
    const firstHydration = createDeferred<ReviewPageData>();
    const secondHydration = createDeferred<ReviewPageData>();
    const resetQueuedGradeFailure = vi.fn();
    mocks.loadReviewPageDataSessionAction
      .mockReturnValueOnce(firstHydration.promise)
      .mockReturnValueOnce(secondHydration.promise);
    const firstCandidateData = buildFirstCandidateReviewPageData({
      queueCardIds: ["card-a", "card-b", "card-c"],
      selectedCardId: "card-a"
    });
    const harness = renderDataSync({
      currentSearchParams: { answered: "0", card: "card-a" },
      data: firstCandidateData,
      globalHydrationRequestKey: "answered=0&card=card-a",
      isGlobalReview: true,
      requestedSelectedCardId: "card-a",
      resetQueuedGradeFailure
    });

    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      harness.render({
        currentSearchParams: { answered: "0", card: "card-b" },
        data: firstCandidateData,
        globalHydrationRequestKey: "answered=0&card=card-b",
        isGlobalReview: true,
        requestedSelectedCardId: "card-b",
        resetQueuedGradeFailure
      });
      await flushPromises();
    });

    expect(mocks.loadReviewPageDataSessionAction).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondHydration.resolve(
        buildFullReviewPageData({
          queueCardIds: ["card-b", "card-c"],
          selectedCardId: "card-b"
        })
      );
      await flushPromises();
    });

    await act(async () => {
      firstHydration.resolve(
        buildFullReviewPageData({
          queueCardIds: ["card-a", "card-c"],
          selectedCardId: "card-a"
        })
      );
      await flushPromises();
    });

    expect(harness.snapshot().viewData.selectedCard?.id).toBe("card-b");
    expect(harness.snapshot().latestViewData.selectedCard?.id).toBe("card-b");
    expect(harness.snapshot().queueCardIds).toEqual(["card-b", "card-c"]);
  });
});

function renderDataSync(initialProps: HookProps) {
  let latestSnapshot: HookSnapshot | null = null;

  function Probe(props: HookProps) {
    const [viewData, setViewData] = useState<ReviewPageClientData>(props.data);
    const [queueCardIds, setQueueCardIds] = useState<string[]>(
      "queueCardIds" in props.data ? props.data.queueCardIds : []
    );
    const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(
      props.initialClientError ?? null
    );
    const latestViewDataRef = useRef<ReviewPageClientData>(props.data);

    useReviewPageDataSync({
      currentSearchParams: props.currentSearchParams,
      data: props.data,
      globalHydrationRequestKey: props.globalHydrationRequestKey,
      isGlobalReview: props.isGlobalReview,
      latestViewDataRef,
      requestedSelectedCardId: props.requestedSelectedCardId,
      resetQueuedGradeFailure: props.resetQueuedGradeFailure,
      setClientError,
      setQueueCardIds,
      setRevealedCardId,
      setViewData,
      viewData
    });

    useEffect(() => {
      latestSnapshot = {
        clientError,
        latestViewData: latestViewDataRef.current,
        queueCardIds,
        revealedCardId,
        viewData
      };
    });

    return null;
  }

  container = document.createElement("div");
  root = createRoot(container);

  function render(nextProps: HookProps) {
    root!.render(createElement(Probe, nextProps));
  }

  act(() => {
    render(initialProps);
  });

  return {
    render,
    snapshot() {
      if (!latestSnapshot) {
        throw new Error("Hook snapshot not mounted.");
      }

      return latestSnapshot;
    }
  };
}

function buildFirstCandidateReviewPageData(input: {
  answeredCount?: number;
  queueCardIds: string[];
  selectedCardId: string;
  showAnswer?: boolean;
}): ReviewFirstCandidatePageData {
  const selectedCard = buildFirstCandidateCard(input.selectedCardId);
  const advanceCards = input.queueCardIds
    .filter((cardId) => cardId !== input.selectedCardId)
    .map((cardId) => buildQueueCard(cardId));

  return {
    media: buildReviewMedia(),
    nextCardId: advanceCards[0]?.id ?? null,
    queue: {
      advanceCards,
      dailyLimit: 20,
      dueCount: input.queueCardIds.length,
      effectiveDailyLimit: 20,
      introLabel: `${input.queueCardIds.length} card da ripassare adesso.`,
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: input.queueCardIds.length,
      queueLabel: `${input.queueCardIds.length} card da ripassare adesso.`,
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCount: 0
    },
    queueCardIds: input.queueCardIds,
    scope: "global",
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      isQueueCard: true,
      position: 1,
      remainingCount: Math.max(0, input.queueCardIds.length - 1),
      reviewStateUpdatedAt: "2026-04-02T11:00:00.000Z",
      showAnswer: input.showAnswer ?? false
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: input.answeredCount ?? 0,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildFullReviewPageData(input: {
  answeredCount?: number;
  queueCardIds: string[];
  selectedCardId: string;
  showAnswer?: boolean;
}): ReviewPageData {
  const selectedCard = buildQueueCard(input.selectedCardId);
  const advanceCards = input.queueCardIds
    .filter((cardId) => cardId !== input.selectedCardId)
    .map((cardId) => buildQueueCard(cardId));

  return {
    media: buildReviewMedia(),
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
      position: 1,
      remainingCount: Math.max(0, input.queueCardIds.length - 1),
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: input.showAnswer ?? false
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: input.answeredCount ?? 0,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildReviewMedia(): ReviewPageData["media"] {
  return {
    glossaryHref: "/glossary",
    href: "/",
    reviewHref: "/review",
    slug: "global-review",
    title: "Review globale"
  };
}

function buildFirstCandidateCard(id: string): ReviewFirstCandidateCard {
  const fullCard = buildQueueCard(id);

  return {
    back: fullCard.back,
    bucket: fullCard.bucket,
    bucketDetail: fullCard.bucketDetail,
    bucketLabel: fullCard.bucketLabel,
    createdAt: fullCard.createdAt,
    dueAt: fullCard.dueAt,
    dueLabel: fullCard.dueLabel,
    effectiveState: fullCard.effectiveState,
    effectiveStateLabel: fullCard.effectiveStateLabel,
    exampleIt: fullCard.exampleIt,
    exampleJp: fullCard.exampleJp,
    front: fullCard.front,
    href: fullCard.href,
    id: fullCard.id,
    mediaSlug: fullCard.mediaSlug,
    mediaTitle: fullCard.mediaTitle,
    notes: fullCard.notes,
    orderIndex: fullCard.orderIndex,
    rawReviewLabel: fullCard.rawReviewLabel,
    reading: fullCard.reading,
    reviewSeedState: fullCard.reviewSeedState,
    segmentTitle: fullCard.segmentTitle,
    typeLabel: fullCard.typeLabel
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
    dueLabel: "Scadenza 2026-04-02",
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
    reviewStateUpdatedAt: "2026-04-02T11:00:00.000Z",
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

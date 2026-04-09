"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEventHandler
} from "react";

import { submitKanjiClashAnswerAction } from "@/actions/kanji-clash";
import { getKanjiClashCurrentRound } from "@/lib/kanji-clash/queue";
import type {
  KanjiClashAnswerSubmissionPayload,
  KanjiClashPageData,
  KanjiClashQueueSnapshot,
  KanjiClashRoundSide,
  KanjiClashSessionActionResult,
  KanjiClashSessionRound
} from "@/lib/kanji-clash/types";

import {
  resolveKanjiClashRoundSideFromKey,
  resolveKanjiClashRoundSideFromSwipe,
  shouldIgnoreKanjiClashKeyboardTarget
} from "./kanji-clash-interactions";

const SWIPE_CLICK_SUPPRESSION_MS = 350;

type ControllerState = {
  committedQueue: KanjiClashQueueSnapshot;
  feedback: KanjiClashRoundFeedback | null;
  isSelectionLocked: boolean;
  pendingSelectionSide: KanjiClashRoundSide | null;
  visibleQueue: KanjiClashQueueSnapshot;
};

export type KanjiClashRoundFeedback = {
  answeredRound: KanjiClashSessionRound;
  correctSubjectKey: string;
  nextRound: KanjiClashSessionRound | null;
  selectedSubjectKey: string;
  selectedSide: KanjiClashRoundSide;
  status: "correct" | "incorrect";
};

export type KanjiClashRoundControllerResult = {
  clientError: string | null;
  currentRound: KanjiClashSessionRound | null;
  feedback: KanjiClashRoundFeedback | null;
  handleChooseSide: (side: KanjiClashRoundSide) => void;
  handleContinue: () => void;
  handleTouchEnd: TouchEventHandler<HTMLElement>;
  handleTouchStart: TouchEventHandler<HTMLElement>;
  isSelectionLocked: boolean;
  liveMessage: string | null;
  pendingSelectionSide: KanjiClashRoundSide | null;
  queue: KanjiClashQueueSnapshot;
};

type TouchPoint = {
  x: number;
  y: number;
};

function createInitialControllerState(
  queue: KanjiClashQueueSnapshot
): ControllerState {
  return {
    committedQueue: queue,
    feedback: null,
    isSelectionLocked: false,
    pendingSelectionSide: null,
    visibleQueue: queue
  };
}

export function useKanjiClashRoundController(
  data: KanjiClashPageData
): KanjiClashRoundControllerResult {
  const [controllerState, setControllerState] = useState<ControllerState>(() =>
    createInitialControllerState(data.queue)
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const controllerStateRef = useRef(controllerState);
  const suppressNextClickRef = useRef(false);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const selectedMediaId = data.selectedMedia?.id ?? null;

  const commitControllerState = useCallback((nextState: ControllerState) => {
    controllerStateRef.current = nextState;
    setControllerState(nextState);
  }, []);

  useEffect(() => {
    controllerStateRef.current = controllerState;
  }, [controllerState]);

  const advanceVisibleQueue = useCallback(() => {
    const currentState = controllerStateRef.current;

    commitControllerState({
      ...currentState,
      feedback: null,
      isSelectionLocked: false,
      pendingSelectionSide: null,
      visibleQueue: currentState.committedQueue
    });
  }, [commitControllerState]);

  const submitSide = useCallback(
    async (side: KanjiClashRoundSide) => {
      const currentState = controllerStateRef.current;

      if (currentState.isSelectionLocked) {
        return;
      }

      const currentRound = getKanjiClashCurrentRound(currentState.visibleQueue);

      if (!currentRound) {
        return;
      }

      const chosenSubjectKey =
        side === "left"
          ? currentRound.leftSubjectKey
          : currentRound.rightSubjectKey;

      commitControllerState({
        ...currentState,
        isSelectionLocked: true,
        pendingSelectionSide: side
      });
      setClientError(null);
      setLiveMessage(null);

      const startedAt = performance.now();

      try {
        const result = await submitKanjiClashAnswerAction(
          buildKanjiClashAnswerSubmissionPayload({
            chosenSubjectKey,
            currentRound,
            queue: currentState.committedQueue,
            responseMs: performance.now() - startedAt,
            selectedMediaId
          })
        );

        if (result.isCorrect) {
          commitControllerState({
            committedQueue: result.nextQueue,
            feedback: null,
            isSelectionLocked: false,
            pendingSelectionSide: null,
            visibleQueue: result.nextQueue
          });
          setLiveMessage(
            result.nextRound
              ? "Risposta corretta. Round successivo caricato."
              : "Risposta corretta. Sessione completata."
          );
          return;
        }

        commitControllerState(
          createIncorrectAnswerControllerState(currentState, result, side)
        );
      } catch (error) {
        commitControllerState({
          ...controllerStateRef.current,
          feedback: null,
          isSelectionLocked: false,
          pendingSelectionSide: null
        });
        setClientError(
          error instanceof Error
            ? error.message
            : "Impossibile salvare la risposta."
        );
        setLiveMessage("Errore durante il salvataggio della risposta.");
      }
    },
    [commitControllerState, selectedMediaId]
  );

  const handleChooseSide = useCallback(
    (side: KanjiClashRoundSide) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      void submitSide(side);
    },
    [submitSide]
  );

  const handleContinue = useCallback(() => {
    if (controllerStateRef.current.feedback?.status !== "incorrect") {
      return;
    }

    setClientError(null);
    setLiveMessage(null);
    advanceVisibleQueue();
  }, [advanceVisibleQueue]);

  const handleTouchStart = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (controllerStateRef.current.isSelectionLocked) {
        return;
      }

      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY
      };
    },
    []
  );

  const handleTouchEnd = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      const start = touchStartRef.current;

      touchStartRef.current = null;

      if (!start || controllerStateRef.current.isSelectionLocked) {
        return;
      }

      const touch = event.changedTouches[0];

      if (!touch) {
        return;
      }

      const side = resolveKanjiClashRoundSideFromSwipe(
        touch.clientX - start.x,
        touch.clientY - start.y
      );

      if (!side) {
        return;
      }

      event.preventDefault();
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, SWIPE_CLICK_SUPPRESSION_MS);
      void submitSide(side);
    },
    [submitSide]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        controllerStateRef.current.isSelectionLocked ||
        shouldIgnoreKanjiClashKeyboardTarget(event.target)
      ) {
        return;
      }

      const side = resolveKanjiClashRoundSideFromKey(event.key);

      if (!side) {
        return;
      }

      event.preventDefault();
      void submitSide(side);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [submitSide]);

  return {
    clientError,
    currentRound: getKanjiClashCurrentRound(controllerState.visibleQueue),
    feedback: controllerState.feedback,
    handleChooseSide,
    handleContinue,
    handleTouchEnd,
    handleTouchStart,
    isSelectionLocked: controllerState.isSelectionLocked,
    liveMessage,
    pendingSelectionSide: controllerState.pendingSelectionSide,
    queue: controllerState.visibleQueue
  };
}

function buildKanjiClashAnswerSubmissionPayload(input: {
  chosenSubjectKey: string;
  currentRound: KanjiClashSessionRound;
  queue: KanjiClashQueueSnapshot;
  responseMs: number;
  selectedMediaId: string | null;
}): KanjiClashAnswerSubmissionPayload & { responseMs: number } {
  return {
    chosenSubjectKey: input.chosenSubjectKey,
    dailyNewLimit: input.queue.dailyNewLimit,
    expectedPairKey: input.currentRound.pairKey,
    expectedPairStateUpdatedAt: input.currentRound.pairState?.updatedAt ?? null,
    mediaIds: input.selectedMediaId ? [input.selectedMediaId] : [],
    mode: input.queue.mode,
    requestedSize: input.queue.requestedSize,
    responseMs: input.responseMs,
    scope: input.queue.scope,
    seenPairKeys: input.queue.seenPairKeys,
    snapshotAtIso: input.queue.snapshotAtIso
  };
}

function createIncorrectAnswerControllerState(
  currentState: ControllerState,
  result: KanjiClashSessionActionResult,
  selectedSide: KanjiClashRoundSide
): ControllerState {
  return {
    committedQueue: result.nextQueue,
    feedback: {
      answeredRound: result.answeredRound,
      correctSubjectKey: result.answeredRound.correctSubjectKey,
      nextRound: result.nextRound,
      selectedSubjectKey: result.selectedSubjectKey,
      selectedSide,
      status: "incorrect"
    },
    isSelectionLocked: true,
    pendingSelectionSide: null,
    visibleQueue: currentState.visibleQueue
  };
}

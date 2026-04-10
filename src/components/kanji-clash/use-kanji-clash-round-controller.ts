"use client";

import {
  useCallback,
  useEffect,
  useReducer,
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
  KanjiClashSessionRound
} from "@/lib/kanji-clash/types";

import {
  createInitialKanjiClashRoundControllerState,
  reduceKanjiClashRoundControllerState,
  type KanjiClashRoundFeedback
} from "./kanji-clash-round-controller-state";
import { resolveKanjiClashSubmitLiveMessage } from "./kanji-clash-round-live-message";
import { useKanjiClashRoundInputs } from "./kanji-clash-round-inputs";

export type { KanjiClashRoundFeedback } from "./kanji-clash-round-controller-state";

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

export function useKanjiClashRoundController(
  data: KanjiClashPageData
): KanjiClashRoundControllerResult {
  const [controllerState, dispatch] = useReducer(
    reduceKanjiClashRoundControllerState,
    createInitialKanjiClashRoundControllerState(data.queue, data.queueToken)
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const controllerStateRef = useRef(controllerState);

  useEffect(() => {
    controllerStateRef.current = controllerState;
  }, [controllerState]);

  const submitSide = useCallback(async (side: KanjiClashRoundSide) => {
    const currentState = controllerStateRef.current;

    if (currentState.phase.kind !== "idle") {
      return;
    }

    const currentRound = getKanjiClashCurrentRound(currentState.visibleQueue);

    if (!currentRound) {
      return;
    }

    dispatch({
      side,
      type: "choose-side"
    });
    setClientError(null);
    setLiveMessage(null);

    const startedAt = performance.now();

    try {
      const result = await submitKanjiClashAnswerAction(
        buildKanjiClashAnswerSubmissionPayload({
          currentRound,
          queueToken: currentState.committedQueueToken,
          responseMs: performance.now() - startedAt,
          selectedSide: side
        })
      );

      dispatch({
        result,
        selectedSide: side,
        type: "submit-succeeded"
      });
      const liveMessage = resolveKanjiClashSubmitLiveMessage(result);

      if (liveMessage) {
        setLiveMessage(liveMessage);
      }
    } catch (error) {
      dispatch({
        type: "submit-failed"
      });
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile salvare la risposta."
      );
      setLiveMessage("Errore durante il salvataggio della risposta.");
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (controllerStateRef.current.phase.kind !== "incorrect-review") {
      return;
    }

    setClientError(null);
    setLiveMessage(null);
    dispatch({
      type: "continue-after-incorrect"
    });
  }, []);

  const { handleChooseSide, handleTouchEnd, handleTouchStart } =
    useKanjiClashRoundInputs({
      isSelectionLocked: controllerState.phase.kind !== "idle",
      onChooseSide: submitSide
    });

  return {
    clientError,
    currentRound: getKanjiClashCurrentRound(controllerState.visibleQueue),
    feedback:
      controllerState.phase.kind === "incorrect-review"
        ? controllerState.phase.feedback
        : null,
    handleChooseSide,
    handleContinue,
    handleTouchEnd,
    handleTouchStart,
    isSelectionLocked: controllerState.phase.kind !== "idle",
    liveMessage,
    pendingSelectionSide:
      controllerState.phase.kind === "submitting"
        ? controllerState.phase.selectedSide
        : null,
    queue: controllerState.visibleQueue
  };
}

function buildKanjiClashAnswerSubmissionPayload(input: {
  currentRound: KanjiClashSessionRound;
  queueToken: string;
  responseMs: number;
  selectedSide: KanjiClashRoundSide;
}): KanjiClashAnswerSubmissionPayload & { responseMs: number } {
  return {
    expectedPairKey: input.currentRound.pairKey,
    expectedPairStateUpdatedAt: input.currentRound.pairState?.updatedAt ?? null,
    queueToken: input.queueToken,
    responseMs: input.responseMs,
    selectedSide: input.selectedSide
  };
}

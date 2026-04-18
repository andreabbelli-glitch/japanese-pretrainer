"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
  type TouchEventHandler
} from "react";

import {
  archiveKanjiClashManualContrastAction,
  restoreKanjiClashManualContrastAction,
  submitKanjiClashAnswerAction
} from "@/actions/kanji-clash";
import { getKanjiClashCurrentRound } from "@/lib/kanji-clash/queue";
import type {
  KanjiClashAnswerSubmissionPayload,
  KanjiClashManualContrastSummary,
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
  activeManualContrasts: KanjiClashManualContrastSummary[];
  archivedManualContrasts: KanjiClashManualContrastSummary[];
  archivePendingContrastKey: string | null;
  clientError: string | null;
  currentRound: KanjiClashSessionRound | null;
  feedback: KanjiClashRoundFeedback | null;
  handleArchiveManualContrast: (contrastKey: string) => void;
  handleChooseSide: (side: KanjiClashRoundSide) => void;
  handleContinue: () => void;
  handleRestoreManualContrast: (contrastKey: string) => void;
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
  const [archivePendingContrastKey, setArchivePendingContrastKey] = useState<
    string | null
  >(null);
  const [isArchivePending, startArchiveTransition] = useTransition();
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

  const runManualContrastMutation = useCallback(
    (contrastKey: string, action: "archive" | "restore") => {
      if (!contrastKey.trim()) {
        return;
      }

      startArchiveTransition(async () => {
        try {
          setClientError(null);
          setLiveMessage(null);
          setArchivePendingContrastKey(contrastKey);

          if (action === "archive") {
            await archiveKanjiClashManualContrastAction({
              contrastKey
            });
          } else {
            await restoreKanjiClashManualContrastAction({
              contrastKey
            });
          }

          if (typeof window !== "undefined") {
            window.location.reload();
          }
        } catch (error) {
          setClientError(
            error instanceof Error
              ? error.message
              : "Impossibile aggiornare il contrasto manuale."
          );
        } finally {
          setArchivePendingContrastKey(null);
        }
      });
    },
    []
  );

  const { handleChooseSide, handleTouchEnd, handleTouchStart } =
    useKanjiClashRoundInputs({
      isSelectionLocked:
        controllerState.phase.kind !== "idle" || isArchivePending,
      onChooseSide: submitSide
    });

  return {
    activeManualContrasts: data.manualContrasts.filter(
      (contrast) => contrast.status === "active"
    ),
    archivedManualContrasts: data.manualContrasts.filter(
      (contrast) => contrast.status === "archived"
    ),
    archivePendingContrastKey,
    clientError,
    currentRound: getKanjiClashCurrentRound(controllerState.visibleQueue),
    feedback:
      controllerState.phase.kind === "incorrect-review"
        ? controllerState.phase.feedback
        : null,
    handleArchiveManualContrast: (contrastKey: string) => {
      runManualContrastMutation(contrastKey, "archive");
    },
    handleChooseSide,
    handleContinue,
    handleRestoreManualContrast: (contrastKey: string) => {
      runManualContrastMutation(contrastKey, "restore");
    },
    handleTouchEnd,
    handleTouchStart,
    isSelectionLocked:
      controllerState.phase.kind !== "idle" || isArchivePending,
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
    expectedRoundKey: input.currentRound.roundKey,
    queueToken: input.queueToken,
    responseMs: input.responseMs,
    selectedSide: input.selectedSide
  };
}

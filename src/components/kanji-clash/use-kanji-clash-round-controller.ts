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
import { useRouter } from "next/navigation";

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
import { createKanjiClashRoundResponseTimer } from "./kanji-clash-response-timing";
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
  manualContrastStatusByKey: Record<
    string,
    KanjiClashManualContrastSummary["status"]
  >;
  pendingSelectionSide: KanjiClashRoundSide | null;
  queue: KanjiClashQueueSnapshot;
};

export function useKanjiClashRoundController(
  data: KanjiClashPageData
): KanjiClashRoundControllerResult {
  const router = useRouter();
  const [controllerState, dispatch] = useReducer(
    reduceKanjiClashRoundControllerState,
    createInitialKanjiClashRoundControllerState(data.queue, data.queueToken)
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [manualContrasts, setManualContrasts] = useState(data.manualContrasts);
  const [archivePendingContrastKey, setArchivePendingContrastKey] = useState<
    string | null
  >(null);
  const [isArchivePending, startArchiveTransition] = useTransition();
  const controllerStateRef = useRef(controllerState);
  const responseTimerRef = useRef(createKanjiClashRoundResponseTimer());

  useEffect(() => {
    controllerStateRef.current = controllerState;
  }, [controllerState]);

  useEffect(() => {
    setManualContrasts(data.manualContrasts);
  }, [data.manualContrasts]);

  const currentRound = getKanjiClashCurrentRound(controllerState.visibleQueue);
  const currentRoundKey = currentRound?.roundKey ?? null;

  useEffect(() => {
    if (controllerState.phase.kind !== "idle" || !currentRoundKey) {
      return;
    }

    responseTimerRef.current.markRoundPresented(currentRoundKey, performance.now());
  }, [controllerState.phase.kind, currentRoundKey]);

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

    const submittedAt = performance.now();
    const responseMs = responseTimerRef.current.getResponseMs(submittedAt);

    try {
      const result = await submitKanjiClashAnswerAction(
        buildKanjiClashAnswerSubmissionPayload({
          currentRound,
          queueToken: currentState.committedQueueToken,
          responseMs,
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

          setManualContrasts((currentContrasts) =>
            currentContrasts.map((contrast) =>
              contrast.contrastKey === contrastKey
                ? {
                    ...contrast,
                    status: action === "archive" ? "archived" : "active"
                  }
                : contrast
            )
          );
          router.refresh();
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
    [router]
  );

  const activeManualContrasts = manualContrasts.filter(
    (contrast) => contrast.status === "active"
  );
  const archivedManualContrasts = manualContrasts.filter(
    (contrast) => contrast.status === "archived"
  );
  const manualContrastStatusByKey = Object.fromEntries(
    manualContrasts.map((contrast) => [contrast.contrastKey, contrast.status])
  ) satisfies Record<string, KanjiClashManualContrastSummary["status"]>;

  const { handleChooseSide, handleTouchEnd, handleTouchStart } =
    useKanjiClashRoundInputs({
      isSelectionLocked:
        controllerState.phase.kind !== "idle" || isArchivePending,
      onChooseSide: submitSide
    });

  return {
    activeManualContrasts,
    archivedManualContrasts,
    archivePendingContrastKey,
    clientError,
    currentRound,
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
    manualContrastStatusByKey,
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
  responseMs: number | null;
  selectedSide: KanjiClashRoundSide;
}): KanjiClashAnswerSubmissionPayload & { responseMs: number | null } {
  return {
    expectedPairKey: input.currentRound.pairKey,
    expectedPairStateUpdatedAt: input.currentRound.pairState?.updatedAt ?? null,
    expectedRoundKey: input.currentRound.roundKey,
    queueToken: input.queueToken,
    responseMs: input.responseMs,
    selectedSide: input.selectedSide
  };
}

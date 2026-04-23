"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
  const bufferedAnswerRef = useRef<BufferedKanjiClashAnswerSubmission | null>(
    null
  );

  useEffect(() => {
    controllerStateRef.current = controllerState;
  }, [controllerState]);

  useEffect(() => {
    setManualContrasts(data.manualContrasts);
  }, [data.manualContrasts]);

  const currentRound = getKanjiClashCurrentRound(controllerState.visibleQueue);
  const currentRoundKey = currentRound?.roundKey ?? null;
  let pendingSelectionSide: KanjiClashRoundSide | null = null;

  if (controllerState.phase.kind === "submitting") {
    if (controllerState.phase.submittedRoundKey === currentRoundKey) {
      pendingSelectionSide = controllerState.phase.selectedSide;
    } else if (
      controllerState.phase.bufferedAnswer?.roundKey === currentRoundKey
    ) {
      pendingSelectionSide = controllerState.phase.bufferedAnswer.selectedSide;
    }
  }

  const canSelectVisibleRound =
    currentRoundKey !== null &&
    (controllerState.phase.kind === "idle" ||
      (controllerState.phase.kind === "submitting" &&
        controllerState.phase.acceptsBufferedAnswer &&
        !controllerState.phase.bufferedAnswer &&
        controllerState.phase.submittedRoundKey !== currentRoundKey));
  const isSelectionLocked = !canSelectVisibleRound || isArchivePending;

  const submitAnswer = useCallback(async function submitAnswer(input: {
    currentRound: KanjiClashSessionRound;
    queueToken: string;
    responseMs: number | null;
    selectedSide: KanjiClashRoundSide;
  }): Promise<void> {
    try {
      const result = await submitKanjiClashAnswerAction(
        buildKanjiClashAnswerSubmissionPayload(input)
      );
      const bufferedAnswer = result.isCorrect ? bufferedAnswerRef.current : null;

      bufferedAnswerRef.current = null;
      dispatch({
        result,
        selectedSide: input.selectedSide,
        type: "submit-succeeded"
      });
      const liveMessage = resolveKanjiClashSubmitLiveMessage(result);

      if (liveMessage) {
        setLiveMessage(liveMessage);
      }

      if (!bufferedAnswer) {
        return;
      }

      const authoritativeRound = getKanjiClashCurrentRound(result.nextQueue);

      if (
        !authoritativeRound ||
        authoritativeRound.roundKey !== bufferedAnswer.currentRound.roundKey
      ) {
        return;
      }

      await submitAnswer({
        currentRound: authoritativeRound,
        queueToken: result.nextQueueToken,
        responseMs: bufferedAnswer.responseMs,
        selectedSide: bufferedAnswer.selectedSide
      });
    } catch (error) {
      bufferedAnswerRef.current = null;
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

  useEffect(() => {
    if (!currentRoundKey) {
      return;
    }

    responseTimerRef.current.markRoundPresented(
      currentRoundKey,
      performance.now()
    );
  }, [currentRoundKey]);

  const submitSide = useCallback(async (side: KanjiClashRoundSide) => {
    const currentState = controllerStateRef.current;

    const currentRound = getKanjiClashCurrentRound(currentState.visibleQueue);

    if (!currentRound) {
      return;
    }

    const submittedAt = performance.now();
    const responseMs = responseTimerRef.current.getResponseMs(submittedAt);

    if (currentState.phase.kind === "submitting") {
      if (
        !currentState.phase.acceptsBufferedAnswer ||
        currentState.phase.bufferedAnswer ||
        bufferedAnswerRef.current ||
        currentState.phase.submittedRoundKey === currentRound.roundKey
      ) {
        return;
      }

      bufferedAnswerRef.current = {
        currentRound,
        responseMs,
        selectedSide: side
      };
      dispatch({
        side,
        type: "choose-side"
      });
      setClientError(null);
      setLiveMessage(null);
      return;
    }

    if (currentState.phase.kind !== "idle") {
      return;
    }

    dispatch({
      side,
      type: "choose-side"
    });
    setClientError(null);
    setLiveMessage(null);

    await submitAnswer({
      currentRound,
      queueToken: currentState.committedQueueToken,
      responseMs,
      selectedSide: side
    });
  }, [submitAnswer]);

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

  const {
    activeManualContrasts,
    archivedManualContrasts,
    manualContrastStatusByKey
  } = useMemo(() => {
    const activeManualContrasts = manualContrasts.filter(
      (contrast) => contrast.status === "active"
    );
    const archivedManualContrasts = manualContrasts.filter(
      (contrast) => contrast.status === "archived"
    );
    const manualContrastStatusByKey = Object.fromEntries(
      manualContrasts.map((contrast) => [contrast.contrastKey, contrast.status])
    ) satisfies Record<string, KanjiClashManualContrastSummary["status"]>;

    return {
      activeManualContrasts,
      archivedManualContrasts,
      manualContrastStatusByKey
    };
  }, [manualContrasts]);

  const handleArchiveManualContrast = useCallback(
    (contrastKey: string) => {
      runManualContrastMutation(contrastKey, "archive");
    },
    [runManualContrastMutation]
  );

  const handleRestoreManualContrast = useCallback(
    (contrastKey: string) => {
      runManualContrastMutation(contrastKey, "restore");
    },
    [runManualContrastMutation]
  );

  const { handleChooseSide, handleTouchEnd, handleTouchStart } =
    useKanjiClashRoundInputs({
      isSelectionLocked,
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
    handleArchiveManualContrast,
    handleChooseSide,
    handleContinue,
    handleRestoreManualContrast,
    handleTouchEnd,
    handleTouchStart,
    isSelectionLocked,
    liveMessage,
    manualContrastStatusByKey,
    pendingSelectionSide,
    queue: controllerState.visibleQueue
  };
}

type BufferedKanjiClashAnswerSubmission = {
  currentRound: KanjiClashSessionRound;
  responseMs: number | null;
  selectedSide: KanjiClashRoundSide;
};

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

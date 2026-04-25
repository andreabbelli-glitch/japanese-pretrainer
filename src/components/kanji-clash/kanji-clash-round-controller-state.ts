"use client";

import type {
  KanjiClashQueueSnapshot,
  KanjiClashRoundSide,
  KanjiClashSessionActionResult
} from "@/features/kanji-clash/types";
import {
  advanceKanjiClashQueueSnapshot,
  getKanjiClashCurrentRound
} from "@/features/kanji-clash/model/queue";

export type KanjiClashRoundFeedback = {
  answeredRound: KanjiClashSessionActionResult["answeredRound"];
  correctSubjectKey: string;
  nextRound: KanjiClashSessionActionResult["nextRound"];
  selectedSubjectKey: string;
  selectedSide: KanjiClashRoundSide;
  status: "correct" | "incorrect";
};

export type KanjiClashBufferedRoundAnswer = {
  roundKey: string;
  selectedSide: KanjiClashRoundSide;
};

export type KanjiClashRoundControllerPhase =
  | {
      kind: "idle";
    }
  | {
      kind: "incorrect-review";
      feedback: KanjiClashRoundFeedback;
    }
  | {
      acceptsBufferedAnswer: boolean;
      bufferedAnswer: KanjiClashBufferedRoundAnswer | null;
      kind: "submitting";
      submittedRoundKey: string;
      selectedSide: KanjiClashRoundSide;
    };

export type KanjiClashRoundControllerState = {
  committedQueue: KanjiClashQueueSnapshot;
  committedQueueToken: string;
  phase: KanjiClashRoundControllerPhase;
  visibleQueue: KanjiClashQueueSnapshot;
};

export type KanjiClashRoundControllerAction =
  | {
      side: KanjiClashRoundSide;
      type: "choose-side";
    }
  | {
      result: KanjiClashSessionActionResult;
      selectedSide: KanjiClashRoundSide;
      type: "submit-succeeded";
    }
  | {
      type: "submit-failed";
    }
  | {
      type: "continue-after-incorrect";
    };

export function createInitialKanjiClashRoundControllerState(
  queue: KanjiClashQueueSnapshot,
  queueToken: string
): KanjiClashRoundControllerState {
  return {
    committedQueue: queue,
    committedQueueToken: queueToken,
    phase: {
      kind: "idle"
    },
    visibleQueue: queue
  };
}

export function reduceKanjiClashRoundControllerState(
  state: KanjiClashRoundControllerState,
  action: KanjiClashRoundControllerAction
): KanjiClashRoundControllerState {
  switch (action.type) {
    case "choose-side":
      const currentRound = getKanjiClashCurrentRound(state.visibleQueue);

      if (!currentRound) {
        return state;
      }

      if (state.phase.kind === "submitting") {
        if (
          !state.phase.acceptsBufferedAnswer ||
          state.phase.bufferedAnswer ||
          state.phase.submittedRoundKey === currentRound.roundKey
        ) {
          return state;
        }

        return {
          ...state,
          phase: {
            ...state.phase,
            bufferedAnswer: {
              roundKey: currentRound.roundKey,
              selectedSide: action.side
            }
          }
        };
      }

      if (state.phase.kind !== "idle") {
        return state;
      }

      const selectedSubjectKey =
        action.side === "left"
          ? currentRound.leftSubjectKey
          : currentRound.rightSubjectKey;
      const nextVisibleQueue =
        selectedSubjectKey === currentRound.correctSubjectKey
          ? advanceKanjiClashQueueSnapshot(
              state.visibleQueue,
              currentRound.roundKey,
              {
                awaitingConfirmation: true
              }
            )
          : state.visibleQueue;

      return {
        ...state,
        phase: {
          acceptsBufferedAnswer: true,
          bufferedAnswer: null,
          kind: "submitting",
          submittedRoundKey: currentRound.roundKey,
          selectedSide: action.side
        },
        visibleQueue: nextVisibleQueue
      };
    case "submit-succeeded":
      if (state.phase.kind !== "submitting") {
        return state;
      }

      if (action.result.isCorrect && state.phase.bufferedAnswer) {
        return buildBufferedSubmissionState(
          action.result,
          state.phase.bufferedAnswer
        );
      }

      if (action.result.isCorrect) {
        return {
          committedQueue: action.result.nextQueue,
          committedQueueToken: action.result.nextQueueToken,
          phase: {
            kind: "idle"
          },
          visibleQueue: action.result.nextQueue
        };
      }

      return {
        committedQueue: action.result.nextQueue,
        committedQueueToken: action.result.nextQueueToken,
        phase: {
          feedback: buildIncorrectAnswerFeedback(action),
          kind: "incorrect-review"
        },
        visibleQueue: state.visibleQueue
      };
    case "submit-failed":
      if (state.phase.kind !== "submitting") {
        return state;
      }

      return {
        ...state,
        phase: {
          kind: "idle"
        },
        visibleQueue: state.committedQueue
      };
    case "continue-after-incorrect":
      if (state.phase.kind !== "incorrect-review") {
        return state;
      }

      return {
        ...state,
        phase: {
          kind: "idle"
        },
        visibleQueue: state.committedQueue
      };
  }

  return state;
}

function buildBufferedSubmissionState(
  result: KanjiClashSessionActionResult,
  bufferedAnswer: KanjiClashBufferedRoundAnswer
): KanjiClashRoundControllerState {
  const currentRound = getKanjiClashCurrentRound(result.nextQueue);

  if (!currentRound || currentRound.roundKey !== bufferedAnswer.roundKey) {
    return {
      committedQueue: result.nextQueue,
      committedQueueToken: result.nextQueueToken,
      phase: {
        kind: "idle"
      },
      visibleQueue: result.nextQueue
    };
  }

  const selectedSubjectKey =
    bufferedAnswer.selectedSide === "left"
      ? currentRound.leftSubjectKey
      : currentRound.rightSubjectKey;
  const visibleQueue =
    selectedSubjectKey === currentRound.correctSubjectKey
      ? advanceKanjiClashQueueSnapshot(
          result.nextQueue,
          currentRound.roundKey,
          {
            awaitingConfirmation: true
          }
        )
      : result.nextQueue;

  return {
    committedQueue: result.nextQueue,
    committedQueueToken: result.nextQueueToken,
    phase: {
      acceptsBufferedAnswer: false,
      bufferedAnswer: null,
      kind: "submitting",
      submittedRoundKey: currentRound.roundKey,
      selectedSide: bufferedAnswer.selectedSide
    },
    visibleQueue
  };
}

function buildIncorrectAnswerFeedback(
  action: Extract<KanjiClashRoundControllerAction, { type: "submit-succeeded" }>
): KanjiClashRoundFeedback {
  return {
    answeredRound: action.result.answeredRound,
    correctSubjectKey: action.result.answeredRound.correctSubjectKey,
    nextRound: action.result.nextRound,
    selectedSubjectKey: action.result.selectedSubjectKey,
    selectedSide: action.selectedSide,
    status: "incorrect"
  };
}

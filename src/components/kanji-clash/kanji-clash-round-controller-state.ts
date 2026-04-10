"use client";

import type {
  KanjiClashQueueSnapshot,
  KanjiClashRoundSide,
  KanjiClashSessionActionResult
} from "@/lib/kanji-clash/types";

export type KanjiClashRoundFeedback = {
  answeredRound: KanjiClashSessionActionResult["answeredRound"];
  correctSubjectKey: string;
  nextRound: KanjiClashSessionActionResult["nextRound"];
  selectedSubjectKey: string;
  selectedSide: KanjiClashRoundSide;
  status: "correct" | "incorrect";
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
      kind: "submitting";
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
      if (state.phase.kind !== "idle") {
        return state;
      }

      return {
        ...state,
        phase: {
          kind: "submitting",
          selectedSide: action.side
        }
      };
    case "submit-succeeded":
      if (state.phase.kind !== "submitting") {
        return state;
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
        }
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

import { describe, expect, it } from "vitest";

import {
  createInitialKanjiClashRoundControllerState,
  reduceKanjiClashRoundControllerState
} from "@/components/kanji-clash/kanji-clash-round-controller-state";
import { getKanjiClashCurrentRound } from "@/features/kanji-clash/model/queue";

import {
  buildKanjiClashQueue,
  buildKanjiClashSessionActionResult
} from "./helpers/kanji-clash-test-data";

describe("kanji clash round controller state", () => {
  it("locks on a selected visible round and ignores repeated chooses while submitting", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "right",
      type: "choose-side"
    });

    expect(submittingState.phase.kind).toBe("submitting");
    if (submittingState.phase.kind === "submitting") {
      expect(submittingState.phase.selectedSide).toBe("right");
    }
    expect(
      reduceKanjiClashRoundControllerState(submittingState, {
        side: "left",
        type: "choose-side"
      })
    ).toBe(submittingState);
  });

  it("commits the next queue immediately for correct answers", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });
    const result = buildKanjiClashSessionActionResult({
      isCorrect: true
    });

    const nextState = reduceKanjiClashRoundControllerState(submittingState, {
      result,
      selectedSide: "left",
      type: "submit-succeeded"
    });

    expect(nextState.phase.kind).toBe("idle");
    expect(nextState.committedQueue).toBe(result.nextQueue);
    expect(nextState.visibleQueue).toBe(result.nextQueue);
    expect(getKanjiClashCurrentRound(nextState.visibleQueue)?.pairKey).toBe(
      "pair-2"
    );
  });

  it("optimistically advances the visible queue only for locally correct answers", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );

    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });

    expect(submittingState.phase.kind).toBe("submitting");
    expect(submittingState.committedQueue).toBe(initialState.committedQueue);
    expect(submittingState.committedQueueToken).toBe("token-1");
    expect(submittingState.visibleQueue).not.toBe(initialState.visibleQueue);
    expect(submittingState.visibleQueue.awaitingConfirmation).toBe(true);
    expect(
      getKanjiClashCurrentRound(submittingState.visibleQueue)?.pairKey
    ).toBe("pair-2");
  });

  it("buffers one answer on an optimistically visible next round", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });

    const bufferedState = reduceKanjiClashRoundControllerState(
      submittingState,
      {
        side: "left",
        type: "choose-side"
      }
    );

    expect(bufferedState.phase.kind).toBe("submitting");
    if (bufferedState.phase.kind === "submitting") {
      expect(bufferedState.phase.bufferedAnswer).toEqual({
        roundKey: "pair-2",
        selectedSide: "left"
      });
    }
    expect(
      reduceKanjiClashRoundControllerState(bufferedState, {
        side: "right",
        type: "choose-side"
      })
    ).toBe(bufferedState);
  });

  it("submits a buffered answer from the authoritative queue after the prior correct ack", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });
    const bufferedState = reduceKanjiClashRoundControllerState(
      submittingState,
      {
        side: "left",
        type: "choose-side"
      }
    );
    const result = buildKanjiClashSessionActionResult({
      isCorrect: true
    });

    const nextState = reduceKanjiClashRoundControllerState(bufferedState, {
      result,
      selectedSide: "left",
      type: "submit-succeeded"
    });

    expect(nextState.committedQueue).toBe(result.nextQueue);
    expect(nextState.committedQueueToken).toBe("token-2");
    expect(nextState.phase.kind).toBe("submitting");
    if (nextState.phase.kind === "submitting") {
      expect(nextState.phase.acceptsBufferedAnswer).toBe(false);
      expect(nextState.phase.bufferedAnswer).toBeNull();
      expect(nextState.phase.submittedRoundKey).toBe("pair-2");
      expect(nextState.phase.selectedSide).toBe("left");
    }
    expect(nextState.visibleQueue.awaitingConfirmation).toBe(true);
  });

  it("keeps an incorrect buffered answer in review until continue", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });
    const bufferedState = reduceKanjiClashRoundControllerState(
      submittingState,
      {
        side: "right",
        type: "choose-side"
      }
    );
    const firstResult = buildKanjiClashSessionActionResult({
      isCorrect: true
    });
    const bufferedSubmittingState = reduceKanjiClashRoundControllerState(
      bufferedState,
      {
        result: firstResult,
        selectedSide: "left",
        type: "submit-succeeded"
      }
    );
    const secondResult = buildKanjiClashSessionActionResult({
      isCorrect: false,
      nextQueue: buildKanjiClashQueue(2)
    });

    const incorrectState = reduceKanjiClashRoundControllerState(
      bufferedSubmittingState,
      {
        result: secondResult,
        selectedSide: "right",
        type: "submit-succeeded"
      }
    );

    expect(incorrectState.phase.kind).toBe("incorrect-review");
    expect(
      getKanjiClashCurrentRound(incorrectState.visibleQueue)?.pairKey
    ).toBe("pair-2");
    expect(incorrectState.committedQueue).toBe(secondResult.nextQueue);

    const continuedState = reduceKanjiClashRoundControllerState(
      incorrectState,
      {
        type: "continue-after-incorrect"
      }
    );

    expect(continuedState.phase.kind).toBe("idle");
    expect(continuedState.visibleQueue).toBe(secondResult.nextQueue);
  });

  it("keeps the visible queue on incorrect answers until continue", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "right",
      type: "choose-side"
    });
    const result = buildKanjiClashSessionActionResult({
      isCorrect: false
    });

    const incorrectState = reduceKanjiClashRoundControllerState(
      submittingState,
      {
        result,
        selectedSide: "right",
        type: "submit-succeeded"
      }
    );

    expect(incorrectState.phase.kind).toBe("incorrect-review");
    if (incorrectState.phase.kind === "incorrect-review") {
      expect(incorrectState.phase.feedback.selectedSide).toBe("right");
      expect(incorrectState.phase.feedback.correctSubjectKey).toBe("subject-1");
    }
    expect(incorrectState.committedQueue).toBe(result.nextQueue);
    expect(incorrectState.visibleQueue).toBe(initialState.visibleQueue);
    expect(
      getKanjiClashCurrentRound(incorrectState.visibleQueue)?.pairKey
    ).toBe("pair-1");

    const continuedState = reduceKanjiClashRoundControllerState(
      incorrectState,
      {
        type: "continue-after-incorrect"
      }
    );

    expect(continuedState.phase.kind).toBe("idle");
    expect(continuedState.visibleQueue).toBe(continuedState.committedQueue);
    expect(
      getKanjiClashCurrentRound(continuedState.visibleQueue)?.pairKey
    ).toBe("pair-2");
  });

  it("resets a failed submission back to idle and rolls back to the committed queue", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });

    const bufferedState = reduceKanjiClashRoundControllerState(
      submittingState,
      {
        side: "left",
        type: "choose-side"
      }
    );

    const failedState = reduceKanjiClashRoundControllerState(bufferedState, {
      type: "submit-failed"
    });

    expect(failedState.phase.kind).toBe("idle");
    expect(failedState.visibleQueue).toBe(initialState.visibleQueue);
    expect(failedState.committedQueue).toBe(initialState.committedQueue);
  });
});

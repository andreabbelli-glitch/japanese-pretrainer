import { describe, expect, it } from "vitest";

import {
  createInitialKanjiClashRoundControllerState,
  reduceKanjiClashRoundControllerState
} from "@/components/kanji-clash/kanji-clash-round-controller-state";
import { getKanjiClashCurrentRound } from "@/lib/kanji-clash/queue";

import {
  buildKanjiClashQueue,
  buildKanjiClashSessionActionResult
} from "./helpers/kanji-clash-test-data";

describe("kanji clash round controller state", () => {
  it("locks on a selection and ignores repeated chooses while submitting", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });

    expect(submittingState.phase.kind).toBe("submitting");
    if (submittingState.phase.kind === "submitting") {
      expect(submittingState.phase.selectedSide).toBe("left");
    }
    expect(
      reduceKanjiClashRoundControllerState(submittingState, {
        side: "right",
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

  it("resets a failed submission back to idle without changing the queue", () => {
    const initialState = createInitialKanjiClashRoundControllerState(
      buildKanjiClashQueue(0),
      "token-1"
    );
    const submittingState = reduceKanjiClashRoundControllerState(initialState, {
      side: "left",
      type: "choose-side"
    });

    const failedState = reduceKanjiClashRoundControllerState(submittingState, {
      type: "submit-failed"
    });

    expect(failedState.phase.kind).toBe("idle");
    expect(failedState.visibleQueue).toBe(initialState.visibleQueue);
    expect(failedState.committedQueue).toBe(initialState.committedQueue);
  });
});

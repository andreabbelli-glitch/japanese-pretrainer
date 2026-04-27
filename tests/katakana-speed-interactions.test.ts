import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchWindowKeyboardEvent,
  installMinimalDom,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

const mocks = vi.hoisted(() => ({
  aggregateKatakanaSpeedExerciseResultAction: vi.fn(),
  submitKatakanaSpeedAnswerAction: vi.fn(),
  submitKatakanaSpeedSelfCheckAction: vi.fn()
}));

vi.mock("@/actions/katakana-speed", () => ({
  aggregateKatakanaSpeedExerciseResultAction:
    mocks.aggregateKatakanaSpeedExerciseResultAction,
  submitKatakanaSpeedAnswerAction: mocks.submitKatakanaSpeedAnswerAction,
  submitKatakanaSpeedSelfCheckAction: mocks.submitKatakanaSpeedSelfCheckAction
}));

import type { KatakanaSpeedSessionControllerResult } from "@/components/katakana-speed/use-katakana-speed-session-controller";
import { useKatakanaSpeedSessionController } from "@/components/katakana-speed/use-katakana-speed-session-controller";
import type { StartKatakanaSpeedSessionResult } from "@/features/katakana-speed/server";

describe("katakana speed session controller", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.aggregateKatakanaSpeedExerciseResultAction.mockReset();
    mocks.submitKatakanaSpeedAnswerAction.mockReset();
    mocks.submitKatakanaSpeedSelfCheckAction.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("submits option choices from 1-4 keys and records response time", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedAnswerAction.mockResolvedValue({
      errorTags: [],
      idempotent: false,
      isCorrect: true
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    const session = buildSession();

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session }));
      await Promise.resolve();
    });

    now = 1_420;
    await act(async () => {
      dispatchWindowKeyboardEvent("1");
      await Promise.resolve();
    });

    expect(mocks.submitKatakanaSpeedAnswerAction).toHaveBeenCalledWith({
      inputMethod: "keyboard",
      responseMs: 420,
      sessionId: "session-keyboard",
      trialId: "trial-1",
      userAnswer: "ティ"
    });
    expect(latestController).not.toBeNull();
    const controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.feedback).toBeNull();
    expect(controller.currentTrial?.trialId).toBe("trial-2");
  });

  it("keeps an incorrect option choice on the same trial until continue", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedAnswerAction.mockResolvedValue({
      errorTags: ["confusion"],
      idempotent: false,
      isCorrect: false
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildSession() }));
      await Promise.resolve();
    });

    now = 1_500;
    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    let controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.feedback?.status).toBe("incorrect");
    expect(controller.awaitingContinue).toBe(true);
    expect(controller.currentTrial?.trialId).toBe("trial-1");

    await act(async () => {
      dispatchWindowKeyboardEvent("Enter");
      await Promise.resolve();
    });

    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(false);
    expect(controller.currentTrial?.trialId).toBe("trial-2");
  });

  it("resumes active sessions at the first unanswered trial", async () => {
    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController({
        ...props.session,
        answeredCount: 1
      });

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildSession() }));
      await Promise.resolve();
    });

    expect(latestController).not.toBeNull();
    const controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.currentIndex).toBe(1);
    expect(controller.currentTrial?.trialId).toBe("trial-2");
  });

  it("auto-runs timed self-check trials and auto-advances after a good rating", async () => {
    let now = 2_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedSelfCheckAction.mockResolvedValue({
      idempotent: false,
      isCorrect: true,
      selfRating: "hesitated"
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildSelfCheckSession() }));
      await Promise.resolve();
    });

    expect(latestController).not.toBeNull();
    let controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.timerState.phase).toBe("running");

    now = 3_240;
    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.timerState.phase).toBe("running");

    expect(mocks.submitKatakanaSpeedSelfCheckAction).toHaveBeenCalledWith({
      metricsJson: {
        durationMs: 1240,
        focusChunks: ["ティ"],
        mode: "pseudoword_sprint",
        moraCount: 4,
        msPerMora: 310
      },
      responseMs: 1240,
      selfRating: "hesitated",
      sessionId: "session-self-check",
      trialId: "trial-pseudo"
    });
    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(false);
    expect(controller.feedback).toBeNull();
    expect(controller.currentTrial?.trialId).toBe("trial-sentence");
  });

  it("keeps a wrong self-check rating on the same trial until continue", async () => {
    let now = 2_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedSelfCheckAction.mockResolvedValue({
      idempotent: false,
      isCorrect: false,
      selfRating: "wrong"
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildSelfCheckSession() }));
      await Promise.resolve();
    });

    now = 3_000;
    await act(async () => {
      dispatchWindowKeyboardEvent("3");
      await Promise.resolve();
    });

    let controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.feedback?.status).toBe("incorrect");
    expect(controller.awaitingContinue).toBe(true);
    expect(controller.currentTrial?.trialId).toBe("trial-pseudo");

    mocks.submitKatakanaSpeedSelfCheckAction.mockResolvedValue({
      idempotent: false,
      isCorrect: true,
      selfRating: "clean"
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("1");
      await Promise.resolve();
    });

    expect(mocks.submitKatakanaSpeedSelfCheckAction).toHaveBeenCalledTimes(1);
    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(true);
    expect(controller.currentTrial?.trialId).toBe("trial-pseudo");

    await act(async () => {
      dispatchWindowKeyboardEvent("Enter");
      await Promise.resolve();
    });

    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(false);
    expect(controller.currentTrial?.trialId).toBe("trial-sentence");
  });

  it("submits decoded raw-choice answers from keyboard shortcuts", async () => {
    let now = 4_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedAnswerAction.mockResolvedValue({
      errorTags: [],
      idempotent: false,
      isCorrect: true
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildRawChoiceSession() }));
      await Promise.resolve();
    });

    expect(
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).options.map((option) => option.surface)
    ).toEqual(["ティ", "チ"]);

    now = 4_380;
    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(mocks.submitKatakanaSpeedAnswerAction).toHaveBeenCalledWith({
      inputMethod: "keyboard",
      responseMs: 380,
      sessionId: "session-raw-choice",
      trialId: "trial-raw-choice",
      userAnswer: "チ"
    });
  });

  it("submits inverse romaji choices without exposing option readings", async () => {
    let now = 5_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedAnswerAction.mockResolvedValue({
      errorTags: [],
      idempotent: false,
      isCorrect: true
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(
        createElement(Probe, { session: buildInverseChoiceSession() })
      );
      await Promise.resolve();
    });

    const controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.currentTrial?.promptSurface).toBe("ti");
    expect(controller.options.map((option) => option.surface)).toEqual([
      "ティ",
      "チ",
      "ディ",
      "テュ"
    ]);
    expect(controller.options.map((option) => option.readingHint)).toEqual([
      null,
      null,
      null,
      null
    ]);

    now = 5_360;
    await act(async () => {
      dispatchWindowKeyboardEvent("1");
      await Promise.resolve();
    });

    expect(mocks.submitKatakanaSpeedAnswerAction).toHaveBeenCalledWith({
      inputMethod: "keyboard",
      responseMs: 360,
      sessionId: "session-inverse-choice",
      trialId: "trial-inverse-choice",
      userAnswer: "ティ"
    });
  });

  it("submits RAN grid with derived wrong cell positions", async () => {
    let now = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.aggregateKatakanaSpeedExerciseResultAction.mockResolvedValue({
      idempotent: false,
      resultId: "block-ran:aggregate"
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildRanSession() }));
      await Promise.resolve();
    });

    let controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.ranGridCells).toHaveLength(25);
    expect(controller.timerState.phase).toBe("running");
    await act(async () => {
      controller.handleToggleRanWrongCell(6);
      await Promise.resolve();
    });
    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .ranWrongCellIndexes
    ).toEqual([]);

    now += 12_500;
    await act(async () => {
      dispatchWindowKeyboardEvent("Enter");
      await Promise.resolve();
    });
    expect(
      mocks.aggregateKatakanaSpeedExerciseResultAction
    ).not.toHaveBeenCalled();

    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.timerState.phase).toBe("stopped");
    expect(controller.ranGridCells).toHaveLength(25);
    await act(async () => {
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleToggleRanWrongCell(18);
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleToggleRanWrongCell(6);
      await Promise.resolve();
    });

    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .ranWrongCellIndexes
    ).toEqual([6, 18]);
    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .ranErrorCount
    ).toBe(2);

    await act(async () => {
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleSubmitRanGrid();
      await Promise.resolve();
    });

    expect(
      mocks.aggregateKatakanaSpeedExerciseResultAction
    ).toHaveBeenCalledWith({
      blockId: "block-ran",
      exerciseId: "exercise-ran",
      metricsJson: expect.objectContaining({
        adjustedItemsPerSecond: 1.693,
        cellItemIds: expect.arrayContaining(["kana-shi", "kana-tsu"]),
        cellSurfaces: expect.arrayContaining(["シ", "ツ"]),
        correctItems: 23,
        errorRate: 0.08,
        errors: 2,
        itemsPerSecond: 2,
        rows: 5,
        columns: 5,
        schemaVersion: 1,
        totalItems: 25,
        durationMs: 12500,
        wrongCellIndexes: [6, 18],
        wrongCells: [
          {
            column: 2,
            index: 6,
            itemId: "kana-shi",
            row: 2,
            surface: "シ"
          },
          {
            column: 4,
            index: 18,
            itemId: "kana-shi",
            row: 4,
            surface: "シ"
          }
        ]
      }),
      resultId: "block-ran:aggregate",
      sessionId: "session-ran",
      sortOrder: 0,
      trialId: "trial-ran"
    });
    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(true);
    expect(controller.completed).toBe(false);

    await act(async () => {
      dispatchWindowKeyboardEvent("Enter");
      await Promise.resolve();
    });

    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .completed
    ).toBe(true);
  });

  it("does not let Space stop or restart the RAN timer from a focused cell", async () => {
    let now = 20_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildRanSession() }));
      await Promise.resolve();
    });

    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .timerState.phase
    ).toBe("running");

    const focusedCell = document.createElement("button");
    focusedCell.focus();

    now += 1_500;
    await act(async () => {
      const event = {
        altKey: false,
        ctrlKey: false,
        defaultPrevented: false,
        key: " ",
        metaKey: false,
        preventDefault() {
          event.defaultPrevented = true;
        },
        shiftKey: false,
        target: focusedCell,
        type: "keydown"
      };
      window.dispatchEvent(event as unknown as Event);
      await Promise.resolve();
    });

    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .timerState.phase
    ).toBe("running");
  });

  it("submits RAN with Enter even when a wrong cell is focused", async () => {
    let now = 30_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.aggregateKatakanaSpeedExerciseResultAction.mockResolvedValue({
      idempotent: false,
      resultId: "block-ran:aggregate"
    });

    let latestController: KatakanaSpeedSessionControllerResult | null = null;

    function Probe(props: { session: StartKatakanaSpeedSessionResult }) {
      const controller = useKatakanaSpeedSessionController(props.session);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { session: buildRanSession() }));
      await Promise.resolve();
    });

    now += 1_200;
    await act(async () => {
      dispatchWindowKeyboardEvent("Enter");
      await Promise.resolve();
    });

    await act(async () => {
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleToggleRanWrongCell(6);
      await Promise.resolve();
    });

    const focusedCell = document.createElement("button");
    focusedCell.focus();

    await act(async () => {
      const event = {
        altKey: false,
        ctrlKey: false,
        defaultPrevented: false,
        key: "Enter",
        metaKey: false,
        preventDefault() {
          event.defaultPrevented = true;
        },
        shiftKey: false,
        target: focusedCell,
        type: "keydown"
      };
      window.dispatchEvent(event as unknown as Event);
      await Promise.resolve();
    });

    expect(
      mocks.aggregateKatakanaSpeedExerciseResultAction
    ).toHaveBeenCalledTimes(1);
    const controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(true);
    expect(controller.currentTrial?.trialId).toBe("trial-ran");
  });
});

function buildSession(): StartKatakanaSpeedSessionResult {
  return {
    sessionId: "session-keyboard",
    trials: [
      {
        correctItemId: "chunk-ti",
        itemId: "chunk-ti",
        mode: "minimal_pair",
        optionItemIds: ["chunk-ti", "chunk-di", "chunk-tu", "chunk-du"],
        promptSurface: "ティ",
        targetRtMs: 950,
        trialId: "trial-1"
      },
      {
        correctItemId: "chunk-di",
        itemId: "chunk-di",
        mode: "minimal_pair",
        optionItemIds: ["chunk-di", "chunk-ti", "chunk-tu", "chunk-du"],
        promptSurface: "ディ",
        targetRtMs: 950,
        trialId: "trial-2"
      }
    ]
  };
}

function buildSelfCheckSession(): StartKatakanaSpeedSessionResult {
  return {
    sessionId: "session-self-check",
    trials: [
      {
        correctItemId: "pseudo-pair-ti-chi-target",
        features: { moraCount: 4 },
        focusChunks: ["ティ"],
        itemId: "pseudo-pair-ti-chi-target",
        itemType: "pseudoword",
        mode: "pseudoword_sprint",
        optionItemIds: ["pseudo-pair-ti-chi-target"],
        promptSurface: "ティラード",
        targetRtMs: 1800,
        trialId: "trial-pseudo",
        wasPseudo: true,
        wasTransfer: true
      },
      {
        correctItemId: "sentence-P01",
        features: { moraCount: 12 },
        focusChunks: ["フィ"],
        itemId: "sentence-P01",
        itemType: "sentence",
        mode: "sentence_sprint",
        optionItemIds: ["sentence-P01"],
        promptSurface: "フィードバックをチェック。",
        targetRtMs: 4200,
        trialId: "trial-sentence",
        wasTransfer: true
      }
    ]
  };
}

function buildRawChoiceSession(): StartKatakanaSpeedSessionResult {
  return {
    sessionId: "session-raw-choice",
    trials: [
      {
        correctItemId: "word-security",
        expectedSurface: "ティ",
        features: {
          exerciseCode: "E15",
          interaction: "raw_choice"
        },
        itemId: "word-security",
        itemType: "raw_choice",
        mode: "minimal_pair",
        optionItemIds: ["raw:%E3%83%86%E3%82%A3", "raw:%E3%83%81"],
        promptSurface: "ティ",
        targetRtMs: 950,
        trialId: "trial-raw-choice"
      }
    ]
  };
}

function buildInverseChoiceSession(): StartKatakanaSpeedSessionResult {
  return {
    sessionId: "session-inverse-choice",
    trials: [
      {
        correctItemId: "chunk-ti",
        expectedSurface: "ティ",
        features: {
          answerKind: "katakana",
          direction: "romaji_to_katakana",
          exerciseFamily: "romaji_to_katakana_choice",
          interaction: "raw_choice",
          promptKind: "romaji"
        },
        itemId: "chunk-ti",
        itemType: "extended_chunk",
        mode: "minimal_pair",
        optionItemIds: [
          "raw:%E3%83%86%E3%82%A3",
          "raw:%E3%83%81",
          "raw:%E3%83%87%E3%82%A3",
          "raw:%E3%83%86%E3%83%A5"
        ],
        promptSurface: "ti",
        targetRtMs: 1150,
        trialId: "trial-inverse-choice"
      }
    ]
  };
}

function buildRanSession(): StartKatakanaSpeedSessionResult {
  const gridSurfaces = Array.from({ length: 25 }, (_, index) =>
    index % 2 === 0 ? "シ" : "ツ"
  );

  return {
    sessionId: "session-ran",
    trials: [
      {
        blockId: "block-ran",
        correctItemId: "kana-shi",
        exerciseId: "exercise-ran",
        features: {
          cellCount: 25,
          gridItemIds: gridSurfaces.map((_, index) =>
            index % 2 === 0 ? "kana-shi" : "kana-tsu"
          ),
          gridSurfaces
        },
        focusChunks: ["シ", "ツ"],
        itemId: "kana-shi",
        itemType: "ran_grid",
        mode: "ran_grid",
        optionItemIds: ["kana-shi"],
        promptSurface: "シ",
        sortOrder: 0,
        targetRtMs: 12500,
        trialId: "trial-ran"
      }
    ]
  };
}

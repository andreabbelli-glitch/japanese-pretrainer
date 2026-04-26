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
    ).toEqual(["同じ", "違う"]);

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
      userAnswer: "違う"
    });
  });

  it("builds tile answers from tap order and can clear the sequence", async () => {
    let now = 4_500;
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
        createElement(Probe, { session: buildTileBuilderSession() })
      );
      await Promise.resolve();
    });

    let controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.isTileBuilderTrial).toBe(true);
    expect(
      controller.tileBuilderState?.tiles.map((tile) => tile.surface)
    ).toEqual(["ティ", "リ", "セ", "キュ"]);

    await act(async () => {
      controller.handleSelectTile(0);
      controller.handleSelectTile(1);
      await Promise.resolve();
    });
    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.tileBuilderState?.answerSurface).toBe("ティリ");

    await act(async () => {
      controller.handleClearTiles();
      controller.handleSelectTile(2);
      controller.handleSelectTile(3);
      controller.handleSelectTile(1);
      controller.handleSelectTile(0);
      await Promise.resolve();
    });

    now = 5_700;
    await act(async () => {
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleSubmitTileBuilder();
      await Promise.resolve();
    });

    expect(mocks.submitKatakanaSpeedAnswerAction).toHaveBeenCalledWith({
      inputMethod: "pointer",
      responseMs: 1200,
      sessionId: "session-tile-builder",
      trialId: "trial-tile-builder",
      userAnswer: "セキュリティ"
    });
  });

  it("keeps an incorrect tile-builder answer on the same trial until continue", async () => {
    let now = 4_500;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitKatakanaSpeedAnswerAction.mockResolvedValue({
      errorTags: ["order"],
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
      root!.render(
        createElement(Probe, { session: buildTileBuilderSession() })
      );
      await Promise.resolve();
    });

    await act(async () => {
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleSelectTile(0);
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleSelectTile(1);
      await Promise.resolve();
    });

    now = 5_000;
    await act(async () => {
      (
        latestController as unknown as KatakanaSpeedSessionControllerResult
      ).handleSubmitTileBuilder();
      await Promise.resolve();
    });

    let controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.feedback?.status).toBe("incorrect");
    expect(controller.awaitingContinue).toBe(true);
    expect(controller.currentTrial?.trialId).toBe("trial-tile-builder");

    await act(async () => {
      dispatchWindowKeyboardEvent("Enter");
      await Promise.resolve();
    });

    controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.completed).toBe(true);
  });

  it("submits repeated reading as one aggregate result after three timed passes", async () => {
    let now = 5_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.aggregateKatakanaSpeedExerciseResultAction.mockResolvedValue({
      idempotent: false,
      resultId: "block-repeated:aggregate"
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
        createElement(Probe, { session: buildRepeatedReadingSession() })
      );
      await Promise.resolve();
    });

    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .timerState.phase
    ).toBe("running");
    expect(
      mocks.aggregateKatakanaSpeedExerciseResultAction
    ).not.toHaveBeenCalled();
    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .repeatedReadingState?.currentPassIndex
    ).toBe(0);

    await stopTimedPass(1_200);
    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .timerState.phase
    ).toBe("running");

    await stopTimedPass(900);
    expect(
      (latestController as unknown as KatakanaSpeedSessionControllerResult)
        .timerState.phase
    ).toBe("running");

    await stopTimedPass(980);

    expect(
      mocks.aggregateKatakanaSpeedExerciseResultAction
    ).toHaveBeenCalledWith({
      blockId: "block-repeated",
      exerciseId: "exercise-repeated",
      metricsJson: expect.objectContaining({
        firstPassMs: 1200,
        improvementRatio: 0.25,
        repeatedPassMs: 900,
        transferPassMs: 980,
        transferStatus: "retained",
        trialIds: ["trial-repeat-1", "trial-repeat-2", "trial-repeat-3"]
      }),
      resultId: "block-repeated:aggregate",
      sessionId: "session-repeated",
      sortOrder: 0,
      trialId: "trial-repeat-1"
    });
    expect(latestController).not.toBeNull();
    const controller =
      latestController as unknown as KatakanaSpeedSessionControllerResult;
    expect(controller.awaitingContinue).toBe(false);
    expect(controller.completed).toBe(true);

    async function stopTimedPass(durationMs: number) {
      now += durationMs;
      await act(async () => {
        dispatchWindowKeyboardEvent("Enter");
        await Promise.resolve();
      });
      await act(async () => {
        dispatchWindowKeyboardEvent("Enter");
        await Promise.resolve();
      });
    }
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
        correctItemId: "pseudo-ti-rado",
        features: { moraCount: 4 },
        focusChunks: ["ティ"],
        itemId: "pseudo-ti-rado",
        itemType: "pseudoword",
        mode: "pseudoword_sprint",
        optionItemIds: ["pseudo-ti-rado"],
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
        expectedSurface: "違う",
        features: {
          exerciseCode: "E05",
          interaction: "raw_choice"
        },
        itemId: "word-security",
        itemType: "same_different",
        mode: "minimal_pair",
        optionItemIds: ["raw:%E5%90%8C%E3%81%98", "raw:%E9%81%95%E3%81%86"],
        promptSurface: "セキュリティ / セキュリテイ",
        targetRtMs: 950,
        trialId: "trial-raw-choice"
      }
    ]
  };
}

function buildTileBuilderSession(): StartKatakanaSpeedSessionResult {
  return {
    sessionId: "session-tile-builder",
    trials: [
      {
        correctItemId: "word-security",
        expectedSurface: "セキュリティ",
        features: {
          exerciseCode: "E08",
          interaction: "tile_builder",
          tiles: ["ティ", "リ", "セ", "キュ"]
        },
        focusChunks: ["ティ"],
        itemId: "word-security",
        itemType: "scrambled_loanword",
        mode: "minimal_pair",
        optionItemIds: [],
        promptSurface: "セキュリティ",
        targetRtMs: 3200,
        trialId: "trial-tile-builder"
      }
    ]
  };
}

function buildRepeatedReadingSession(): StartKatakanaSpeedSessionResult {
  return {
    sessionId: "session-repeated",
    trials: [
      {
        blockId: "block-repeated",
        correctItemId: "sentence-P37",
        exerciseId: "exercise-repeated",
        features: { moraCount: 22, repeatedReadingPass: 1 },
        focusChunks: ["ティ"],
        itemId: "sentence-P37",
        itemType: "sentence",
        mode: "repeated_reading_pass",
        optionItemIds: ["sentence-P37"],
        promptSurface:
          "ミーティング、セキュリティ、コミュニティを連続で読みます。",
        sortOrder: 0,
        targetRtMs: 4200,
        trialId: "trial-repeat-1",
        wasTransfer: true
      },
      {
        blockId: "block-repeated",
        correctItemId: "sentence-P37",
        exerciseId: "exercise-repeated",
        features: { moraCount: 22, repeatedReadingPass: 2 },
        focusChunks: ["ティ"],
        itemId: "sentence-P37",
        itemType: "sentence",
        mode: "repeated_reading_pass",
        optionItemIds: ["sentence-P37"],
        promptSurface:
          "ミーティング、セキュリティ、コミュニティを連続で読みます。",
        sortOrder: 1,
        targetRtMs: 4200,
        trialId: "trial-repeat-2",
        wasTransfer: true
      },
      {
        blockId: "block-repeated",
        correctItemId: "sentence-P02",
        exerciseId: "exercise-repeated",
        features: { moraCount: 18, repeatedReadingPass: 3 },
        focusChunks: ["ティ"],
        itemId: "sentence-P02",
        itemType: "sentence",
        mode: "repeated_reading_pass",
        optionItemIds: ["sentence-P02"],
        promptSurface: "セキュリティのため、パスワードをアップデートしました。",
        sortOrder: 2,
        targetRtMs: 4200,
        trialId: "trial-repeat-3",
        wasTransfer: true
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

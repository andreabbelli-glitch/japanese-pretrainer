import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import type { KanjiClashRoundControllerResult } from "@/components/kanji-clash/use-kanji-clash-round-controller";

const mocks = vi.hoisted(() => ({
  archiveKanjiClashManualContrastAction: vi.fn(),
  refresh: vi.fn(),
  restoreKanjiClashManualContrastAction: vi.fn(),
  submitKanjiClashAnswerAction: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh
  })
}));

vi.mock("@/actions/kanji-clash", () => ({
  archiveKanjiClashManualContrastAction:
    mocks.archiveKanjiClashManualContrastAction,
  restoreKanjiClashManualContrastAction:
    mocks.restoreKanjiClashManualContrastAction,
  submitKanjiClashAnswerAction: mocks.submitKanjiClashAnswerAction
}));

import { useKanjiClashRoundController } from "@/components/kanji-clash/use-kanji-clash-round-controller";

import {
  buildKanjiClashPageData,
  buildKanjiClashQueue,
  buildKanjiClashRound,
  buildKanjiClashSessionActionResult
} from "./helpers/kanji-clash-test-data";

describe("useKanjiClashRoundController manual contrast sync", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    mocks.archiveKanjiClashManualContrastAction.mockReset();
    mocks.restoreKanjiClashManualContrastAction.mockReset();
    mocks.submitKanjiClashAnswerAction.mockReset();
    mocks.refresh.mockReset();
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

  it("updates manual contrast lists locally after archive and restore without losing the current round", async () => {
    mocks.archiveKanjiClashManualContrastAction.mockResolvedValue(undefined);
    mocks.restoreKanjiClashManualContrastAction.mockResolvedValue(undefined);

    let latestController: KanjiClashRoundControllerResult | null = null;

    function Probe(props: {
      data: ReturnType<typeof buildKanjiClashPageData>;
    }) {
      const controller = useKanjiClashRoundController(props.data);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    const contrastKey = "entry:term:left::entry:term:right";
    const currentRound = buildKanjiClashRound({
      origin: {
        contrastKey,
        direction: "subject_a",
        type: "manual-contrast"
      },
      pairKey: contrastKey,
      roundKey: `${contrastKey}::subject_a`
    });
    const data = buildKanjiClashPageData({
      currentRound,
      manualContrasts: [
        {
          contrastKey,
          leftLabel: "待つ",
          leftSubjectKey: "entry:term:left",
          rightLabel: "持つ",
          rightSubjectKey: "entry:term:right",
          source: "forced",
          status: "active"
        },
        {
          contrastKey: "entry:term:archived-left::entry:term:archived-right",
          leftLabel: "聞く",
          leftSubjectKey: "entry:term:archived-left",
          rightLabel: "効く",
          rightSubjectKey: "entry:term:archived-right",
          source: "forced",
          status: "archived"
        }
      ]
    });

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { data }));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    expect(controller().currentRound?.roundKey).toBe(currentRound.roundKey);
    expect(
      controller().activeManualContrasts.map((contrast) => contrast.contrastKey)
    ).toEqual([contrastKey]);
    expect(
      controller().archivedManualContrasts.map(
        (contrast) => contrast.contrastKey
      )
    ).toEqual(["entry:term:archived-left::entry:term:archived-right"]);

    await act(async () => {
      controller().handleArchiveManualContrast(contrastKey);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.archiveKanjiClashManualContrastAction).toHaveBeenCalledWith({
      contrastKey
    });
    expect(controller().currentRound?.roundKey).toBe(currentRound.roundKey);
    expect(controller().activeManualContrasts).toHaveLength(0);
    expect(
      controller().archivedManualContrasts.map(
        (contrast) => contrast.contrastKey
      )
    ).toContain(contrastKey);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      controller().handleRestoreManualContrast(contrastKey);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.restoreKanjiClashManualContrastAction).toHaveBeenCalledWith({
      contrastKey
    });
    expect(controller().currentRound?.roundKey).toBe(currentRound.roundKey);
    expect(
      controller().activeManualContrasts.map((contrast) => contrast.contrastKey)
    ).toEqual([contrastKey]);
    expect(
      controller().archivedManualContrasts.map(
        (contrast) => contrast.contrastKey
      )
    ).not.toContain(contrastKey);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it("shows the next card while a correct answer commit is still pending", async () => {
    const submitDeferred =
      createDeferred<ReturnType<typeof buildKanjiClashSessionActionResult>>();
    mocks.submitKanjiClashAnswerAction.mockReturnValue(submitDeferred.promise);

    let latestController: KanjiClashRoundControllerResult | null = null;

    function Probe(props: {
      data: ReturnType<typeof buildKanjiClashPageData>;
    }) {
      const controller = useKanjiClashRoundController(props.data);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    const queue = buildKanjiClashQueue(0);
    const data = buildKanjiClashPageData({
      currentRound: queue.rounds[0] ?? null,
      queue
    });

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { data }));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    expect(controller().currentRound?.pairKey).toBe("pair-1");

    await act(async () => {
      controller().handleChooseSide("left");
      await Promise.resolve();
    });

    expect(controller().currentRound?.pairKey).toBe("pair-2");
    expect(controller().queue.awaitingConfirmation).toBe(true);
    expect(controller().isSelectionLocked).toBe(false);
    expect(controller().pendingSelectionSide).toBeNull();
    expect(mocks.submitKanjiClashAnswerAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      submitDeferred.resolve(buildKanjiClashSessionActionResult());
      await submitDeferred.promise;
    });

    expect(controller().currentRound?.pairKey).toBe("pair-2");
    expect(controller().queue.awaitingConfirmation).toBe(false);
    expect(controller().isSelectionLocked).toBe(false);
  });

  it("buffers one answer on the visible next card until the prior commit returns", async () => {
    let now = 1_000;
    const performanceNowSpy = vi
      .spyOn(performance, "now")
      .mockImplementation(() => now);
    const firstSubmitDeferred =
      createDeferred<ReturnType<typeof buildKanjiClashSessionActionResult>>();
    const bufferedSubmitDeferred =
      createDeferred<ReturnType<typeof buildKanjiClashSessionActionResult>>();
    mocks.submitKanjiClashAnswerAction
      .mockReturnValueOnce(firstSubmitDeferred.promise)
      .mockReturnValueOnce(bufferedSubmitDeferred.promise);

    let latestController: KanjiClashRoundControllerResult | null = null;

    function Probe(props: {
      data: ReturnType<typeof buildKanjiClashPageData>;
    }) {
      const controller = useKanjiClashRoundController(props.data);

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    const queue = buildKanjiClashQueue(0);
    const data = buildKanjiClashPageData({
      currentRound: queue.rounds[0] ?? null,
      queue
    });

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe, { data }));
    });

    const controller = () => {
      if (!latestController) {
        throw new Error("controller not mounted");
      }

      return latestController;
    };

    now = 1_300;
    await act(async () => {
      controller().handleChooseSide("left");
      await Promise.resolve();
    });

    expect(controller().currentRound?.pairKey).toBe("pair-2");
    expect(controller().isSelectionLocked).toBe(false);
    expect(mocks.submitKanjiClashAnswerAction).toHaveBeenCalledTimes(1);

    now = 1_450;
    await act(async () => {
      controller().handleChooseSide("left");
      await Promise.resolve();
    });

    expect(controller().pendingSelectionSide).toBe("left");
    expect(controller().isSelectionLocked).toBe(true);
    expect(mocks.submitKanjiClashAnswerAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSubmitDeferred.resolve(buildKanjiClashSessionActionResult());
      await firstSubmitDeferred.promise;
      await Promise.resolve();
    });

    expect(mocks.submitKanjiClashAnswerAction).toHaveBeenCalledTimes(2);
    expect(mocks.submitKanjiClashAnswerAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRoundKey: "pair-2",
        queueToken: "token-2",
        responseMs: 150,
        selectedSide: "left"
      })
    );

    await act(async () => {
      bufferedSubmitDeferred.resolve(
        buildKanjiClashSessionActionResult({
          nextQueue: buildKanjiClashQueue(2),
          nextRound: null
        })
      );
      await bufferedSubmitDeferred.promise;
      await Promise.resolve();
    });

    performanceNowSpy.mockRestore();
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}

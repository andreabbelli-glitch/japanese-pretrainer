import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PitchAccentSessionControllerResult } from "@/components/pitch-accent/use-pitch-accent-session-controller";
import { usePitchAccentSessionController } from "@/components/pitch-accent/use-pitch-accent-session-controller";
import type { PitchAccentSessionPageData } from "@/features/pitch-accent/server";

import {
  dispatchWindowKeyboardEvent,
  installMinimalDom,
  uninstallMinimalDom
} from "./helpers/minimal-dom";

const mocks = vi.hoisted(() => ({
  submitPitchAccentAnswerAction: vi.fn()
}));

vi.mock("@/actions/pitch-accent", () => ({
  submitPitchAccentAnswerAction: mocks.submitPitchAccentAnswerAction
}));

describe("pitch accent session controller interactions", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    vi.stubGlobal(
      "Audio",
      class {
        preload = "";

        constructor(readonly src: string) {}
      }
    );
    mocks.submitPitchAccentAnswerAction.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    root = null;
    container = null;
    uninstallMinimalDom();
  });

  it("replays the current raw audio with the r key", async () => {
    const audio = createAudioElementStub();
    const { controller } = await renderController({
      audioElement: audio,
      pauseAfterCorrect: false
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("r");
      await Promise.resolve();
    });

    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.load).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalled();
    expect(controller().currentTrial?.trialId).toBe("trial-1");
  });

  it("submits keyboard answers and advances with Space when paused", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      idempotent: false,
      isCorrect: true
    });
    const { controller } = await renderController({
      audioElement: createAudioElementStub(),
      pauseAfterCorrect: true
    });

    now = 1_240;
    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(mocks.submitPitchAccentAnswerAction).toHaveBeenCalledWith({
      chosenOptionId: "pair-a:1",
      inputMethod: "keyboard",
      responseMs: 240,
      sessionId: "pitch-accent-session-ui",
      trialId: "trial-1"
    });
    expect(controller().awaitingContinue).toBe(true);
    expect(controller().feedback?.isCorrect).toBe(true);
    expect(controller().currentTrial?.trialId).toBe("trial-1");

    await act(async () => {
      dispatchWindowKeyboardEvent(" ");
      await Promise.resolve();
    });

    expect(controller().awaitingContinue).toBe(false);
    expect(controller().currentTrial?.trialId).toBe("trial-2");
  });

  it("auto-advances correct answers when pause-after-correct is disabled", async () => {
    vi.useFakeTimers();
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      idempotent: false,
      isCorrect: true
    });
    const { controller } = await renderController({
      audioElement: createAudioElementStub(),
      pauseAfterCorrect: false
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(controller().currentTrial?.trialId).toBe("trial-1");

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(controller().currentTrial?.trialId).toBe("trial-2");
  });

  it("falls back to raw audio when modifiers are unavailable", async () => {
    const audio = createAudioElementStub();
    await renderController({
      audioElement: audio,
      modifiers: {
        muffle: false,
        noise: true
      },
      pauseAfterCorrect: false
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("r");
      await Promise.resolve();
    });

    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.load).toHaveBeenCalled();
    expect(audio.play).toHaveBeenCalled();
  });

  async function renderController(input: {
    readonly audioElement: HTMLAudioElement;
    readonly modifiers?: {
      readonly muffle: boolean;
      readonly noise: boolean;
    };
    readonly pauseAfterCorrect: boolean;
  }) {
    let latestController: PitchAccentSessionControllerResult | null = null;

    function Probe() {
      const controller = usePitchAccentSessionController(buildSession(), {
        audioElement: input.audioElement,
        audioModifiers: input.modifiers ?? {
          muffle: false,
          noise: false
        },
        pauseAfterCorrect: input.pauseAfterCorrect
      });

      useEffect(() => {
        latestController = controller;
      }, [controller]);

      return null;
    }

    container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root!.render(createElement(Probe));
      await Promise.resolve();
    });

    return {
      controller() {
        if (!latestController) {
          throw new Error("controller not mounted");
        }

        return latestController;
      }
    };
  }
});

function createAudioElementStub() {
  return {
    currentTime: 0,
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    src: ""
  } as unknown as HTMLAudioElement;
}

function buildSession(): PitchAccentSessionPageData {
  return {
    answeredCount: 0,
    filters: {
      onlyDevoiced: false,
      patternKeys: ["pitch0", "pitch1"],
      strictPairFinding: false
    },
    sessionId: "pitch-accent-session-ui",
    startedAt: "2026-05-25T08:00:00.000Z",
    status: "active",
    trials: [
      {
        correctOptionId: "pair-a:1",
        correctPatternKey: "pitch1",
        kana: "はし",
        options: [
          {
            accentedMora: 0,
            audioMime: "audio/aac",
            audioSrc: "/vendor/minimal-pairs/audio/pair-a/0.aac",
            id: "pair-a:0",
            moraCount: 2,
            pitchAccent: 0,
            rawPronunciation: "ハシ",
            silencedMoras: []
          },
          {
            accentedMora: 1,
            audioMime: "audio/aac",
            audioSrc: "/vendor/minimal-pairs/audio/pair-a/1.aac",
            id: "pair-a:1",
            moraCount: 2,
            pitchAccent: 1,
            rawPronunciation: "ハシ",
            silencedMoras: []
          }
        ],
        pairId: "pair-a",
        sessionId: "pitch-accent-session-ui",
        sortOrder: 0,
        trialId: "trial-1"
      },
      {
        correctOptionId: "pair-b:0",
        correctPatternKey: "pitch0",
        kana: "あめ",
        options: [
          {
            accentedMora: 0,
            audioMime: "audio/aac",
            audioSrc: "/vendor/minimal-pairs/audio/pair-b/0.aac",
            id: "pair-b:0",
            moraCount: 2,
            pitchAccent: 0,
            rawPronunciation: "アメ",
            silencedMoras: []
          },
          {
            accentedMora: 1,
            audioMime: "audio/aac",
            audioSrc: "/vendor/minimal-pairs/audio/pair-b/1.aac",
            id: "pair-b:1",
            moraCount: 2,
            pitchAccent: 1,
            rawPronunciation: "アメ",
            silencedMoras: []
          }
        ],
        pairId: "pair-b",
        sessionId: "pitch-accent-session-ui",
        sortOrder: 1,
        trialId: "trial-2"
      }
    ]
  };
}

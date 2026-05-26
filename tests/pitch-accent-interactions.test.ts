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

    vi.mocked(audio.load).mockClear();
    vi.mocked(audio.pause).mockClear();
    vi.mocked(audio.play).mockClear();

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

  it("autoplays the correct audio when each trial loads", async () => {
    const audio = createAudioElementStub();
    const { controller } = await renderController({
      audioElement: audio,
      pauseAfterCorrect: true
    });

    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.play).toHaveBeenCalledTimes(1);

    vi.mocked(audio.play).mockClear();

    await act(async () => {
      controller().handleContinue();
      await Promise.resolve();
    });

    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-b/0.aac");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("plays any current option audio for feedback comparison", async () => {
    const audio = createAudioElementStub();
    const reviewAudio = createAudioElementStub();
    const { controller } = await renderController({
      audioElement: audio,
      reviewAudioElement: reviewAudio,
      pauseAfterCorrect: true
    });

    vi.mocked(reviewAudio.play).mockClear();
    vi.mocked(audio.play).mockClear();

    await act(async () => {
      controller().playOptionAudio("pair-a:0");
      await Promise.resolve();
    });

    expect(reviewAudio.src).toBe("/vendor/minimal-pairs/audio/pair-a/0.aac");
    expect(reviewAudio.play).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("replays option audio after an incorrect answer without replacing prompt audio", async () => {
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      chosenOptionId: "pair-a:0",
      correctOptionId: "pair-a:1",
      idempotent: false,
      isCorrect: false
    });
    const audio = createAudioElementStub();
    const reviewAudio = createAudioElementStub();
    const { controller } = await renderController({
      audioElement: audio,
      reviewAudioElement: reviewAudio,
      pauseAfterCorrect: true
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("1");
      await Promise.resolve();
    });

    expect(controller().feedback?.isCorrect).toBe(false);

    vi.mocked(audio.play).mockClear();
    vi.mocked(reviewAudio.play).mockClear();

    await act(async () => {
      controller().playOptionAudio("pair-a:0");
      await Promise.resolve();
    });

    expect(reviewAudio.src).toBe("/vendor/minimal-pairs/audio/pair-a/0.aac");
    expect(reviewAudio.play).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("uses number keys as option audio replay shortcuts after an incorrect answer", async () => {
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      chosenOptionId: "pair-a:0",
      correctOptionId: "pair-a:1",
      idempotent: false,
      isCorrect: false
    });
    const audio = createAudioElementStub();
    const reviewAudio = createAudioElementStub();
    const { controller } = await renderController({
      audioElement: audio,
      reviewAudioElement: reviewAudio,
      pauseAfterCorrect: true
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("1");
      await Promise.resolve();
    });

    expect(controller().feedback?.isCorrect).toBe(false);
    expect(mocks.submitPitchAccentAnswerAction).toHaveBeenCalledTimes(1);

    vi.mocked(audio.play).mockClear();
    vi.mocked(reviewAudio.play).mockClear();

    await act(async () => {
      dispatchWindowKeyboardEvent("1");
      await Promise.resolve();
    });

    expect(reviewAudio.src).toBe("/vendor/minimal-pairs/audio/pair-a/0.aac");
    expect(reviewAudio.play).toHaveBeenCalledTimes(1);
    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.play).not.toHaveBeenCalled();
    expect(mocks.submitPitchAccentAnswerAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(reviewAudio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(reviewAudio.play).toHaveBeenCalledTimes(2);
    expect(audio.play).not.toHaveBeenCalled();

    await act(async () => {
      dispatchWindowKeyboardEvent("r");
      await Promise.resolve();
    });

    expect(audio.src).toBe("/vendor/minimal-pairs/audio/pair-a/1.aac");
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("shows answer feedback before the submission roundtrip finishes", async () => {
    const pendingSubmission =
      createDeferred<
        Awaited<ReturnType<typeof mocks.submitPitchAccentAnswerAction>>
      >();
    mocks.submitPitchAccentAnswerAction.mockReturnValue(
      pendingSubmission.promise
    );
    const { controller } = await renderController({
      audioElement: createAudioElementStub(),
      reviewAudioElement: createAudioElementStub(),
      pauseAfterCorrect: true
    });

    await act(async () => {
      controller().handleChooseOption("pair-a:0", "pointer");
      await Promise.resolve();
    });

    expect(controller().feedback).toMatchObject({
      chosenOptionId: "pair-a:0",
      correctOptionId: "pair-a:1",
      isCorrect: false,
      trialId: "trial-1"
    });
    expect(controller().awaitingContinue).toBe(true);
    expect(controller().isSubmitting).toBe(true);

    await act(async () => {
      pendingSubmission.resolve({
        chosenOptionId: "pair-a:0",
        correctOptionId: "pair-a:1",
        idempotent: false,
        isCorrect: false
      });
      await pendingSubmission.promise;
    });

    expect(controller().isSubmitting).toBe(false);
  });

  it("submits keyboard answers and advances with Space when paused", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      chosenOptionId: "pair-a:1",
      correctOptionId: "pair-a:1",
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

  it("uses persisted attempt state returned by idempotent submissions", async () => {
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      chosenOptionId: "pair-a:0",
      correctOptionId: "pair-a:1",
      idempotent: true,
      isCorrect: false
    });
    const { controller } = await renderController({
      audioElement: createAudioElementStub(),
      pauseAfterCorrect: true
    });

    await act(async () => {
      dispatchWindowKeyboardEvent("2");
      await Promise.resolve();
    });

    expect(controller().feedback).toMatchObject({
      chosenOptionId: "pair-a:0",
      correctOptionId: "pair-a:1",
      isCorrect: false
    });
  });

  it("auto-advances correct answers when pause-after-correct is disabled", async () => {
    vi.useFakeTimers();
    mocks.submitPitchAccentAnswerAction.mockResolvedValue({
      chosenOptionId: "pair-a:1",
      correctOptionId: "pair-a:1",
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
    readonly reviewAudioElement?: HTMLAudioElement;
  }) {
    let latestController: PitchAccentSessionControllerResult | null = null;

    function Probe() {
      const controller = usePitchAccentSessionController(buildSession(), {
        audioElement: input.audioElement,
        audioModifiers: input.modifiers ?? {
          muffle: false,
          noise: false
        },
        pauseAfterCorrect: input.pauseAfterCorrect,
        reviewAudioElement: input.reviewAudioElement ?? null
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
  const listeners = new Map<string, Set<() => void>>();

  return {
    currentTime: 0,
    duration: 0,
    addEventListener: vi.fn((type: string, listener: () => void) => {
      const listenersForType = listeners.get(type) ?? new Set();
      listenersForType.add(listener);
      listeners.set(type, listenersForType);
    }),
    dispatchPitchAccentTestEvent(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
    src: ""
  } as unknown as HTMLAudioElement;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    reject,
    resolve
  };
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

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMinimalDom, uninstallMinimalDom } from "./helpers/minimal-dom";

import { useConsolidationMeaningAudio } from "@/components/consolidation/use-consolidation-meaning-audio";

type AudioProbeProps = {
  audioSrc?: string;
  phase: "answering" | "feedback" | "retrieval";
  step: "meaning" | "reading";
  subjectKey: string;
};

describe("useConsolidationMeaningAudio", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    installMinimalDom();
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
      await Promise.resolve();
    });
    vi.restoreAllMocks();
    uninstallMinimalDom();
    container = null;
    root = null;
  });

  it("preloads audio but does not play during reading retrieval", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "reading",
      subjectKey: "entry:term:yomu"
    });

    expect(audio.load).toHaveBeenCalledTimes(1);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("rewinds and plays audio during meaning retrieval", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "reading",
      subjectKey: "entry:term:yomu"
    });
    audio.currentTime = 0.75;

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });

    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("swallows browser autoplay rejections", async () => {
    const audio = installAudioElementMock();
    audio.play.mockRejectedValueOnce(new Error("NotAllowedError"));

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("pauses audio when leaving meaning retrieval", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "answering",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });

    expect(audio.pause).toHaveBeenCalledTimes(1);
  });

  it("pauses current playback before replaying for a new subject", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu-2"
    });

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("pauses active playback on unmount", async () => {
    const audio = installAudioElementMock();

    await renderProbe({
      audioSrc: "/media/sample/assets/audio/yomu.mp3",
      phase: "retrieval",
      step: "meaning",
      subjectKey: "entry:term:yomu"
    });

    await act(async () => {
      root!.unmount();
      await Promise.resolve();
    });
    root = null;

    expect(audio.pause).toHaveBeenCalled();
  });

  async function renderProbe(props: AudioProbeProps) {
    await act(async () => {
      root!.render(createElement(AudioProbe, props));
      await Promise.resolve();
    });
  }
});

function AudioProbe(props: AudioProbeProps) {
  useConsolidationMeaningAudio(props);
  return null;
}

function installAudioElementMock() {
  const originalCreateElement = document.createElement.bind(document);
  const audio = {
    currentTime: 0,
    load: vi.fn(),
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    preload: "",
    src: ""
  };

  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName === "audio") {
      return audio as unknown as HTMLElement;
    }

    return originalCreateElement(tagName);
  });

  return audio;
}

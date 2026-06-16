import { afterEach, describe, expect, it, vi } from "vitest";

import {
  playPreloadedAudioSource,
  preloadAudioSources,
  resetAudioPreloadCacheForTests
} from "@/components/ui/audio-preload";

type MockAudioElement = {
  addEventListener?: ReturnType<typeof vi.fn>;
  currentTime: number;
  error?: MediaError | null;
  load: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  preload: string;
  removeAttribute?: ReturnType<typeof vi.fn>;
  src: string;
};

describe("preloadAudioSources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAudioPreloadCacheForTests();
  });

  it("does nothing when the browser Audio constructor is unavailable", () => {
    vi.stubGlobal("Audio", undefined);

    expect(() =>
      preloadAudioSources(["/media/a/assets/audio/a.mp3"])
    ).not.toThrow();
  });

  it("arms the current source without building a pool of media elements", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources([
      "/media/a/assets/audio/a.mp3",
      " ",
      "/media/a/assets/audio/a.mp3",
      "/media/a/assets/audio/b.mp3"
    ]);
    preloadAudioSources(["/media/a/assets/audio/b.mp3"]);

    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.src).toBe("/media/a/assets/audio/b.mp3");
    expect(audioElements[0]?.load).toHaveBeenCalledTimes(2);
  });

  it("reuses preloaded audio for immediate playback", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0.75;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources([" /media/a/assets/audio/a.mp3 "]);
    const played = playPreloadedAudioSource("/media/a/assets/audio/a.mp3");

    expect(played).toBe(true);
    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.currentTime).toBe(0);
    expect(audioElements[0]?.play).toHaveBeenCalledTimes(1);
  });

  it("reuses the current playback element when switching sources", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = src.endsWith("a.mp3") ? 1.25 : 0.5;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    playPreloadedAudioSource("/media/a/assets/audio/a.mp3");
    playPreloadedAudioSource("/media/a/assets/audio/b.mp3");

    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.src).toBe("/media/a/assets/audio/b.mp3");
    expect(audioElements[0]?.currentTime).toBe(0);
    expect(audioElements[0]?.play).toHaveBeenCalledTimes(2);
  });

  it("recreates a source after rejected playback so Safari can recover", async () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play =
        audioElements.length === 0
          ? vi.fn().mockRejectedValue(new Error("NotAllowedError"))
          : vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    expect(playPreloadedAudioSource("/media/a/assets/audio/a.mp3")).toBe(true);
    await Promise.resolve();

    expect(audioElements[0]?.play).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.removeAttribute).toHaveBeenCalledWith("src");

    expect(playPreloadedAudioSource("/media/a/assets/audio/a.mp3")).toBe(true);

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(audioElements[1]?.play).toHaveBeenCalledTimes(1);
  });

  it("does not keep a rejected synchronous playback element in the current slot", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play =
        audioElements.length === 0
          ? vi.fn(() => {
              throw new Error("MediaError");
            })
          : vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    expect(playPreloadedAudioSource("/media/a/assets/audio/a.mp3")).toBe(false);
    expect(audioElements[0]?.removeAttribute).toHaveBeenCalledWith("src");

    expect(playPreloadedAudioSource("/media/a/assets/audio/a.mp3")).toBe(true);

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(audioElements[1]?.play).toHaveBeenCalledTimes(1);
  });

  it("releases an idle errored current slot before reveal playback", () => {
    const audioElements: MockAudioElement[] = [];
    const listeners: { error?: () => void } = {};
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.addEventListener = vi.fn(
        (eventName: string, handler: EventListenerOrEventListenerObject) => {
          if (eventName === "error" && typeof handler === "function") {
            listeners.error = handler as () => void;
          }
        }
      );
      this.currentTime = 0;
      this.error = null;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources(["/media/a/assets/audio/a.mp3"], { role: "current" });
    audioElements[0]!.error = { code: 3 } as MediaError;
    listeners.error?.();

    expect(audioElements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.removeAttribute).toHaveBeenCalledWith("src");

    expect(playPreloadedAudioSource("/media/a/assets/audio/a.mp3")).toBe(true);

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(audioElements[1]?.play).toHaveBeenCalledTimes(1);
  });

  it("keeps media elements bounded across a 100-card review session", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    for (let index = 0; index < 100; index += 1) {
      preloadAudioSources([`/media/a/assets/audio/${index}.mp3`]);
    }

    expect(AudioMock).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.src).toBe("/media/a/assets/audio/99.mp3");
    expect(audioElements[0]?.load).toHaveBeenCalledTimes(100);
  });

  it("keeps next-card warming from replacing the current card audio", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 1.25;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources(["/media/a/assets/audio/current.mp3"], {
      role: "current"
    });
    preloadAudioSources(["/media/a/assets/audio/next.mp3"], { role: "next" });

    expect(AudioMock).toHaveBeenCalledTimes(2);

    expect(playPreloadedAudioSource("/media/a/assets/audio/current.mp3")).toBe(
      true
    );

    expect(audioElements[0]?.src).toBe("/media/a/assets/audio/current.mp3");
    expect(audioElements[0]?.play).toHaveBeenCalledTimes(1);
    expect(audioElements[1]?.src).toBe("/media/a/assets/audio/next.mp3");
    expect(audioElements[1]?.play).not.toHaveBeenCalled();
  });

  it("promotes warmed next-card audio for immediate playback", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0.75;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources(["/media/a/assets/audio/current.mp3"], {
      role: "current"
    });
    preloadAudioSources(["/media/a/assets/audio/next.mp3"], { role: "next" });

    expect(playPreloadedAudioSource("/media/a/assets/audio/next.mp3")).toBe(true);

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(audioElements[1]?.play).toHaveBeenCalledTimes(1);
    expect(audioElements[1]?.currentTime).toBe(0);
  });

  it("releases all hot audio slots on reset", () => {
    const audioElements: MockAudioElement[] = [];
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 1.25;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = vi.fn().mockResolvedValue(undefined);
      this.preload = "";
      this.removeAttribute = vi.fn();
      this.src = src;
      audioElements.push(this);
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources(["/media/a/assets/audio/current.mp3"], {
      role: "current"
    });
    preloadAudioSources(["/media/a/assets/audio/next.mp3"], { role: "next" });

    resetAudioPreloadCacheForTests();

    expect(audioElements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.removeAttribute).toHaveBeenCalledWith("src");
    expect(audioElements[1]?.pause).toHaveBeenCalledTimes(1);
    expect(audioElements[1]?.removeAttribute).toHaveBeenCalledWith("src");
  });
});

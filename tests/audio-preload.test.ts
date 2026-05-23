import { afterEach, describe, expect, it, vi } from "vitest";

import {
  playPreloadedAudioSource,
  preloadAudioSources,
  resetAudioPreloadCacheForTests
} from "@/components/ui/audio-preload";

type MockAudioElement = {
  currentTime: number;
  load: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  preload: string;
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

  it("preloads each source once and ignores blank sources", () => {
    const load = vi.fn();
    const AudioMock = vi.fn(function (
      this: {
        load: () => void;
        preload: string;
        src: string;
      },
      src: string
    ) {
      this.load = load;
      this.preload = "";
      this.src = src;
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources([
      "/media/a/assets/audio/a.mp3",
      " ",
      "/media/a/assets/audio/a.mp3",
      "/media/a/assets/audio/b.mp3"
    ]);
    preloadAudioSources(["/media/a/assets/audio/b.mp3"]);

    expect(AudioMock).toHaveBeenCalledTimes(2);
    expect(AudioMock).toHaveBeenNthCalledWith(
      1,
      "/media/a/assets/audio/a.mp3"
    );
    expect(AudioMock).toHaveBeenNthCalledWith(
      2,
      "/media/a/assets/audio/b.mp3"
    );
    expect(load).toHaveBeenCalledTimes(2);
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

  it("stops the previous autoplayed source before playing another one", () => {
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

    expect(audioElements[0]?.pause).toHaveBeenCalledTimes(1);
    expect(audioElements[0]?.currentTime).toBe(0);
    expect(audioElements[1]?.pause).not.toHaveBeenCalled();
    expect(audioElements[1]?.play).toHaveBeenCalledTimes(1);
  });

  it("swallows playback rejections", async () => {
    const play = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const AudioMock = vi.fn(function (
      this: MockAudioElement,
      src: string
    ) {
      this.currentTime = 0;
      this.load = vi.fn();
      this.pause = vi.fn();
      this.play = play;
      this.preload = "";
      this.src = src;
    });
    vi.stubGlobal("Audio", AudioMock);

    expect(playPreloadedAudioSource("/media/a/assets/audio/a.mp3")).toBe(true);
    await Promise.resolve();

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("bounds the remembered source set so old URLs can be retried", () => {
    const load = vi.fn();
    const AudioMock = vi.fn(function (
      this: {
        load: () => void;
        preload: string;
        src: string;
      },
      src: string
    ) {
      this.load = load;
      this.preload = "";
      this.src = src;
    });
    vi.stubGlobal("Audio", AudioMock);

    preloadAudioSources(
      Array.from(
        { length: 129 },
        (_, index) => `/media/a/assets/audio/${index}.mp3`
      )
    );
    preloadAudioSources(["/media/a/assets/audio/0.mp3"]);

    expect(AudioMock).toHaveBeenCalledTimes(130);
    expect(AudioMock).toHaveBeenLastCalledWith(
      "/media/a/assets/audio/0.mp3"
    );
  });
});

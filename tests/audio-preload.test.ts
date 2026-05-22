import { afterEach, describe, expect, it, vi } from "vitest";

import {
  preloadAudioSources,
  resetAudioPreloadCacheForTests
} from "@/components/ui/audio-preload";

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
});

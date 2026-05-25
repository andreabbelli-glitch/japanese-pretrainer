"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject
} from "react";

import { submitPitchAccentAnswerAction } from "@/actions/pitch-accent";
import type {
  PitchAccentAudioPitchGraph,
  PitchAccentPairOption,
  PitchAccentSessionTrialPlan
} from "@/features/pitch-accent/model";
import type { PitchAccentSessionPageData } from "@/features/pitch-accent/server/contracts";

import {
  isActivationKeyboardTarget,
  isEditableKeyboardTarget
} from "../katakana-speed/keyboard-targets";

export type PitchAccentFeedback = {
  readonly chosenOptionId: string;
  readonly correctOptionId: string;
  readonly isCorrect: boolean;
  readonly responseMs: number;
  readonly trialId: string;
};

export type PitchAccentAudioModifiers = {
  readonly muffle: boolean;
  readonly noise: boolean;
};

export type PitchAccentActiveReviewGraph = {
  readonly graph: PitchAccentAudioPitchGraph | null;
  readonly option: PitchAccentPairOption;
  readonly optionId: string;
};

export type PitchAccentReviewPlayback = {
  readonly currentTimeSeconds: number;
  readonly durationSeconds: number;
  readonly isPlaying: boolean;
};

export type PitchAccentSessionControllerResult = {
  readonly activeReviewGraph: PitchAccentActiveReviewGraph | null;
  readonly awaitingContinue: boolean;
  readonly clientError: string | null;
  readonly completed: boolean;
  readonly currentIndex: number;
  readonly currentTrial: PitchAccentSessionTrialPlan | null;
  readonly feedback: PitchAccentFeedback | null;
  readonly handleChooseOption: (
    optionId: string,
    inputMethod: "keyboard" | "pointer" | "touch"
  ) => void;
  readonly handleContinue: () => void;
  readonly isSubmitting: boolean;
  readonly playOptionAudio: (optionId: string) => void;
  readonly progressPercent: number;
  readonly reviewPlayback: PitchAccentReviewPlayback;
  readonly replayCurrentAudio: () => void;
  readonly selectReviewGraphOption: (optionId: string) => void;
  readonly totalTrials: number;
};

export function usePitchAccentSessionController(
  session: PitchAccentSessionPageData,
  input: {
    readonly audioElement: HTMLAudioElement | null;
    readonly audioModifiers: PitchAccentAudioModifiers;
    readonly pauseAfterCorrect: boolean;
  }
): PitchAccentSessionControllerResult {
  const initialIndex = Math.min(
    Math.max(0, session.answeredCount),
    session.trials.length
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [feedback, setFeedback] = useState<PitchAccentFeedback | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const [activeReviewGraphOptionId, setActiveReviewGraphOptionId] = useState<
    string | null
  >(null);
  const [reviewPlayback, setReviewPlayback] =
    useState<PitchAccentReviewPlayback>(emptyReviewPlayback);
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const autoplayedTrialIdRef = useRef<string | null>(null);
  const reviewAnimationFrameRef = useRef<number | null>(null);
  const modifiedAudioUrlRef = useRef<string | null>(null);
  const presentedAtRef = useRef(0);
  const submittingRef = useRef(false);
  const currentTrial = session.trials[currentIndex] ?? null;
  const completed = currentIndex >= session.trials.length;
  const totalTrials = session.trials.length;
  const activeFeedback =
    feedback?.trialId === currentTrial?.trialId ? feedback : null;
  const activeAwaitingContinue = awaitingContinue && activeFeedback !== null;
  const activeReviewGraph = useMemo((): PitchAccentActiveReviewGraph | null => {
    if (!currentTrial || !activeReviewGraphOptionId || !activeFeedback) {
      return null;
    }

    const option = currentTrial.options.find(
      (candidate) => candidate.id === activeReviewGraphOptionId
    );
    if (!option) {
      return null;
    }

    return {
      graph: session.pitchGraphsByAudioSrc[option.audioSrc] ?? null,
      option,
      optionId: option.id
    };
  }, [
    activeFeedback,
    activeReviewGraphOptionId,
    currentTrial,
    session.pitchGraphsByAudioSrc
  ]);
  const nextCorrectAudio = session.trials[currentIndex + 1]?.options.find(
    (option) => option.id === session.trials[currentIndex + 1]?.correctOptionId
  )?.audioSrc;
  const { muffle, noise } = input.audioModifiers;

  useEffect(() => {
    clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
    cancelReviewAnimationFrame(reviewAnimationFrameRef);
    presentedAtRef.current = performance.now();
  }, [currentTrial?.trialId]);

  useEffect(
    () => () => {
      clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
      cancelReviewAnimationFrame(reviewAnimationFrameRef);
      revokeModifiedAudioUrl(modifiedAudioUrlRef);
    },
    []
  );

  useEffect(() => {
    if (!nextCorrectAudio) {
      return;
    }

    const audio = new Audio(nextCorrectAudio);
    audio.preload = "auto";
  }, [nextCorrectAudio]);

  const playCurrentAudioOption = useCallback(
    (option: PitchAccentPairOption | null | undefined) => {
      const audioElement = input.audioElement;

      if (!audioElement || !option) {
        return;
      }

      void playAudioElementOption(
        audioElement,
        option,
        { muffle, noise },
        modifiedAudioUrlRef
      ).catch(() => {
        playRawAudio(audioElement, option, modifiedAudioUrlRef);
      });
    },
    [input.audioElement, muffle, noise]
  );

  useEffect(() => {
    const correctOption = currentTrial
      ? currentTrial.options.find(
          (option) => option.id === currentTrial.correctOptionId
        )
      : null;

    if (!currentTrial) {
      autoplayedTrialIdRef.current = null;
      return;
    }
    if (!input.audioElement || !correctOption) {
      return;
    }
    if (autoplayedTrialIdRef.current === currentTrial.trialId) {
      return;
    }

    autoplayedTrialIdRef.current = currentTrial.trialId;
    playCurrentAudioOption(correctOption);
  }, [currentTrial, input.audioElement, playCurrentAudioOption]);

  const playOptionAudio = useCallback(
    (optionId: string) => {
      const option = currentTrial?.options.find(
        (candidate) => candidate.id === optionId
      );

      playCurrentAudioOption(option);
    },
    [currentTrial, playCurrentAudioOption]
  );

  const replayCurrentAudio = useCallback(() => {
    const audioElement = input.audioElement;
    const correctOption = currentTrial
      ? currentTrial.options.find(
          (option) => option.id === currentTrial.correctOptionId
        )
      : null;

    if (!audioElement || !correctOption) {
      return;
    }

    void playAudioElementOption(
      audioElement,
      correctOption,
      { muffle, noise },
      modifiedAudioUrlRef
    ).catch(() => {
      playRawAudio(audioElement, correctOption, modifiedAudioUrlRef);
    });
  }, [currentTrial, input.audioElement, muffle, noise]);

  const selectReviewGraphOption = useCallback(
    (optionId: string) => {
      if (!currentTrial || !activeFeedback || activeFeedback.isCorrect) {
        return;
      }

      const option = currentTrial.options.find(
        (candidate) => candidate.id === optionId
      );
      if (!option) {
        return;
      }

      setActiveReviewGraphOptionId(option.id);
      setReviewPlayback(emptyReviewPlayback);
      playCurrentAudioOption(option);
    },
    [activeFeedback, currentTrial, playCurrentAudioOption]
  );

  const handleContinue = useCallback(() => {
    clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
    cancelReviewAnimationFrame(reviewAnimationFrameRef);
    setFeedback(null);
    setAwaitingContinue(false);
    setActiveReviewGraphOptionId(null);
    setReviewPlayback(emptyReviewPlayback);
    setCurrentIndex((current) => current + 1);
  }, []);

  const handleChooseOption = useCallback(
    (optionId: string, inputMethod: "keyboard" | "pointer" | "touch") => {
      if (!currentTrial || submittingRef.current || activeAwaitingContinue) {
        return;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      setClientError(null);
      const responseMs = Math.max(
        0,
        Math.round(performance.now() - presentedAtRef.current)
      );

      void submitPitchAccentAnswerAction({
        chosenOptionId: optionId,
        inputMethod,
        responseMs,
        sessionId: session.sessionId,
        trialId: currentTrial.trialId
      })
        .then((result) => {
          setFeedback({
            chosenOptionId: result.chosenOptionId,
            correctOptionId: result.correctOptionId,
            isCorrect: result.isCorrect,
            responseMs,
            trialId: currentTrial.trialId
          });
          setActiveReviewGraphOptionId(null);
          setReviewPlayback(emptyReviewPlayback);
          if (result.isCorrect && !input.pauseAfterCorrect) {
            clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
            autoAdvanceTimeoutRef.current = window.setTimeout(
              handleContinue,
              750
            );
          } else {
            setAwaitingContinue(true);
          }
        })
        .catch((error: unknown) => {
          setClientError(
            error instanceof Error
              ? error.message
              : "Impossibile salvare la risposta."
          );
        })
        .finally(() => {
          submittingRef.current = false;
          setIsSubmitting(false);
        });
    },
    [
      activeAwaitingContinue,
      currentTrial,
      handleContinue,
      input.pauseAfterCorrect,
      session.sessionId
    ]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableKeyboardTarget(event.target) ||
        isActivationKeyboardTarget(event.target)
      ) {
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        replayCurrentAudio();
        return;
      }

      if (event.key === " " && activeAwaitingContinue) {
        event.preventDefault();
        handleContinue();
        return;
      }

      const optionIndex = Number.parseInt(event.key, 10) - 1;
      const option = currentTrial?.options[optionIndex];
      if (option && !activeFeedback) {
        event.preventDefault();
        handleChooseOption(option.id, "keyboard");
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    activeAwaitingContinue,
    activeFeedback,
    currentTrial,
    handleChooseOption,
    handleContinue,
    replayCurrentAudio
  ]);

  useEffect(() => {
    const audioElement = input.audioElement;

    if (!audioElement) {
      return;
    }

    const readPlayback = (): PitchAccentReviewPlayback => ({
      currentTimeSeconds: Number.isFinite(audioElement.currentTime)
        ? audioElement.currentTime
        : 0,
      durationSeconds: Number.isFinite(audioElement.duration)
        ? audioElement.duration
        : activeReviewGraph?.graph
          ? activeReviewGraph.graph.durationMs / 1000
          : 0,
      isPlaying: !audioElement.paused && !audioElement.ended
    });
    const syncPlayback = () => {
      setReviewPlayback(readPlayback());
    };
    const stopAnimationFrame = () => {
      cancelReviewAnimationFrame(reviewAnimationFrameRef);
      syncPlayback();
    };
    const startAnimationFrame = () => {
      cancelReviewAnimationFrame(reviewAnimationFrameRef);

      const tick = () => {
        syncPlayback();
        reviewAnimationFrameRef.current = window.requestAnimationFrame(tick);
      };

      reviewAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    audioElement.addEventListener("durationchange", syncPlayback);
    audioElement.addEventListener("loadedmetadata", syncPlayback);
    audioElement.addEventListener("timeupdate", syncPlayback);
    audioElement.addEventListener("play", startAnimationFrame);
    audioElement.addEventListener("pause", stopAnimationFrame);
    audioElement.addEventListener("ended", stopAnimationFrame);

    return () => {
      audioElement.removeEventListener("durationchange", syncPlayback);
      audioElement.removeEventListener("loadedmetadata", syncPlayback);
      audioElement.removeEventListener("timeupdate", syncPlayback);
      audioElement.removeEventListener("play", startAnimationFrame);
      audioElement.removeEventListener("pause", stopAnimationFrame);
      audioElement.removeEventListener("ended", stopAnimationFrame);
      cancelReviewAnimationFrame(reviewAnimationFrameRef);
    };
  }, [activeReviewGraph?.graph, input.audioElement]);

  return useMemo(
    () => ({
      activeReviewGraph,
      awaitingContinue: activeAwaitingContinue,
      clientError,
      completed,
      currentIndex,
      currentTrial,
      feedback: activeFeedback,
      handleChooseOption,
      handleContinue,
      isSubmitting,
      playOptionAudio,
      progressPercent:
        totalTrials > 0
          ? Math.round(
              (Math.min(currentIndex, totalTrials) / totalTrials) * 100
            )
          : 0,
      reviewPlayback,
      replayCurrentAudio,
      selectReviewGraphOption,
      totalTrials
    }),
    [
      activeReviewGraph,
      activeAwaitingContinue,
      activeFeedback,
      clientError,
      completed,
      currentIndex,
      currentTrial,
      handleChooseOption,
      handleContinue,
      isSubmitting,
      playOptionAudio,
      reviewPlayback,
      replayCurrentAudio,
      selectReviewGraphOption,
      totalTrials
    ]
  );
}

const emptyReviewPlayback: PitchAccentReviewPlayback = {
  currentTimeSeconds: 0,
  durationSeconds: 0,
  isPlaying: false
};

async function playAudioElementOption(
  audioElement: HTMLAudioElement,
  option: PitchAccentPairOption,
  modifiers: PitchAccentAudioModifiers,
  modifiedAudioUrlRef: MutableRefObject<string | null>
) {
  audioElement.pause();
  audioElement.currentTime = 0;

  if (!modifiers.noise && !modifiers.muffle) {
    playRawAudio(audioElement, option, modifiedAudioUrlRef);
    return;
  }

  const url = await buildModifiedAudioUrl(option.audioSrc, modifiers);
  revokeModifiedAudioUrl(modifiedAudioUrlRef);
  modifiedAudioUrlRef.current = url;
  audioElement.src = url;
  audioElement.load();
  await audioElement.play();
}

function playRawAudio(
  audioElement: HTMLAudioElement,
  option: PitchAccentPairOption,
  modifiedAudioUrlRef: MutableRefObject<string | null>
) {
  revokeModifiedAudioUrl(modifiedAudioUrlRef);
  audioElement.src = option.audioSrc;
  audioElement.load();
  void audioElement.play();
}

async function buildModifiedAudioUrl(
  audioSrc: string,
  modifiers: PitchAccentAudioModifiers
) {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor || typeof OfflineAudioContext === "undefined") {
    throw new Error("Audio modifiers are not supported in this browser.");
  }

  const audioContext = new AudioContextConstructor();
  let buffer: AudioBuffer;
  try {
    const response = await fetch(audioSrc);
    if (!response.ok) {
      throw new Error("Unable to load pitch accent audio.");
    }

    const bytes = await response.arrayBuffer();
    buffer = await audioContext.decodeAudioData(bytes.slice(0));
  } finally {
    void audioContext.close();
  }

  if (modifiers.muffle) {
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    const source = offlineContext.createBufferSource();
    const filter = offlineContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(offlineContext.destination);
    source.start();
    buffer = await offlineContext.startRendering();
  }

  if (modifiers.noise) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const channelData = buffer.getChannelData(channel);
      for (let index = 0; index < channelData.length; index += 1) {
        channelData[index] += (Math.random() * 2 - 1) * 0.02;
      }
    }
  }

  return URL.createObjectURL(await audioBufferToWav(buffer));
}

function clearAutoAdvanceTimeout(
  autoAdvanceTimeoutRef: MutableRefObject<number | null>
) {
  if (autoAdvanceTimeoutRef.current !== null) {
    window.clearTimeout(autoAdvanceTimeoutRef.current);
    autoAdvanceTimeoutRef.current = null;
  }
}

function cancelReviewAnimationFrame(
  reviewAnimationFrameRef: MutableRefObject<number | null>
) {
  if (reviewAnimationFrameRef.current !== null) {
    window.cancelAnimationFrame(reviewAnimationFrameRef.current);
    reviewAnimationFrameRef.current = null;
  }
}

function revokeModifiedAudioUrl(
  modifiedAudioUrlRef: MutableRefObject<string | null>
) {
  if (modifiedAudioUrlRef.current) {
    URL.revokeObjectURL(modifiedAudioUrlRef.current);
    modifiedAudioUrlRef.current = null;
  }
}

async function audioBufferToWav(buffer: AudioBuffer) {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  offset = writeString(view, offset, "RIFF");
  view.setUint32(offset, length - 8, true);
  offset += 4;
  offset = writeString(view, offset, "WAVEfmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, buffer.numberOfChannels, true);
  offset += 2;
  view.setUint32(offset, buffer.sampleRate, true);
  offset += 4;
  view.setUint32(offset, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  offset += 4;
  view.setUint16(offset, buffer.numberOfChannels * 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  offset = writeString(view, offset, "data");
  view.setUint32(offset, length - offset - 4, true);
  offset += 4;

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index)
  );

  for (let index = 0; index < buffer.length; index += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[index] ?? 0));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }

  return offset + value.length;
}

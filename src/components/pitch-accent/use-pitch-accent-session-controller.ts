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

export type PitchAccentSessionControllerResult = {
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
  readonly replayCurrentAudio: () => void;
  readonly totalTrials: number;
};

export function usePitchAccentSessionController(
  session: PitchAccentSessionPageData,
  input: {
    readonly audioElement: HTMLAudioElement | null;
    readonly audioModifiers: PitchAccentAudioModifiers;
    readonly pauseAfterCorrect: boolean;
    readonly reviewAudioElement?: HTMLAudioElement | null;
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
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const autoplayedTrialIdRef = useRef<string | null>(null);
  const primaryModifiedAudioUrlRef = useRef<string | null>(null);
  const reviewModifiedAudioUrlRef = useRef<string | null>(null);
  const presentedAtRef = useRef(0);
  const submittingRef = useRef(false);
  const currentTrial = session.trials[currentIndex] ?? null;
  const completed = currentIndex >= session.trials.length;
  const totalTrials = session.trials.length;
  const activeFeedback =
    feedback?.trialId === currentTrial?.trialId ? feedback : null;
  const activeAwaitingContinue = awaitingContinue && activeFeedback !== null;
  const nextCorrectAudio = session.trials[currentIndex + 1]?.options.find(
    (option) => option.id === session.trials[currentIndex + 1]?.correctOptionId
  )?.audioSrc;
  const { muffle, noise } = input.audioModifiers;

  useEffect(() => {
    clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
    presentedAtRef.current = performance.now();
  }, [currentTrial?.trialId]);

  useEffect(
    () => () => {
      clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
      revokeModifiedAudioUrl(primaryModifiedAudioUrlRef);
      revokeModifiedAudioUrl(reviewModifiedAudioUrlRef);
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

  const playPrimaryAudioOption = useCallback(
    (option: PitchAccentPairOption | null | undefined) => {
      const audioElement = input.audioElement;

      if (!audioElement || !option) {
        return;
      }

      void playAudioElementOption(
        audioElement,
        option,
        { muffle, noise },
        primaryModifiedAudioUrlRef
      ).catch(() => {
        void playRawAudio(
          audioElement,
          option,
          primaryModifiedAudioUrlRef
        ).catch(() => {});
      });
    },
    [input.audioElement, muffle, noise]
  );

  const playReviewAudioOption = useCallback(
    (option: PitchAccentPairOption | null | undefined) => {
      const audioElement = input.reviewAudioElement;

      if (!audioElement || !option) {
        return;
      }

      void playAudioElementOption(
        audioElement,
        option,
        { muffle, noise },
        reviewModifiedAudioUrlRef
      ).catch(() => {
        void playRawAudio(
          audioElement,
          option,
          reviewModifiedAudioUrlRef
        ).catch(() => {});
      });
    },
    [input.reviewAudioElement, muffle, noise]
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
    playPrimaryAudioOption(correctOption);
  }, [currentTrial, input.audioElement, playPrimaryAudioOption]);

  const playOptionAudio = useCallback(
    (optionId: string) => {
      const option = currentTrial?.options.find(
        (candidate) => candidate.id === optionId
      );

      playReviewAudioOption(option);
    },
    [currentTrial, playReviewAudioOption]
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
      primaryModifiedAudioUrlRef
    ).catch(() => {
      void playRawAudio(
        audioElement,
        correctOption,
        primaryModifiedAudioUrlRef
      ).catch(() => {});
    });
  }, [currentTrial, input.audioElement, muffle, noise]);

  const handleContinue = useCallback(() => {
    if (submittingRef.current) {
      return;
    }

    clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
    stopAudioElement(input.reviewAudioElement ?? null);
    setFeedback(null);
    setAwaitingContinue(false);
    const nextTrial = session.trials[currentIndex + 1] ?? null;
    const nextCorrectOption = nextTrial
      ? nextTrial.options.find(
          (option) => option.id === nextTrial.correctOptionId
        )
      : null;

    if (nextTrial && nextCorrectOption && input.audioElement) {
      autoplayedTrialIdRef.current = nextTrial.trialId;
      playPrimaryAudioOption(nextCorrectOption);
    }

    setCurrentIndex((current) => current + 1);
  }, [
    currentIndex,
    input.audioElement,
    input.reviewAudioElement,
    playPrimaryAudioOption,
    session.trials
  ]);

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
      const optimisticFeedback: PitchAccentFeedback = {
        chosenOptionId: optionId,
        correctOptionId: currentTrial.correctOptionId,
        isCorrect: optionId === currentTrial.correctOptionId,
        responseMs,
        trialId: currentTrial.trialId
      };

      setFeedback(optimisticFeedback);
      setAwaitingContinue(
        !optimisticFeedback.isCorrect || input.pauseAfterCorrect
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
          const shouldAwaitContinue =
            !result.isCorrect || input.pauseAfterCorrect;
          setAwaitingContinue(shouldAwaitContinue);
          if (!shouldAwaitContinue) {
            clearAutoAdvanceTimeout(autoAdvanceTimeoutRef);
            autoAdvanceTimeoutRef.current = window.setTimeout(
              handleContinue,
              750
            );
          }
        })
        .catch((error: unknown) => {
          setFeedback(null);
          setAwaitingContinue(false);
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

  return useMemo(
    () => ({
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
      replayCurrentAudio,
      totalTrials
    }),
    [
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
      replayCurrentAudio,
      totalTrials
    ]
  );
}

async function playAudioElementOption(
  audioElement: HTMLAudioElement,
  option: PitchAccentPairOption,
  modifiers: PitchAccentAudioModifiers,
  modifiedAudioUrlRef: MutableRefObject<string | null>
) {
  stopAudioElement(audioElement);

  if (!modifiers.noise && !modifiers.muffle) {
    await playRawAudio(audioElement, option, modifiedAudioUrlRef);
    return;
  }

  const url = await buildModifiedAudioUrl(option.audioSrc, modifiers);
  revokeModifiedAudioUrl(modifiedAudioUrlRef);
  modifiedAudioUrlRef.current = url;
  audioElement.src = url;
  loadAudioElement(audioElement);
  await audioElement.play();
}

async function playRawAudio(
  audioElement: HTMLAudioElement,
  option: PitchAccentPairOption,
  modifiedAudioUrlRef: MutableRefObject<string | null>
) {
  revokeModifiedAudioUrl(modifiedAudioUrlRef);
  audioElement.src = option.audioSrc;
  loadAudioElement(audioElement);
  await audioElement.play();
}

function stopAudioElement(audioElement: HTMLAudioElement | null) {
  if (!audioElement) {
    return;
  }

  try {
    audioElement.pause();
  } catch {
    // Ignore browser-specific media state failures.
  }

  try {
    audioElement.currentTime = 0;
  } catch {
    // Safari can reject seeking before metadata is ready.
  }
}

function loadAudioElement(audioElement: HTMLAudioElement) {
  try {
    audioElement.load();
  } catch {
    // Ignore browser-specific media loading failures; play() reports the outcome.
  }
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

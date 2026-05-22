"use client";

import { useEffect, useRef } from "react";

type ConsolidationMeaningAudioInput = {
  audioSrc?: string;
  phase: "answering" | "feedback" | "retrieval";
  step: "meaning" | "reading";
  subjectKey: string;
};

export function useConsolidationMeaningAudio({
  audioSrc,
  phase,
  step,
  subjectKey
}: ConsolidationMeaningAudioInput) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedSourceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!audioSrc || typeof document === "undefined") {
      return;
    }

    const audio = audioRef.current ?? document.createElement("audio");
    audioRef.current = audio;
    audio.preload = "auto";

    if (loadedSourceRef.current !== audioSrc) {
      audio.src = audioSrc;
      loadedSourceRef.current = audioSrc;
    }

    audio.load();

    return () => {
      audio.pause();
    };
  }, [audioSrc]);

  useEffect(() => {
    if (!audioSrc || phase !== "retrieval" || step !== "meaning") {
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    try {
      audio.currentTime = 0;
      const playback = audio.play();

      if (typeof playback.catch === "function") {
        void playback.catch(() => {});
      }
    } catch {
      // Browser autoplay policy can reject rare gesture-less first cards.
    }

    return () => {
      audio.pause();
    };
  }, [audioSrc, phase, step, subjectKey]);
}

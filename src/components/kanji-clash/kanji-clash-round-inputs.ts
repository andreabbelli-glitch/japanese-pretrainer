"use client";

import { useCallback, useEffect, useRef, type TouchEventHandler } from "react";

import type { KanjiClashRoundSide } from "@/lib/kanji-clash/types";

import {
  resolveKanjiClashRoundSideFromKey,
  resolveKanjiClashRoundSideFromSwipe,
  shouldIgnoreKanjiClashKeyboardTarget
} from "./kanji-clash-interactions";

const SWIPE_CLICK_SUPPRESSION_MS = 350;

type TouchPoint = {
  x: number;
  y: number;
};

export function useKanjiClashRoundInputs(input: {
  isSelectionLocked: boolean;
  onChooseSide: (side: KanjiClashRoundSide) => void;
}) {
  const suppressNextClickRef = useRef(false);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const { isSelectionLocked, onChooseSide } = input;

  const handleChooseSide = useCallback(
    (side: KanjiClashRoundSide) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }

      onChooseSide(side);
    },
    [onChooseSide]
  );

  const handleTouchStart = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (isSelectionLocked) {
        return;
      }

      const touch = event.touches[0];

      if (!touch) {
        return;
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY
      };
    },
    [isSelectionLocked]
  );

  const handleTouchEnd = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      const start = touchStartRef.current;

      touchStartRef.current = null;

      if (!start || isSelectionLocked) {
        return;
      }

      const touch = event.changedTouches[0];

      if (!touch) {
        return;
      }

      const side = resolveKanjiClashRoundSideFromSwipe(
        touch.clientX - start.x,
        touch.clientY - start.y
      );

      if (!side) {
        return;
      }

      event.preventDefault();
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, SWIPE_CLICK_SUPPRESSION_MS);
      onChooseSide(side);
    },
    [isSelectionLocked, onChooseSide]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isSelectionLocked ||
        shouldIgnoreKanjiClashKeyboardTarget(event.target)
      ) {
        return;
      }

      const side = resolveKanjiClashRoundSideFromKey(event.key);

      if (!side) {
        return;
      }

      event.preventDefault();
      onChooseSide(side);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSelectionLocked, onChooseSide]);

  return {
    handleChooseSide,
    handleTouchEnd,
    handleTouchStart
  };
}

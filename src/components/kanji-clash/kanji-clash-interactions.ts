import type { KanjiClashRoundSide } from "@/features/kanji-clash/types";

export const KANJI_CLASH_SWIPE_MIN_DISTANCE_PX = 24;
const KANJI_CLASH_SWIPE_MIN_RATIO = 1.25;

export function resolveKanjiClashRoundSideFromKey(
  key: string
): KanjiClashRoundSide | null {
  if (key === "ArrowLeft") {
    return "left";
  }

  if (key === "ArrowRight") {
    return "right";
  }

  return null;
}

export function resolveKanjiClashRoundSideFromSwipe(
  deltaX: number,
  deltaY: number
): KanjiClashRoundSide | null {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (horizontalDistance < KANJI_CLASH_SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  if (horizontalDistance < verticalDistance * KANJI_CLASH_SWIPE_MIN_RATIO) {
    return null;
  }

  return deltaX < 0 ? "left" : "right";
}

export function shouldIgnoreKanjiClashKeyboardTarget(
  target: EventTarget | null
) {
  if (typeof HTMLElement === "undefined") {
    return false;
  }

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

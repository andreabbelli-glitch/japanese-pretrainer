import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedItemState,
  KatakanaSpeedState
} from "../types.ts";
import {
  getKatakanaSpeedCatalog,
  getKatakanaSpeedItemById
} from "./catalog.ts";
import { classifyKatakanaSpeedError } from "./errors.ts";

export function createInitialKatakanaSpeedState(input: {
  now: Date | string;
}): KatakanaSpeedState {
  const nowIso = toDate(input.now).toISOString();
  const items = Object.fromEntries(
    getKatakanaSpeedCatalog().map((item) => [
      item.id,
      createInitialItemState(item.id)
    ])
  );

  return {
    createdAt: nowIso,
    items,
    schedulerVersion: "katakana_speed_mvp_v1",
    updatedAt: nowIso
  };
}

export function updateKatakanaSpeedStateAfterAttempt(input: {
  actualSurface: string;
  expectedSurface: string;
  itemId: string;
  now: Date | string;
  responseMs: number;
  state: KatakanaSpeedState;
}): KatakanaSpeedState {
  const item = getKatakanaSpeedItemById(input.itemId);
  const current =
    input.state.items[input.itemId] ?? createInitialItemState(input.itemId);
  const targetRtMs = item?.targetRtMs ?? 950;
  const errorTags = classifyKatakanaSpeedError({
    actualSurface: input.actualSurface,
    expectedSurface: input.expectedSurface,
    responseMs: input.responseMs,
    targetRtMs
  });
  const correct = input.actualSurface === input.expectedSurface;
  const slow = errorTags.includes("slow_correct");
  const fluentCorrect = correct && !slow;
  const nowIso = toDate(input.now).toISOString();
  const nextItem: KatakanaSpeedItemState = {
    correctStreak: fluentCorrect ? current.correctStreak + 1 : 0,
    itemId: input.itemId,
    lapses: correct ? current.lapses : current.lapses + 1,
    lastAttemptAt: nowIso,
    lastCorrectAt: fluentCorrect ? nowIso : current.lastCorrectAt,
    lastErrorTags: errorTags,
    lastResponseMs: input.responseMs,
    reps: current.reps + 1,
    slowStreak: slow
      ? current.slowStreak + 1
      : fluentCorrect
        ? 0
        : current.slowStreak,
    status:
      fluentCorrect && current.correctStreak + 1 >= 2 ? "review" : "learning"
  };

  return {
    ...input.state,
    items: {
      ...input.state.items,
      [input.itemId]: nextItem
    },
    updatedAt: nowIso
  };
}

export function computeKatakanaSpeedPriority(input: {
  itemId: string;
  now: Date | string;
  state: KatakanaSpeedState;
}): number {
  const item = getKatakanaSpeedItemById(input.itemId);
  const itemState =
    input.state.items[input.itemId] ?? createInitialItemState(input.itemId);
  const rarityBase =
    item?.rarity === "rare" ? 18 : item?.rarity === "edge" ? 30 : 44;
  const statusBase =
    itemState.status === "new"
      ? rarityBase
      : itemState.status === "learning"
        ? 52
        : 22;
  const errorWeight = scoreErrorTags(itemState.lastErrorTags);
  const lapseWeight = itemState.lapses * 22;
  const slowWeight = itemState.slowStreak * 14;
  const stabilityPenalty = itemState.correctStreak * 16 + itemState.reps * 4;
  const recencyPenalty = itemState.lastAttemptAt
    ? Math.max(
        0,
        12 -
          (toDate(input.now).getTime() -
            toDate(itemState.lastAttemptAt).getTime()) /
            60_000
      )
    : 0;

  return roundTo(
    statusBase +
      errorWeight +
      lapseWeight +
      slowWeight -
      stabilityPenalty -
      recencyPenalty,
    3
  );
}

function createInitialItemState(itemId: string): KatakanaSpeedItemState {
  return {
    correctStreak: 0,
    itemId,
    lapses: 0,
    lastAttemptAt: null,
    lastCorrectAt: null,
    lastErrorTags: [],
    lastResponseMs: null,
    reps: 0,
    slowStreak: 0,
    status: "new"
  };
}

function scoreErrorTags(tags: readonly KatakanaSpeedErrorTag[]) {
  if (
    tags.includes("visual_confusion") ||
    tags.includes("phonological_confusion")
  ) {
    return 54;
  }
  if (
    tags.includes("small_kana_ignored") ||
    tags.includes("long_vowel_missed") ||
    tags.includes("sokuon_missed")
  ) {
    return 42;
  }
  if (tags.includes("unclassified_error")) {
    return 34;
  }
  if (tags.includes("slow_correct")) {
    return 24;
  }

  return 0;
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

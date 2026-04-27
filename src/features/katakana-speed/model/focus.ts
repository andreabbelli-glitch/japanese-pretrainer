import type {
  KatakanaSpeedErrorTag,
  KatakanaSpeedItem,
  KatakanaSpeedItemKind,
  KatakanaSpeedSelfRating,
  KatakanaSpeedState
} from "../types.ts";
import { getKatakanaSpeedCatalog } from "./catalog.ts";

export type KatakanaTrainingFocusKind =
  | "chunk_confusion"
  | "visual_confusion"
  | "mora_contrast"
  | "general_speed";

export type KatakanaTrainingFocus = {
  readonly distractorChunks: readonly string[];
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
  readonly id: string;
  readonly kind: KatakanaTrainingFocusKind;
  readonly label: string;
  readonly priority: number;
  readonly targetChunks: readonly string[];
};

export type KatakanaSpeedCorrectnessSource =
  | "objective"
  | "self_report"
  | "aggregate_manual";

export type KatakanaSpeedFocusAttempt = {
  readonly correct: boolean | null;
  readonly correctnessSource: KatakanaSpeedCorrectnessSource;
  readonly errorTags: readonly KatakanaSpeedErrorTag[];
  readonly focusChunks: readonly string[];
  readonly selfRating?: KatakanaSpeedSelfRating | null;
};

export const KATAKANA_SPEED_FOCUSES: readonly KatakanaTrainingFocus[] = [
  focus(0, {
    distractorChunks: ["チ", "テイ", "ディ", "テュ"],
    errorTags: ["small_kana_ignored", "phonological_confusion"],
    id: "ti-chi-tei",
    kind: "chunk_confusion",
    label: "ティ / チ / テイ",
    targetChunks: ["ティ"]
  }),
  focus(1, {
    distractorChunks: ["ジ", "デイ", "ドゥ", "デュ", "ティ"],
    errorTags: ["small_kana_ignored", "phonological_confusion"],
    id: "di-ji-dei",
    kind: "chunk_confusion",
    label: "ディ / ジ / デイ",
    targetChunks: ["ディ"]
  }),
  focus(2, {
    distractorChunks: ["ハ", "ヒ", "ヘ", "ホ", "フュ"],
    errorTags: ["phonological_confusion"],
    id: "f-family",
    kind: "chunk_confusion",
    label: "ファ/フィ/フェ/フォ",
    targetChunks: ["ファ", "フィ", "フェ", "フォ"]
  }),
  focus(3, {
    distractorChunks: ["ウエ", "ウオ", "エ", "オ", "イ"],
    errorTags: ["small_kana_ignored", "phonological_confusion"],
    id: "w-family",
    kind: "chunk_confusion",
    label: "ウェ / ウォ",
    targetChunks: ["ウェ", "ウォ", "ウィ"]
  }),
  focus(4, {
    distractorChunks: ["バ", "ビ", "ベ", "ボ"],
    errorTags: ["phonological_confusion"],
    id: "v-family",
    kind: "chunk_confusion",
    label: "ヴァ/ヴィ/ヴェ/ヴォ",
    targetChunks: ["ヴァ", "ヴィ", "ヴェ", "ヴォ"]
  }),
  focus(5, {
    distractorChunks: ["ジュ", "ディ", "デユ"],
    errorTags: ["small_kana_ignored", "phonological_confusion"],
    id: "dyu-dhu-ju",
    kind: "chunk_confusion",
    label: "デュ / ドゥ / ジュ",
    targetChunks: ["デュ", "ドゥ"]
  }),
  focus(6, {
    distractorChunks: [],
    errorTags: ["sokuon_missed"],
    id: "sokuon",
    kind: "mora_contrast",
    label: "小さいッ",
    targetChunks: ["ッ"]
  }),
  focus(7, {
    distractorChunks: [],
    errorTags: ["long_vowel_missed"],
    id: "long-vowel",
    kind: "mora_contrast",
    label: "長音ー",
    targetChunks: ["ー"]
  }),
  focus(8, {
    distractorChunks: [],
    errorTags: ["visual_confusion"],
    id: "visual-shi-tsu",
    kind: "visual_confusion",
    label: "シ / ツ / ソ / ン",
    targetChunks: ["シ", "ツ", "ソ", "ン"]
  })
];

export function pickKatakanaTrainingFocus(input: {
  readonly now: Date | string;
  readonly recentAttempts?: readonly KatakanaSpeedFocusAttempt[];
  readonly state: KatakanaSpeedState;
}): KatakanaTrainingFocus {
  const scored = KATAKANA_SPEED_FOCUSES.map((candidate, index) => ({
    focus: candidate,
    index,
    score: computeFocusPriority({
      focus: candidate,
      now: input.now,
      recentAttempts: input.recentAttempts ?? [],
      state: input.state
    })
  })).sort(
    (left, right) =>
      right.score - left.score ||
      left.focus.priority - right.focus.priority ||
      left.index - right.index
  );

  const best = scored[0];
  if (!best || best.score <= 0) {
    return KATAKANA_SPEED_FOCUSES[0]!;
  }

  return best.focus;
}

export function computeFocusPriority(input: {
  readonly focus: KatakanaTrainingFocus;
  readonly now: Date | string;
  readonly recentAttempts: readonly KatakanaSpeedFocusAttempt[];
  readonly state: KatakanaSpeedState;
}): number {
  const attempts = input.recentAttempts.filter((attempt) =>
    attemptMatchesFocus(attempt, input.focus)
  );
  const objectiveWrong = attempts.filter(
    (attempt) =>
      attempt.correct === false && attempt.correctnessSource === "objective"
  ).length;
  const selfWrong = attempts.filter(
    (attempt) => attempt.selfRating === "wrong"
  ).length;
  const hesitated = attempts.filter(
    (attempt) => attempt.selfRating === "hesitated"
  ).length;
  const slowCorrect = attempts.filter((attempt) =>
    attempt.errorTags.includes("slow_correct")
  ).length;
  const stateScore = getItemsForFocus({ focus: input.focus, includeRare: true })
    .map((item) => input.state.items[item.id])
    .filter((itemState) => itemState !== undefined)
    .reduce(
      (total, itemState) =>
        total +
        itemState.lapses * 28 +
        itemState.slowStreak * 14 +
        itemState.lastErrorTags.length * 10,
      0
    );
  const recentSeen = attempts.length;
  return (
    objectiveWrong * 40 +
    selfWrong * 22 +
    hesitated * 12 +
    slowCorrect * 18 +
    stateScore -
    recentSeen * 2
  );
}

export function getItemsForFocus(input: {
  readonly focus: KatakanaTrainingFocus;
  readonly includeRare?: boolean;
  readonly kind?: KatakanaSpeedItemKind | readonly KatakanaSpeedItemKind[];
}): KatakanaSpeedItem[] {
  const kinds = Array.isArray(input.kind)
    ? input.kind
    : input.kind
      ? [input.kind]
      : null;
  const targetChunks = new Set(input.focus.targetChunks);

  return getKatakanaSpeedCatalog().filter((item) => {
    if (kinds && !kinds.includes(item.kind)) {
      return false;
    }
    if (!input.includeRare && item.rarity === "rare") {
      return false;
    }

    return (
      item.focusChunks.some((chunk) => targetChunks.has(chunk)) ||
      item.displaySegments.some((segment) => targetChunks.has(segment)) ||
      input.focus.targetChunks.some((chunk) => item.surface.includes(chunk))
    );
  });
}

function focus(
  priority: number,
  input: {
    readonly distractorChunks: readonly string[];
    readonly errorTags: readonly KatakanaSpeedErrorTag[];
    readonly id: string;
    readonly kind: KatakanaTrainingFocusKind;
    readonly label: string;
    readonly targetChunks: readonly string[];
  }
): KatakanaTrainingFocus {
  return {
    ...input,
    priority
  };
}

function attemptMatchesFocus(
  attempt: KatakanaSpeedFocusAttempt,
  focus: KatakanaTrainingFocus
) {
  const targetChunks = new Set(focus.targetChunks);
  if (attempt.focusChunks.length > 0) {
    return attempt.focusChunks.some((chunk) => targetChunks.has(chunk));
  }

  return attempt.errorTags.some((tag) => focus.errorTags.includes(tag));
}

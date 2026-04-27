import type { KatakanaSpeedSelfRating } from "../types.ts";

export function isKatakanaSpeedAnswerCorrect(input: {
  readonly expectedSurface: string;
  readonly interaction?: unknown;
  readonly userAnswer: string;
}): boolean {
  const expectedSurface = input.expectedSurface.trim();
  const userAnswer = input.userAnswer.trim();

  if (userAnswer === expectedSurface) {
    return true;
  }

  return false;
}

export type KatakanaSpeedTransferStatus =
  | "blocked"
  | "developing"
  | "transfer_ready";

export function scoreKatakanaSpeedPseudowordTransfer(input: {
  moraCount: number;
  responseMs: number;
  selfRating: KatakanaSpeedSelfRating;
}): {
  readonly rtPerMora: number;
  readonly status: KatakanaSpeedTransferStatus;
} {
  const rtPerMora = safeRate(input.responseMs, input.moraCount);
  const ratingPenalty =
    input.selfRating === "wrong"
      ? 350
      : input.selfRating === "hesitated"
        ? 150
        : 0;
  const adjustedRtPerMora = rtPerMora + ratingPenalty;

  return {
    rtPerMora,
    status:
      adjustedRtPerMora <= 450
        ? "transfer_ready"
        : adjustedRtPerMora <= 700
          ? "developing"
          : "blocked"
  };
}

export function scoreKatakanaSpeedSentenceSprint(input: {
  moraCount: number;
  responseMs: number;
}): {
  readonly msPerMora: number;
  readonly status: "fluent" | "steady" | "slow";
} {
  const msPerMora = safeRate(input.responseMs, input.moraCount);

  return {
    msPerMora,
    status: msPerMora <= 280 ? "fluent" : msPerMora <= 420 ? "steady" : "slow"
  };
}

export function scoreKatakanaSpeedRanGrid(input: {
  correctItems: number;
  responseMs: number;
  totalItems: number;
}): {
  readonly adjustedItemsPerSecond: number;
  readonly itemsPerSecond: number;
} {
  const totalItems = Math.max(0, input.totalItems);
  const correctItems = Math.max(0, Math.min(input.correctItems, totalItems));
  const seconds = Math.max(0.001, input.responseMs / 1000);
  const itemsPerSecond = totalItems / seconds;
  const accuracy = totalItems === 0 ? 0 : correctItems / totalItems;

  return {
    adjustedItemsPerSecond: roundTo(itemsPerSecond * accuracy ** 2, 3),
    itemsPerSecond: roundTo(itemsPerSecond, 3)
  };
}

function safeRate(numerator: number, denominator: number) {
  return roundTo(numerator / Math.max(1, denominator), 3);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

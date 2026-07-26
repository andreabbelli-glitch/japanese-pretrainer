export {
  REVIEW_MEMORY_KEY_VERSION,
  reviewRecallTaskValues,
  type ReviewRecallTask
} from "../../../domain/review.ts";

import {
  REVIEW_MEMORY_KEY_VERSION,
  type ReviewRecallTask
} from "../../../domain/review.ts";

export function resolveReviewRecallTask(cardType: string): ReviewRecallTask {
  if (cardType === "recognition" || cardType === "concept") {
    return cardType;
  }

  return "other";
}

export function buildReviewMemoryKey(input: {
  canonicalSubjectKey: string;
  cardId: string;
  recallTask: ReviewRecallTask;
}) {
  const memorySubjectKey =
    input.recallTask === "other"
      ? `card:${input.cardId}`
      : input.canonicalSubjectKey;

  return `${REVIEW_MEMORY_KEY_VERSION}:${input.recallTask}:${memorySubjectKey}`;
}

export function resolveEffectiveReviewEventMemoryKey(input: {
  canonicalSubjectKey?: string | null;
  cardId: string;
  eventSchemaVersion: number;
  memoryKey?: string | null;
  recallTask?: ReviewRecallTask | null;
  subjectKey: string;
}) {
  const persistedMemoryKey = input.memoryKey?.trim();

  if (input.eventSchemaVersion >= 2 && persistedMemoryKey) {
    return persistedMemoryKey;
  }

  return buildReviewMemoryKey({
    canonicalSubjectKey: input.canonicalSubjectKey?.trim() || input.subjectKey,
    cardId: input.cardId,
    recallTask: input.recallTask ?? "other"
  });
}

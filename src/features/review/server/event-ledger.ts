import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "@/db";
import { reviewSubjectLog } from "@/db/schema";
import type { ReviewEventKind } from "@/domain/review";
import type { buildFsrsParameterSet } from "@/features/fsrs-optimizer/server/parameter-set";
import type {
  ReviewRating,
  ReviewSchedulerVersion,
  ReviewState
} from "@/features/review/model/scheduler";
import { CURRENT_REVIEW_SCHEDULER_VERSION } from "@/features/review/model/scheduler";
import {
  getReviewStudyDay,
  getReviewStudyDayPolicyKey
} from "@/features/review/model/study-day";
import type { ReviewSubjectIdentity } from "@/features/review/model/subject";

type ReviewEventWriter = Pick<DatabaseClient, "insert">;
type FsrsParameterSet = ReturnType<typeof buildFsrsParameterSet>;

type ReviewEventStateLike = {
  difficulty?: number | null;
  dueAt?: string | null;
  lapses?: number;
  lastReviewedAt?: string | null;
  learningSteps?: number;
  manualOverride?: boolean;
  reps?: number;
  scheduledDays?: number;
  schedulerVersion?: ReviewSchedulerVersion;
  stability?: number | null;
  state?: ReviewState;
  suspended?: boolean;
  updatedAt?: string;
};

export type ReviewEventInput = {
  afterState: ReviewEventStateLike | null;
  answeredAt: string;
  batchId?: string | null;
  beforeState: ReviewEventStateLike | null;
  cardId: string;
  cardType: string;
  elapsedDays?: number | null;
  eventKind: ReviewEventKind;
  identity: ReviewSubjectIdentity;
  mediaId: string;
  parameterSet?: FsrsParameterSet | null;
  rating?: ReviewRating | null;
  reason?: string | null;
  responseMs?: number | null;
  subjectKey?: string;
};

export async function appendReviewEvent(
  database: ReviewEventWriter,
  input: ReviewEventInput
) {
  const event = buildReviewEventRecord(input);

  await database.insert(reviewSubjectLog).values(event);

  return event.id;
}

export function buildReviewEventRecord(input: ReviewEventInput) {
  const beforeStateJson = serializeReviewEventState(input.beforeState);
  const afterStateJson = serializeReviewEventState(input.afterState);
  const eventId = `review_event_${randomUUID()}`;

  return {
    afterStateJson,
    algorithmVersion: input.parameterSet?.algorithmVersion ?? "fsrs6",
    answeredAt: input.answeredAt,
    batchId: input.batchId ?? null,
    beforeStateJson,
    bindingVersion: input.parameterSet?.bindingVersion ?? null,
    canonicalSubjectKey: input.identity.canonicalSubjectKey,
    cardId: input.cardId,
    cardTypeSnapshot: input.cardType,
    elapsedDays: input.elapsedDays ?? null,
    eventKind: input.eventKind,
    eventSchemaVersion: 2,
    id: eventId,
    mediaIdSnapshot: input.mediaId,
    memoryKey: input.identity.memoryKey,
    newState: input.afterState?.state ?? null,
    parameterHash: input.parameterSet?.parameterHash ?? null,
    previousDueAt: input.beforeState?.dueAt ?? null,
    previousState: input.beforeState?.state ?? null,
    rating: input.rating ?? null,
    recallTask: input.identity.recallTask,
    reason: input.reason ?? null,
    recordedAt: input.answeredAt,
    responseMs: input.responseMs ?? null,
    scheduledDueAt: input.afterState?.dueAt ?? null,
    schedulerVersion:
      input.afterState?.schedulerVersion ??
      input.beforeState?.schedulerVersion ??
      CURRENT_REVIEW_SCHEDULER_VERSION,
    studyDay: getReviewStudyDay(input.answeredAt),
    studyDayPolicy: getReviewStudyDayPolicyKey(),
    subjectKey: input.subjectKey ?? input.identity.subjectKey
  } satisfies typeof reviewSubjectLog.$inferInsert;
}

function serializeReviewEventState(state: ReviewEventStateLike | null) {
  if (!state) {
    return null;
  }

  return JSON.stringify({
    difficulty: state.difficulty ?? null,
    dueAt: state.dueAt ?? null,
    lapses: state.lapses ?? 0,
    lastReviewedAt: state.lastReviewedAt ?? null,
    learningSteps: state.learningSteps ?? 0,
    manualOverride: state.manualOverride ?? false,
    reps: state.reps ?? 0,
    scheduledDays: state.scheduledDays ?? 0,
    schedulerVersion:
      state.schedulerVersion ?? CURRENT_REVIEW_SCHEDULER_VERSION,
    stability: state.stability ?? null,
    state: state.state ?? "new",
    suspended: state.suspended ?? false,
    updatedAt: state.updatedAt ?? null
  });
}

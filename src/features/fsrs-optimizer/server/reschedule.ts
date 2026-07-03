import { eq } from "drizzle-orm";

import { db, type DatabaseClient } from "@/db";
import {
  listReviewSubjectFsrsReplaySubjects,
  type ReviewSubjectFsrsReplayLogRecord,
  type ReviewSubjectFsrsReplaySubject
} from "@/db/queries";
import { reviewSubjectState } from "@/db/schema";
import { getLocalIsoDateKey } from "@/features/shared/model/local-date";
import {
  replayReviewHistory,
  type ReplayReviewHistoryOptions,
  type ReplayedReviewHistory,
  type ReviewLogReplayInput,
  type ReviewSchedulerRuntimeConfig
} from "@/features/review/model/scheduler";

import {
  resolveFsrsPresetKey,
  type FsrsOptimizerSnapshot
} from "../model/snapshot";
import {
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerSnapshot
} from "./settings-store";

const FSRS_RESCHEDULE_HORIZON_DAYS = 30;
const DAY = 24 * 60 * 60_000;

type FsrsRescheduleTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export type FsrsRescheduleDayDelta = {
  currentCount: number;
  date: string;
  delta: number;
  proposedCount: number;
};

export type FsrsRescheduleSummary = {
  affectedSubjects: number;
  currentDue30Days: number;
  currentDue7Days: number;
  currentDueToday: number;
  delta30Days: number;
  delta7Days: number;
  deltaDueToday: number;
  eligibleSubjects: number;
  movedEarlier: number;
  movedLater: number;
  proposedDue30Days: number;
  proposedDue7Days: number;
  proposedDueToday: number;
  skippedNoHistory: number;
  unchangedSubjects: number;
};

export type FsrsReschedulePreview = {
  days: FsrsRescheduleDayDelta[];
  fsrsCacheKeyPart: string;
  generatedAt: string;
  horizonDays: number;
  summary: FsrsRescheduleSummary;
};

export type FsrsRescheduleApplyResult = {
  affectedSubjects: number;
  fsrsCacheKeyPart: string;
  status: "applied" | "noop" | "stale";
};

type FsrsRescheduleCandidate = {
  currentDueAt: string | null;
  projected: ReplayedReviewHistory["state"];
  subject: ReviewSubjectFsrsReplaySubject;
};

type FsrsReschedulePlan = FsrsReschedulePreview & {
  candidates: FsrsRescheduleCandidate[];
};

export async function buildFsrsReschedulePreview(
  input: {
    database?: DatabaseClient;
    now?: Date;
  } = {}
): Promise<FsrsReschedulePreview> {
  const plan = await buildFsrsReschedulePlan({
    database: input.database ?? db,
    now: input.now ?? new Date()
  });

  return stripFsrsReschedulePlanCandidates(plan);
}

export async function applyFsrsReschedule(input: {
  database?: DatabaseClient;
  expectedFsrsCacheKeyPart: string;
  now?: Date;
}): Promise<FsrsRescheduleApplyResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  return database.transaction(async (tx) => {
    const fsrsCacheKeyPart = await getFsrsOptimizerCacheKeyPart(tx);

    if (fsrsCacheKeyPart !== input.expectedFsrsCacheKeyPart) {
      return {
        affectedSubjects: 0,
        fsrsCacheKeyPart,
        status: "stale" as const
      };
    }

    const plan = await buildFsrsReschedulePlan({
      database: tx,
      now
    });

    if (plan.candidates.length === 0) {
      return {
        affectedSubjects: 0,
        fsrsCacheKeyPart,
        status: "noop" as const
      };
    }

    for (const candidate of plan.candidates) {
      await updateReviewSubjectFromRescheduleCandidate(tx, candidate, nowIso);
    }

    return {
      affectedSubjects: plan.candidates.length,
      fsrsCacheKeyPart,
      status: "applied" as const
    };
  });
}

async function buildFsrsReschedulePlan(input: {
  database: Pick<DatabaseClient, "query" | "select">;
  now: Date;
}): Promise<FsrsReschedulePlan> {
  const [snapshot, fsrsCacheKeyPart, subjects] = await Promise.all([
    getFsrsOptimizerSnapshot(input.database),
    getFsrsOptimizerCacheKeyPart(input.database),
    listReviewSubjectFsrsReplaySubjects(input.database)
  ]);
  const replayOptions = buildReplayOptions(snapshot);
  const candidates: FsrsRescheduleCandidate[] = [];
  let eligibleSubjects = 0;
  let movedEarlier = 0;
  let movedLater = 0;
  let skippedNoHistory = 0;
  let unchangedSubjects = 0;
  const currentDueDates: Array<string | null> = [];
  const proposedDueDates: Array<string | null> = [];

  for (const subject of subjects) {
    if (!isReplayEligibleSubject(subject)) {
      continue;
    }

    if (subject.logs.length === 0) {
      skippedNoHistory += 1;
      continue;
    }

    eligibleSubjects += 1;

    const replayed = replayReviewHistory(
      subject.logs.map(mapReplayLog),
      replayOptions
    );

    if (!replayed) {
      skippedNoHistory += 1;
      continue;
    }

    const projected = resolveLifecycleSafeProjectedState(
      subject,
      replayed.state
    );

    currentDueDates.push(subject.state.dueAt);
    proposedDueDates.push(projected.dueAt);

    if (!isRescheduleCandidateChanged(subject, projected)) {
      unchangedSubjects += 1;
      continue;
    }

    const direction = compareDueDates(projected.dueAt, subject.state.dueAt);

    if (direction < 0) {
      movedEarlier += 1;
    } else if (direction > 0) {
      movedLater += 1;
    }

    candidates.push({
      currentDueAt: subject.state.dueAt,
      projected,
      subject
    });
  }

  const days = buildFsrsRescheduleDayDeltas({
    currentDueDates,
    horizonDays: FSRS_RESCHEDULE_HORIZON_DAYS,
    now: input.now,
    proposedDueDates
  });
  const currentDueToday = days[0]?.currentCount ?? 0;
  const proposedDueToday = days[0]?.proposedCount ?? 0;
  const currentDue7Days = sumDays(days.slice(0, 7), "currentCount");
  const proposedDue7Days = sumDays(days.slice(0, 7), "proposedCount");
  const currentDue30Days = sumDays(days, "currentCount");
  const proposedDue30Days = sumDays(days, "proposedCount");

  return {
    candidates,
    days,
    fsrsCacheKeyPart,
    generatedAt: input.now.toISOString(),
    horizonDays: FSRS_RESCHEDULE_HORIZON_DAYS,
    summary: {
      affectedSubjects: candidates.length,
      currentDue30Days,
      currentDue7Days,
      currentDueToday,
      delta30Days: proposedDue30Days - currentDue30Days,
      delta7Days: proposedDue7Days - currentDue7Days,
      deltaDueToday: proposedDueToday - currentDueToday,
      eligibleSubjects,
      movedEarlier,
      movedLater,
      proposedDue30Days,
      proposedDue7Days,
      proposedDueToday,
      skippedNoHistory,
      unchangedSubjects
    }
  };
}

function buildReplayOptions(
  snapshot: FsrsOptimizerSnapshot
): ReplayReviewHistoryOptions {
  return {
    scheduler: (log) => resolveReplaySchedulerConfig(snapshot, log)
  };
}

function resolveReplaySchedulerConfig(
  snapshot: FsrsOptimizerSnapshot,
  log: ReviewLogReplayInput
): ReviewSchedulerRuntimeConfig {
  const presetKey = resolveFsrsPresetKey(log.cardType ?? "");
  const preset = presetKey ? snapshot.presets[presetKey] : null;

  return {
    desiredRetention: snapshot.config.desiredRetention,
    weights: preset?.weights ?? undefined
  };
}

function isReplayEligibleSubject(subject: ReviewSubjectFsrsReplaySubject) {
  return (
    subject.cardStatus === "active" &&
    subject.state.manualOverride === false &&
    subject.state.suspended === false &&
    subject.state.state !== "new" &&
    subject.state.state !== "known_manual" &&
    subject.state.state !== "suspended"
  );
}

function mapReplayLog(
  log: ReviewSubjectFsrsReplaySubject["logs"][number]
): ReviewLogReplayInput {
  return {
    answeredAt: log.answeredAt,
    cardType: log.cardType,
    id: log.id,
    previousState: log.previousState,
    rating: log.rating,
    responseMs: log.responseMs
  };
}

function resolveLifecycleSafeProjectedState(
  subject: ReviewSubjectFsrsReplaySubject,
  projected: ReplayedReviewHistory["state"]
): ReplayedReviewHistory["state"] {
  if (projected.state === "review") {
    return projected;
  }

  const latestLog = subject.logs.at(-1);

  if (latestLog?.newState !== "review") {
    return projected;
  }

  if (subject.state.state === "review") {
    return buildProjectionFromCurrentReviewState(subject, projected);
  }

  if (isLikelyPriorRescheduleLifecycleDowngrade(subject, latestLog)) {
    return buildProjectionFromLoggedReviewTransition(
      subject,
      projected,
      latestLog
    );
  }

  return projected;
}

function buildProjectionFromCurrentReviewState(
  subject: ReviewSubjectFsrsReplaySubject,
  projected: ReplayedReviewHistory["state"]
): ReplayedReviewHistory["state"] {
  const state = subject.state;

  return {
    difficulty: state.difficulty ?? projected.difficulty,
    dueAt: state.dueAt ?? projected.dueAt,
    lapses: state.lapses,
    learningSteps: 0,
    lastReviewedAt: state.lastReviewedAt ?? projected.lastReviewedAt,
    reps: state.reps,
    scheduledDays: state.scheduledDays,
    schedulerVersion: "fsrs_v1",
    stability: state.stability ?? projected.stability,
    state: "review"
  };
}

function isLikelyPriorRescheduleLifecycleDowngrade(
  subject: ReviewSubjectFsrsReplaySubject,
  latestLog: ReviewSubjectFsrsReplayLogRecord
) {
  return (
    subject.state.lastReviewedAt === latestLog.answeredAt &&
    subject.state.lastInteractionAt === latestLog.answeredAt
  );
}

function buildProjectionFromLoggedReviewTransition(
  subject: ReviewSubjectFsrsReplaySubject,
  projected: ReplayedReviewHistory["state"],
  latestLog: ReviewSubjectFsrsReplayLogRecord
): ReplayedReviewHistory["state"] {
  const dueAt =
    latestLog.scheduledDueAt ?? subject.state.dueAt ?? projected.dueAt;
  const scheduledDays = inferScheduledReviewDays(
    latestLog.answeredAt,
    dueAt,
    subject.state.scheduledDays || projected.scheduledDays
  );

  return {
    difficulty: projected.difficulty,
    dueAt,
    lapses: projected.lapses,
    learningSteps: 0,
    lastReviewedAt: latestLog.answeredAt,
    reps: projected.reps,
    scheduledDays,
    schedulerVersion: "fsrs_v1",
    stability: Math.max(projected.stability, scheduledDays),
    state: "review"
  };
}

function inferScheduledReviewDays(
  answeredAt: string,
  dueAt: string,
  fallback: number
) {
  const answeredAtTime = new Date(answeredAt).getTime();
  const dueAtTime = new Date(dueAt).getTime();
  const diffDays = (dueAtTime - answeredAtTime) / DAY;

  if (Number.isFinite(diffDays) && diffDays > 0) {
    return Math.max(1, Math.round(diffDays));
  }

  return Math.max(1, Math.round(fallback));
}

function isRescheduleCandidateChanged(
  subject: ReviewSubjectFsrsReplaySubject,
  projected: ReplayedReviewHistory["state"]
) {
  const state = subject.state;

  return (
    state.difficulty !== projected.difficulty ||
    state.dueAt !== projected.dueAt ||
    state.lapses !== projected.lapses ||
    state.lastReviewedAt !== projected.lastReviewedAt ||
    state.learningSteps !== projected.learningSteps ||
    state.reps !== projected.reps ||
    state.scheduledDays !== projected.scheduledDays ||
    state.schedulerVersion !== projected.schedulerVersion ||
    state.stability !== projected.stability ||
    state.state !== projected.state
  );
}

function compareDueDates(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right
    ? new Date(right).getTime()
    : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return 0;
  }

  return leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1;
}

function buildFsrsRescheduleDayDeltas(input: {
  currentDueDates: Array<string | null>;
  horizonDays: number;
  now: Date;
  proposedDueDates: Array<string | null>;
}) {
  const days = buildHorizonDays(input.now, input.horizonDays);
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const tomorrowStart = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate() + 1
  );

  for (const dueAt of input.currentDueDates) {
    incrementDueDateBucket(dayByDate, dueAt, tomorrowStart, "currentCount");
  }

  for (const dueAt of input.proposedDueDates) {
    incrementDueDateBucket(dayByDate, dueAt, tomorrowStart, "proposedCount");
  }

  return days.map((day) => ({
    ...day,
    delta: day.proposedCount - day.currentCount
  }));
}

function buildHorizonDays(now: Date, horizonDays: number) {
  return Array.from({ length: horizonDays }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    day.setDate(day.getDate() + index);

    return {
      currentCount: 0,
      date: getLocalIsoDateKey(day),
      delta: 0,
      proposedCount: 0
    };
  });
}

function incrementDueDateBucket(
  dayByDate: Map<string, FsrsRescheduleDayDelta>,
  dueAt: string | null,
  tomorrowStart: Date,
  countKey: "currentCount" | "proposedCount"
) {
  if (!dueAt) {
    return;
  }

  const dueDate = new Date(dueAt);

  if (!Number.isFinite(dueDate.getTime())) {
    return;
  }

  const dateKey =
    dueDate.getTime() < tomorrowStart.getTime()
      ? dayByDate.keys().next().value
      : getLocalIsoDateKey(dueDate);

  if (typeof dateKey !== "string") {
    return;
  }

  const day = dayByDate.get(dateKey);

  if (!day) {
    return;
  }

  day[countKey] += 1;
}

function sumDays(
  days: FsrsRescheduleDayDelta[],
  key: "currentCount" | "proposedCount"
) {
  return days.reduce((total, day) => total + day[key], 0);
}

async function updateReviewSubjectFromRescheduleCandidate(
  transaction: FsrsRescheduleTransaction,
  candidate: FsrsRescheduleCandidate,
  nowIso: string
) {
  await transaction
    .update(reviewSubjectState)
    .set({
      difficulty: candidate.projected.difficulty,
      dueAt: candidate.projected.dueAt,
      lapses: candidate.projected.lapses,
      lastReviewedAt: candidate.projected.lastReviewedAt,
      learningSteps: candidate.projected.learningSteps,
      reps: candidate.projected.reps,
      scheduledDays: candidate.projected.scheduledDays,
      schedulerVersion: candidate.projected.schedulerVersion,
      stability: candidate.projected.stability,
      state: candidate.projected.state,
      updatedAt: nowIso
    })
    .where(
      eq(reviewSubjectState.subjectKey, candidate.subject.state.subjectKey)
    );
}

function stripFsrsReschedulePlanCandidates(
  plan: FsrsReschedulePlan
): FsrsReschedulePreview {
  return {
    days: plan.days,
    fsrsCacheKeyPart: plan.fsrsCacheKeyPart,
    generatedAt: plan.generatedAt,
    horizonDays: plan.horizonDays,
    summary: plan.summary
  };
}

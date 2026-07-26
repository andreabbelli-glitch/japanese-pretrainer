import { randomUUID } from "node:crypto";

import { db, type DatabaseClient } from "@/db";
import {
  listReviewSubjectFsrsReplaySubjects,
  type ReviewSubjectFsrsReplayLogRecord,
  type ReviewSubjectFsrsReplaySubject
} from "@/db/queries";
import type { ReviewRecallTask } from "@/domain/review";
import {
  applyReviewDailyIntervalPolicy,
  getReviewFuzzBounds
} from "@/features/review/model/interval-policy";
import { resolveReviewRecallTask } from "@/features/review/model/recall-task";
import {
  CURRENT_REVIEW_SCHEDULER_VERSION,
  replayReviewHistory,
  type ReplayReviewHistoryOptions,
  type ReplayedReviewHistory,
  type ReviewLogReplayInput,
  type ReviewSchedulerRuntimeConfig
} from "@/features/review/model/scheduler";
import {
  addReviewStudyDays,
  differenceInReviewStudyDayKeys,
  differenceInReviewStudyDays,
  getReviewStudyDay,
  normalizeReviewDueAt
} from "@/features/review/model/study-day";
import {
  resolveFsrsPresetKey,
  type FsrsOptimizerSnapshot
} from "../model/snapshot";
import {
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerSnapshot
} from "./settings-store";
import { writeFsrsRescheduleBatch } from "./reschedule-batch";

const FSRS_RESCHEDULE_HORIZON_DAYS = 30;

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
  snapshot: FsrsOptimizerSnapshot;
};

type FsrsRescheduleDueLoad = Map<ReviewRecallTask, Map<string, number>>;

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
  const preflightFsrsCacheKeyPart =
    await getFsrsOptimizerCacheKeyPart(database);

  if (preflightFsrsCacheKeyPart !== input.expectedFsrsCacheKeyPart) {
    return {
      affectedSubjects: 0,
      fsrsCacheKeyPart: preflightFsrsCacheKeyPart,
      status: "stale"
    };
  }

  // Replay and load balancing are intentionally outside the write
  // transaction. The final batch validates both optimizer settings and every
  // subject snapshot before committing any state or immutable ledger row.
  const plan = await buildFsrsReschedulePlan({
    database,
    now
  });

  if (plan.fsrsCacheKeyPart !== input.expectedFsrsCacheKeyPart) {
    return {
      affectedSubjects: 0,
      fsrsCacheKeyPart: plan.fsrsCacheKeyPart,
      status: "stale"
    };
  }

  if (plan.candidates.length === 0) {
    const fsrsCacheKeyPart = await getFsrsOptimizerCacheKeyPart(database);

    return {
      affectedSubjects: 0,
      fsrsCacheKeyPart,
      status:
        fsrsCacheKeyPart === input.expectedFsrsCacheKeyPart ? "noop" : "stale"
    };
  }

  const batchId = `fsrs_reschedule_${randomUUID()}`;
  const writeStatus = await writeFsrsRescheduleBatch({
    batchId,
    candidates: plan.candidates,
    database,
    expectedFsrsCacheKeyPart: input.expectedFsrsCacheKeyPart,
    nowIso,
    snapshot: plan.snapshot
  });

  if (writeStatus === "stale") {
    return {
      affectedSubjects: 0,
      fsrsCacheKeyPart: await getFsrsOptimizerCacheKeyPart(database),
      status: "stale"
    };
  }

  return {
    affectedSubjects: plan.candidates.length,
    fsrsCacheKeyPart: plan.fsrsCacheKeyPart,
    status: "applied"
  };
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
  const dueLoadByRecallTask = buildFsrsRescheduleDueLoad(subjects);
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

    if (hasAmbiguousReplayFreshStart(subject)) {
      currentDueDates.push(subject.state.dueAt);
      proposedDueDates.push(subject.state.dueAt);
      unchangedSubjects += 1;
      continue;
    }

    const replayed = replayReviewHistory(subject.logs.map(mapReplayLog), {
      ...replayOptions,
      schedulingKey: subject.state.subjectKey
    });

    if (!replayed) {
      skippedNoHistory += 1;
      continue;
    }

    let projected = resolveLifecycleSafeProjectedState(subject, replayed.state);
    const recallTask = resolveRescheduleRecallTask(subject);

    updateFsrsRescheduleDueLoad(
      dueLoadByRecallTask,
      recallTask,
      subject.state.dueAt,
      -1
    );

    if (projected === replayed.state && replayed.finalIntervalPolicy !== null) {
      projected = applyFsrsRescheduleFinalIntervalPolicy({
        dueLoadByRecallTask,
        intervalPolicy: replayed.finalIntervalPolicy,
        projected,
        recallTask
      });
    }

    updateFsrsRescheduleDueLoad(
      dueLoadByRecallTask,
      recallTask,
      projected.dueAt,
      1
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
    snapshot,
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

function buildFsrsRescheduleDueLoad(
  subjects: readonly ReviewSubjectFsrsReplaySubject[]
): FsrsRescheduleDueLoad {
  const dueLoad: FsrsRescheduleDueLoad = new Map();

  for (const subject of subjects) {
    if (!isReplayEligibleSubject(subject) || subject.state.scheduledDays <= 0) {
      continue;
    }

    updateFsrsRescheduleDueLoad(
      dueLoad,
      resolveRescheduleRecallTask(subject),
      subject.state.dueAt,
      1
    );
  }

  return dueLoad;
}

function applyFsrsRescheduleFinalIntervalPolicy(input: {
  dueLoadByRecallTask: FsrsRescheduleDueLoad;
  intervalPolicy: NonNullable<ReplayedReviewHistory["finalIntervalPolicy"]>;
  projected: ReplayedReviewHistory["state"];
  recallTask: ReviewRecallTask;
}): ReplayedReviewHistory["state"] {
  const bounds = getReviewFuzzBounds(
    input.intervalPolicy.baseInterval,
    input.intervalPolicy.minimumInterval,
    input.intervalPolicy.maximumInterval
  );
  const dueByStudyDay =
    input.dueLoadByRecallTask.get(input.recallTask) ?? new Map();
  const reviewedStudyDay = getReviewStudyDay(input.intervalPolicy.reviewedAt);
  const dueCountsByInterval = new Map<number, number>();

  for (let interval = bounds.lower; interval <= bounds.upper; interval += 1) {
    const dueStudyDay = addReviewStudyDays(reviewedStudyDay, interval);
    dueCountsByInterval.set(interval, dueByStudyDay.get(dueStudyDay) ?? 0);
  }

  const selected = applyReviewDailyIntervalPolicy({
    baseInterval: input.intervalPolicy.baseInterval,
    dueCountsByInterval,
    maximumInterval: input.intervalPolicy.maximumInterval,
    minimumInterval: input.intervalPolicy.minimumInterval,
    rating: input.intervalPolicy.rating,
    reps: input.intervalPolicy.reps,
    reviewedAt: input.intervalPolicy.reviewedAt,
    schedulingKey: input.intervalPolicy.schedulingKey
  });

  return {
    ...input.projected,
    dueAt: normalizeReviewDueAt({
      dueAt: input.projected.dueAt,
      reviewedAt: input.intervalPolicy.reviewedAt,
      scheduledDays: selected.interval
    }).toISOString(),
    scheduledDays: selected.interval
  };
}

function updateFsrsRescheduleDueLoad(
  dueLoad: FsrsRescheduleDueLoad,
  recallTask: ReviewRecallTask,
  dueAt: string | null,
  delta: 1 | -1
) {
  if (!dueAt) {
    return;
  }

  let studyDay: string;

  try {
    studyDay = getReviewStudyDay(dueAt);
  } catch {
    return;
  }

  const dueByStudyDay = dueLoad.get(recallTask) ?? new Map<string, number>();
  const nextCount = Math.max(0, (dueByStudyDay.get(studyDay) ?? 0) + delta);

  if (nextCount === 0) {
    dueByStudyDay.delete(studyDay);
  } else {
    dueByStudyDay.set(studyDay, nextCount);
  }

  dueLoad.set(recallTask, dueByStudyDay);
}

function resolveRescheduleRecallTask(subject: ReviewSubjectFsrsReplaySubject) {
  return subject.state.recallTask ?? resolveReviewRecallTask(subject.cardType);
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
  if (!log.rating) {
    throw new Error(`Grade review event ${log.id} is missing its rating.`);
  }

  return {
    answeredAt: log.answeredAt,
    cardType: log.cardType,
    elapsedDays: log.elapsedDays,
    id: log.id,
    previousState: log.previousState,
    rating: log.rating,
    responseMs: log.responseMs,
    schedulingKey: log.cardId
  };
}

function hasAmbiguousReplayFreshStart(subject: ReviewSubjectFsrsReplaySubject) {
  for (const [index, log] of subject.logs.entries()) {
    if (index === 0) {
      continue;
    }

    if (isReplayFreshStartState(log.previousState)) {
      return true;
    }
  }

  return false;
}

function isReplayFreshStartState(
  state: ReviewSubjectFsrsReplayLogRecord["previousState"]
) {
  return state !== "learning" && state !== "review" && state !== "relearning";
}

function resolveLifecycleSafeProjectedState(
  subject: ReviewSubjectFsrsReplaySubject,
  projected: ReplayedReviewHistory["state"]
): ReplayedReviewHistory["state"] {
  const latestLog = subject.logs.at(-1);

  if (projected.state === "review") {
    if (
      latestLog?.newState === "review" &&
      shouldPreserveLoggedReviewDueForPartialHistory(
        subject,
        projected,
        latestLog
      )
    ) {
      return buildProjectionFromLoggedReviewTransition(
        subject,
        projected,
        latestLog
      );
    }

    return projected;
  }

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

function shouldPreserveLoggedReviewDueForPartialHistory(
  subject: ReviewSubjectFsrsReplaySubject,
  projected: ReplayedReviewHistory["state"],
  latestLog: ReviewSubjectFsrsReplayLogRecord
) {
  const firstLog = subject.logs[0];
  const preservedDueAt = latestLog.scheduledDueAt ?? subject.state.dueAt;

  return (
    firstLog !== undefined &&
    firstLog.previousState !== "new" &&
    preservedDueAt !== null &&
    compareDueDates(projected.dueAt, preservedDueAt) < 0
  );
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
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
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
    difficulty: subject.state.difficulty ?? projected.difficulty,
    dueAt,
    lapses: Math.max(subject.state.lapses, projected.lapses),
    learningSteps: 0,
    lastReviewedAt: latestLog.answeredAt,
    reps: Math.max(subject.state.reps, projected.reps),
    scheduledDays,
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
    stability: Math.max(
      subject.state.stability ?? 0,
      projected.stability,
      scheduledDays
    ),
    state: "review"
  };
}

function inferScheduledReviewDays(
  answeredAt: string,
  dueAt: string,
  fallback: number
) {
  try {
    const diffDays = differenceInReviewStudyDays(answeredAt, dueAt);

    if (diffDays > 0) {
      return diffDays;
    }
  } catch {
    // Fall through to the persisted interval for malformed legacy timestamps.
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

  for (const dueAt of input.currentDueDates) {
    incrementDueDateBucket(dayByDate, dueAt, "currentCount");
  }

  for (const dueAt of input.proposedDueDates) {
    incrementDueDateBucket(dayByDate, dueAt, "proposedCount");
  }

  return days.map((day) => ({
    ...day,
    delta: day.proposedCount - day.currentCount
  }));
}

function buildHorizonDays(now: Date, horizonDays: number) {
  const currentStudyDay = getReviewStudyDay(now);

  return Array.from({ length: horizonDays }, (_, index) => {
    return {
      currentCount: 0,
      date: addReviewStudyDays(currentStudyDay, index),
      delta: 0,
      proposedCount: 0
    };
  });
}

function incrementDueDateBucket(
  dayByDate: Map<string, FsrsRescheduleDayDelta>,
  dueAt: string | null,
  countKey: "currentCount" | "proposedCount"
) {
  if (!dueAt) {
    return;
  }

  const dueDate = new Date(dueAt);

  if (!Number.isFinite(dueDate.getTime())) {
    return;
  }

  const currentStudyDay = dayByDate.keys().next().value;

  if (typeof currentStudyDay !== "string") {
    return;
  }

  const dueStudyDay = getReviewStudyDay(dueDate);
  const dateKey =
    differenceInReviewStudyDayKeys(currentStudyDay, dueStudyDay) <= 0
      ? currentStudyDay
      : dueStudyDay;

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

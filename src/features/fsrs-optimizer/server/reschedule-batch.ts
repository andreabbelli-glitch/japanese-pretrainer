import { randomUUID } from "node:crypto";

import type { InStatement } from "@libsql/client";

import type { DatabaseClient } from "@/db";
import type { ReviewSubjectFsrsReplaySubject } from "@/db/queries";
import type { ReplayedReviewHistory } from "@/features/review/model/scheduler";
import {
  buildReviewCanonicalSubjectKey,
  buildReviewSubjectIdentityFromCanonical
} from "@/features/review/model/subject";
import { buildReviewEventRecord } from "@/features/review/server/event-ledger";

import type { FsrsOptimizerSnapshot } from "../model/snapshot";
import { buildFsrsParameterSet } from "./parameter-set";

export type FsrsRescheduleWriteCandidate = {
  projected: ReplayedReviewHistory["state"];
  subject: ReviewSubjectFsrsReplaySubject;
};

type FsrsRescheduleBatchCandidate = {
  event: ReturnType<typeof buildReviewEventRecord>;
  expected: {
    canonicalSubjectKey: string | null;
    cardId: string;
    cardStatus: string;
    cardType: string;
    crossMediaGroupId: string | null;
    difficulty: number | null;
    dueAt: string | null;
    entryId: string | null;
    entryType: string | null;
    lapses: number;
    lastInteractionAt: string;
    lastReviewedAt: string | null;
    learningSteps: number;
    manualOverride: boolean;
    mediaId: string;
    recallTask: string | null;
    reps: number;
    scheduledDays: number;
    schedulerVersion: string;
    stability: number | null;
    state: string;
    subjectType: string;
    suspended: boolean;
    updatedAt: string;
  };
  next: {
    difficulty: number;
    dueAt: string;
    lapses: number;
    lastReviewedAt: string;
    learningSteps: number;
    reps: number;
    scheduledDays: number;
    schedulerVersion: string;
    stability: number;
    state: string;
    updatedAt: string;
  };
  subjectKey: string;
};

type FsrsRescheduleBatch = {
  staleGuardStatementIndexes: ReadonlySet<number>;
  statements: InStatement[];
};

/**
 * Applies a precomputed plan in one non-interactive write transaction. A
 * settings guard plus a compare-and-swap update make a stale plan abort the
 * whole batch before its immutable ledger insert can commit.
 */
export async function writeFsrsRescheduleBatch(input: {
  batchId: string;
  candidates: FsrsRescheduleWriteCandidate[];
  database: DatabaseClient;
  expectedFsrsCacheKeyPart: string;
  nowIso: string;
  snapshot: FsrsOptimizerSnapshot;
}): Promise<"applied" | "stale"> {
  const batch = buildFsrsRescheduleBatch(input);

  try {
    await input.database.$client.batch(batch.statements, "write");
    return "applied";
  } catch (error) {
    if (isFsrsRescheduleStaleGuardFailure(error, batch)) {
      return "stale";
    }

    throw error;
  }
}

function buildFsrsRescheduleBatchCandidate(
  candidate: FsrsRescheduleWriteCandidate,
  snapshot: FsrsOptimizerSnapshot,
  batchId: string,
  nowIso: string
): FsrsRescheduleBatchCandidate {
  const previousState = candidate.subject.state;
  const cardId = previousState.cardId;

  if (!cardId) {
    throw new Error(
      `Cannot reschedule review subject ${previousState.subjectKey} without a representative card.`
    );
  }

  const nextState = {
    ...previousState,
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
  };
  const identity = buildReviewSubjectIdentityFromCanonical({
    cardId,
    cardType: candidate.subject.cardType,
    canonicalSubjectKey: buildReviewCanonicalSubjectKey({
      crossMediaGroupId: previousState.crossMediaGroupId,
      entryId:
        previousState.subjectType === "card"
          ? cardId
          : (previousState.entryId ?? cardId),
      entryType: previousState.entryType,
      subjectKind: previousState.subjectType
    }),
    crossMediaGroupId: previousState.crossMediaGroupId,
    entryId: previousState.entryId,
    entryType: previousState.entryType,
    subjectKind: previousState.subjectType
  });

  return {
    event: buildReviewEventRecord({
      afterState: nextState,
      answeredAt: nowIso,
      batchId,
      beforeState: previousState,
      cardId,
      cardType: candidate.subject.cardType,
      eventKind: "reschedule",
      identity,
      mediaId: candidate.subject.mediaId,
      parameterSet: buildFsrsParameterSet(
        snapshot,
        identity.recallTask,
        nowIso
      ),
      rating: null,
      reason: "fsrs_optimizer_reschedule_apply"
    }),
    expected: {
      canonicalSubjectKey: previousState.canonicalSubjectKey,
      cardId,
      cardStatus: candidate.subject.cardStatus,
      cardType: candidate.subject.cardType,
      crossMediaGroupId: previousState.crossMediaGroupId,
      difficulty: previousState.difficulty,
      dueAt: previousState.dueAt,
      entryId: previousState.entryId,
      entryType: previousState.entryType,
      lapses: previousState.lapses,
      lastInteractionAt: previousState.lastInteractionAt,
      lastReviewedAt: previousState.lastReviewedAt,
      learningSteps: previousState.learningSteps,
      manualOverride: previousState.manualOverride,
      mediaId: candidate.subject.mediaId,
      recallTask: previousState.recallTask,
      reps: previousState.reps,
      scheduledDays: previousState.scheduledDays,
      schedulerVersion: previousState.schedulerVersion,
      stability: previousState.stability,
      state: previousState.state,
      subjectType: previousState.subjectType,
      suspended: previousState.suspended,
      updatedAt: previousState.updatedAt
    },
    next: {
      difficulty: nextState.difficulty,
      dueAt: nextState.dueAt,
      lapses: nextState.lapses,
      lastReviewedAt: nextState.lastReviewedAt,
      learningSteps: nextState.learningSteps,
      reps: nextState.reps,
      scheduledDays: nextState.scheduledDays,
      schedulerVersion: nextState.schedulerVersion,
      stability: nextState.stability,
      state: nextState.state,
      updatedAt: nextState.updatedAt
    },
    subjectKey: previousState.subjectKey
  };
}

function buildFsrsRescheduleBatch(input: {
  batchId: string;
  candidates: FsrsRescheduleWriteCandidate[];
  expectedFsrsCacheKeyPart: string;
  nowIso: string;
  snapshot: FsrsOptimizerSnapshot;
}): FsrsRescheduleBatch {
  const suffix = randomUUID().replaceAll("-", "");
  const guardTable = `"fsrs_reschedule_guard_${suffix}"`;
  const planTable = `"fsrs_reschedule_plan_${suffix}"`;
  const payload = JSON.stringify(
    input.candidates.map((candidate) =>
      buildFsrsRescheduleBatchCandidate(
        candidate,
        input.snapshot,
        input.batchId,
        input.nowIso
      )
    )
  );
  const statements: InStatement[] = [
    `CREATE TEMP TABLE ${guardTable} (
      ok INTEGER NOT NULL CHECK (ok = 1)
    )`,
    `CREATE TEMP TABLE ${planTable} (
      payload TEXT NOT NULL
    )`,
    {
      sql: `INSERT INTO ${planTable} (payload)
        SELECT value FROM json_each(?)`,
      args: [payload]
    }
  ];
  const staleGuardStatementIndexes = new Set<number>();

  staleGuardStatementIndexes.add(statements.length);
  statements.push(buildFsrsSettingsGuard(guardTable, input));
  statements.push(buildFsrsRescheduleStateUpdateStatement(planTable));
  staleGuardStatementIndexes.add(statements.length);
  statements.push(buildChangeCountGuard(guardTable, input.candidates.length));
  statements.push(buildFsrsRescheduleLedgerInsertStatement(planTable));
  statements.push(buildChangeCountGuard(guardTable, input.candidates.length));
  statements.push(`DROP TABLE ${planTable}`);
  statements.push(`DROP TABLE ${guardTable}`);

  return { staleGuardStatementIndexes, statements };
}

function buildFsrsSettingsGuard(
  guardTable: string,
  input: { expectedFsrsCacheKeyPart: string }
): InStatement {
  return {
    sql: `INSERT INTO ${guardTable} (ok)
      SELECT CASE WHEN (
        coalesce((
          SELECT updated_at FROM user_setting
          WHERE key = 'fsrs_optimizer_config'
        ), 'none') || '|' || coalesce((
          SELECT updated_at FROM user_setting
          WHERE key = 'fsrs_params_recognition'
        ), 'none') || '|' || coalesce((
          SELECT updated_at FROM user_setting
          WHERE key = 'fsrs_params_concept'
        ), 'none')
      ) = ? THEN 1 ELSE 0 END`,
    args: [input.expectedFsrsCacheKeyPart]
  };
}

function buildChangeCountGuard(
  guardTable: string,
  expectedChanges: number
): InStatement {
  return {
    sql: `INSERT INTO ${guardTable} (ok)
      VALUES (CASE WHEN changes() = ? THEN 1 ELSE 0 END)`,
    args: [expectedChanges]
  };
}

function buildFsrsRescheduleStateUpdateStatement(
  planTable: string
): InStatement {
  return `UPDATE review_subject_state AS current
    SET difficulty = json_extract(plan.payload, '$.next.difficulty'),
        due_at = json_extract(plan.payload, '$.next.dueAt'),
        lapses = json_extract(plan.payload, '$.next.lapses'),
        last_reviewed_at = json_extract(plan.payload, '$.next.lastReviewedAt'),
        learning_steps = json_extract(plan.payload, '$.next.learningSteps'),
        reps = json_extract(plan.payload, '$.next.reps'),
        scheduled_days = json_extract(plan.payload, '$.next.scheduledDays'),
        scheduler_version = json_extract(
          plan.payload,
          '$.next.schedulerVersion'
        ),
        stability = json_extract(plan.payload, '$.next.stability'),
        state = json_extract(plan.payload, '$.next.state'),
        updated_at = json_extract(plan.payload, '$.next.updatedAt')
    FROM ${planTable} AS plan
    WHERE current.subject_key = json_extract(plan.payload, '$.subjectKey')
      AND current.canonical_subject_key IS json_extract(
        plan.payload,
        '$.expected.canonicalSubjectKey'
      )
      AND current.recall_task IS json_extract(
        plan.payload,
        '$.expected.recallTask'
      )
      AND current.subject_type IS json_extract(
        plan.payload,
        '$.expected.subjectType'
      )
      AND current.entry_type IS json_extract(
        plan.payload,
        '$.expected.entryType'
      )
      AND current.cross_media_group_id IS json_extract(
        plan.payload,
        '$.expected.crossMediaGroupId'
      )
      AND current.entry_id IS json_extract(plan.payload, '$.expected.entryId')
      AND current.card_id IS json_extract(plan.payload, '$.expected.cardId')
      AND current.state IS json_extract(plan.payload, '$.expected.state')
      AND current.stability IS json_extract(
        plan.payload,
        '$.expected.stability'
      )
      AND current.difficulty IS json_extract(
        plan.payload,
        '$.expected.difficulty'
      )
      AND current.due_at IS json_extract(plan.payload, '$.expected.dueAt')
      AND current.last_reviewed_at IS json_extract(
        plan.payload,
        '$.expected.lastReviewedAt'
      )
      AND current.last_interaction_at IS json_extract(
        plan.payload,
        '$.expected.lastInteractionAt'
      )
      AND current.scheduled_days IS json_extract(
        plan.payload,
        '$.expected.scheduledDays'
      )
      AND current.learning_steps IS json_extract(
        plan.payload,
        '$.expected.learningSteps'
      )
      AND current.lapses IS json_extract(plan.payload, '$.expected.lapses')
      AND current.reps IS json_extract(plan.payload, '$.expected.reps')
      AND current.scheduler_version IS json_extract(
        plan.payload,
        '$.expected.schedulerVersion'
      )
      AND current.manual_override IS json_extract(
        plan.payload,
        '$.expected.manualOverride'
      )
      AND current.suspended IS json_extract(
        plan.payload,
        '$.expected.suspended'
      )
      AND current.updated_at IS json_extract(
        plan.payload,
        '$.expected.updatedAt'
      )
      AND EXISTS (
        SELECT 1
        FROM card AS current_card
        WHERE current_card.id = current.card_id
          AND current_card.status IS json_extract(
            plan.payload,
            '$.expected.cardStatus'
          )
          AND current_card.card_type IS json_extract(
            plan.payload,
            '$.expected.cardType'
          )
          AND current_card.media_id IS json_extract(
            plan.payload,
            '$.expected.mediaId'
          )
      )`;
}

function buildFsrsRescheduleLedgerInsertStatement(
  planTable: string
): InStatement {
  return `INSERT INTO review_subject_log (
      after_state_json, algorithm_version, answered_at, batch_id,
      before_state_json, binding_version, canonical_subject_key, card_id,
      card_type_snapshot, elapsed_days, event_kind, event_schema_version, id,
      media_id_snapshot, memory_key, new_state, parameter_hash,
      previous_due_at, previous_state, rating, recall_task, reason,
      recorded_at, response_ms, scheduled_due_at, scheduler_version,
      study_day, study_day_policy, subject_key
    )
    SELECT
      json_extract(payload, '$.event.afterStateJson'),
      json_extract(payload, '$.event.algorithmVersion'),
      json_extract(payload, '$.event.answeredAt'),
      json_extract(payload, '$.event.batchId'),
      json_extract(payload, '$.event.beforeStateJson'),
      json_extract(payload, '$.event.bindingVersion'),
      json_extract(payload, '$.event.canonicalSubjectKey'),
      json_extract(payload, '$.event.cardId'),
      json_extract(payload, '$.event.cardTypeSnapshot'),
      json_extract(payload, '$.event.elapsedDays'),
      json_extract(payload, '$.event.eventKind'),
      json_extract(payload, '$.event.eventSchemaVersion'),
      json_extract(payload, '$.event.id'),
      json_extract(payload, '$.event.mediaIdSnapshot'),
      json_extract(payload, '$.event.memoryKey'),
      json_extract(payload, '$.event.newState'),
      json_extract(payload, '$.event.parameterHash'),
      json_extract(payload, '$.event.previousDueAt'),
      json_extract(payload, '$.event.previousState'),
      json_extract(payload, '$.event.rating'),
      json_extract(payload, '$.event.recallTask'),
      json_extract(payload, '$.event.reason'),
      json_extract(payload, '$.event.recordedAt'),
      json_extract(payload, '$.event.responseMs'),
      json_extract(payload, '$.event.scheduledDueAt'),
      json_extract(payload, '$.event.schedulerVersion'),
      json_extract(payload, '$.event.studyDay'),
      json_extract(payload, '$.event.studyDayPolicy'),
      json_extract(payload, '$.event.subjectKey')
    FROM ${planTable}`;
}

function isFsrsRescheduleStaleGuardFailure(
  error: unknown,
  batch: FsrsRescheduleBatch
) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const statementIndex = Reflect.get(error, "statementIndex");

  return (
    typeof statementIndex === "number" &&
    batch.staleGuardStatementIndexes.has(statementIndex)
  );
}

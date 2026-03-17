import { randomUUID } from "node:crypto";

import { and, eq, inArray, or } from "drizzle-orm";

import {
  card,
  db,
  entryStatus,
  reviewLog,
  reviewState,
  type DatabaseClient,
  type EntryType
} from "@/db";

import {
  getDrivingEntryLinks,
  resolveEffectiveReviewState,
  type ReviewEntryLinkLike,
  type ReviewEntryStatusValue
} from "./review-model";
import {
  scheduleReview,
  type ReviewRating,
  type ReviewState
} from "./review-scheduler";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

type LinkedEntryRef = {
  entryId: string;
  entryType: EntryType;
};

export async function applyReviewGrade(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  rating: ReviewRating;
  responseMs?: number | null;
}) {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!loadedCard || loadedCard.status !== "active") {
      throw new Error("Review card not available for grading.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const effectiveState = resolveEffectiveReviewState({
      cardStatus: loadedCard.status,
      drivingEntryStatuses: loadedCard.drivingEntries.map(
        (entry) => entry.status?.status ?? null
      ),
      reviewState: loadedCard.reviewState
        ? {
            manualOverride: loadedCard.reviewState.manualOverride,
            state: loadedCard.reviewState.state as ReviewState
          }
        : null
    });

    if (effectiveState.state === "known_manual" || effectiveState.state === "ignored") {
      throw new Error("Manual mastery cards cannot be graded until the entry is reopened.");
    }

    if (effectiveState.state === "suspended") {
      throw new Error("Suspended cards must be resumed before grading.");
    }

    const previousState = (loadedCard.reviewState?.state ?? "new") as ReviewState;
    const scheduled = scheduleReview({
      current: {
        difficulty: loadedCard.reviewState?.difficulty ?? null,
        dueAt: loadedCard.reviewState?.dueAt ?? null,
        lapses: loadedCard.reviewState?.lapses ?? 0,
        lastReviewedAt: loadedCard.reviewState?.lastReviewedAt ?? null,
        learningSteps: loadedCard.reviewState?.learningSteps ?? 0,
        reps: loadedCard.reviewState?.reps ?? 0,
        scheduledDays: loadedCard.reviewState?.scheduledDays ?? 0,
        stability: loadedCard.reviewState?.stability ?? null,
        state: loadedCard.reviewState?.state as ReviewState | null
      },
      now,
      rating: input.rating
    });

    await tx
      .insert(reviewState)
      .values({
        cardId: loadedCard.id,
        state: scheduled.state,
        stability: scheduled.stability,
        difficulty: scheduled.difficulty,
        dueAt: scheduled.dueAt,
        lastReviewedAt: nowIso,
        scheduledDays: scheduled.scheduledDays,
        learningSteps: scheduled.learningSteps,
        lapses: scheduled.lapses,
        reps: scheduled.reps,
        schedulerVersion: scheduled.schedulerVersion,
        manualOverride: false,
        createdAt: loadedCard.reviewState?.createdAt ?? nowIso,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewState.cardId,
        set: {
          state: scheduled.state,
          stability: scheduled.stability,
          difficulty: scheduled.difficulty,
          dueAt: scheduled.dueAt,
          lastReviewedAt: nowIso,
          scheduledDays: scheduled.scheduledDays,
          learningSteps: scheduled.learningSteps,
          lapses: scheduled.lapses,
          reps: scheduled.reps,
          schedulerVersion: scheduled.schedulerVersion,
          manualOverride: false,
          updatedAt: nowIso
        }
      });

    await tx.insert(reviewLog).values({
      id: `review_log_${randomUUID()}`,
      cardId: loadedCard.id,
      answeredAt: nowIso,
      rating: input.rating,
      previousState,
      newState: scheduled.state,
      scheduledDueAt: scheduled.dueAt,
      elapsedDays: scheduled.elapsedDays,
      responseMs: input.responseMs ?? null,
      schedulerVersion: scheduled.schedulerVersion
    });

    return {
      cardId: loadedCard.id,
      dueAt: scheduled.dueAt,
      mediaId: loadedCard.mediaId,
      newState: scheduled.state,
      previousState
    };
  });
}

export async function resetReviewCardProgress(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!loadedCard || loadedCard.status === "archived") {
      throw new Error("Review card not available for reset.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    await tx
      .update(card)
      .set({
        status: "active",
        updatedAt: nowIso
      })
      .where(eq(card.id, loadedCard.id));

    await tx
      .insert(reviewState)
      .values({
        cardId: loadedCard.id,
        state: "new",
        stability: null,
        difficulty: null,
        dueAt: nowIso,
        lastReviewedAt: null,
        scheduledDays: 0,
        learningSteps: 0,
        lapses: 0,
        reps: 0,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        createdAt: loadedCard.reviewState?.createdAt ?? nowIso,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewState.cardId,
        set: {
          state: "new",
          stability: null,
          difficulty: null,
          dueAt: nowIso,
          lastReviewedAt: null,
          scheduledDays: 0,
          learningSteps: 0,
          lapses: 0,
          reps: 0,
          schedulerVersion: "fsrs_v1",
          manualOverride: false,
          updatedAt: nowIso
        }
      });

    return {
      cardId: loadedCard.id,
      mediaId: loadedCard.mediaId
    };
  });
}

export async function setReviewCardSuspended(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  suspended: boolean;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!loadedCard || loadedCard.status === "archived") {
      throw new Error("Review card not available for suspension changes.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    await tx
      .update(card)
      .set({
        status: input.suspended ? "suspended" : "active",
        updatedAt: nowIso
      })
      .where(eq(card.id, loadedCard.id));

    return {
      cardId: loadedCard.id,
      mediaId: loadedCard.mediaId,
      suspended: input.suspended
    };
  });
}

export async function setLinkedEntryStatusByCard(input: {
  cardId: string;
  database?: DatabaseClient;
  expectedMediaId?: string;
  now?: Date;
  status: Exclude<ReviewEntryStatusValue, null>;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!loadedCard || loadedCard.status === "archived") {
      throw new Error("Linked entry status cannot be changed for this card.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    if (loadedCard.drivingEntries.length === 0) {
      throw new Error("This card has no canonical entry to update.");
    }

    await tx
      .insert(
        entryStatus
      )
      .values(
        loadedCard.drivingEntries.map((entry) => ({
          id: `entry_status_${entry.entryType}_${entry.entryId}`,
          entryType: entry.entryType,
          entryId: entry.entryId,
          status: input.status,
          reason: `Updated from review card ${loadedCard.id}.`,
          setAt: nowIso
        }))
      )
      .onConflictDoUpdate({
        target: [entryStatus.entryType, entryStatus.entryId],
        set: {
          status: input.status,
          reason: `Updated from review card ${loadedCard.id}.`,
          setAt: nowIso
        }
      });

    return {
      cardId: loadedCard.id,
      entries: loadedCard.drivingEntries,
      mediaId: loadedCard.mediaId,
      status: input.status
    };
  });
}

async function loadReviewCardForMutation(
  transaction: DatabaseTransaction,
  cardId: string
) {
  const row = await transaction.query.card.findFirst({
    where: eq(card.id, cardId),
    with: {
      entryLinks: true,
      reviewState: true
    }
  });

  if (!row) {
    return null;
  }

  const drivingEntryRefs = getDrivingEntryLinks(row.entryLinks);
  const drivingEntries = await loadEntryStatusRows(transaction, drivingEntryRefs);

  return {
    ...row,
    drivingEntries
  };
}

async function loadEntryStatusRows(
  transaction: DatabaseTransaction,
  entryLinks: ReviewEntryLinkLike[]
) {
  if (entryLinks.length === 0) {
    return [];
  }

  const termEntryIds = entryLinks
    .filter((entry) => entry.entryType === "term")
    .map((entry) => entry.entryId);
  const grammarEntryIds = entryLinks
    .filter((entry) => entry.entryType === "grammar")
    .map((entry) => entry.entryId);
  const filters = [];

  if (termEntryIds.length > 0) {
    filters.push(
      and(eq(entryStatus.entryType, "term"), inArray(entryStatus.entryId, termEntryIds))
    );
  }

  if (grammarEntryIds.length > 0) {
    filters.push(
      and(
        eq(entryStatus.entryType, "grammar"),
        inArray(entryStatus.entryId, grammarEntryIds)
      )
    );
  }

  const statusRows =
    filters.length > 0
      ? await transaction.query.entryStatus.findMany({
          where: filters.length === 1 ? filters[0] : or(filters[0]!, filters[1]!)
        })
      : [];
  const statusMap = new Map(
    statusRows.map((statusRow) => [`${statusRow.entryType}:${statusRow.entryId}`, statusRow])
  );

  return entryLinks.map(
    (entry): LinkedEntryRef & { status: typeof entryStatus.$inferSelect | null } => ({
      entryId: entry.entryId,
      entryType: entry.entryType,
      status: statusMap.get(`${entry.entryType}:${entry.entryId}`) ?? null
    })
  );
}

function assertCardBelongsToExpectedMedia(
  mediaId: string,
  expectedMediaId: string | undefined
) {
  if (expectedMediaId && mediaId !== expectedMediaId) {
    throw new Error("Review card does not belong to the requested media.");
  }
}

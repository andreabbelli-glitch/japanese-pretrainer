import { eq, inArray } from "drizzle-orm";

import { db, type DatabaseClient } from "@/db";
import { card, reviewCanonicalControl, reviewSubjectState } from "@/db/schema";
import { buildReviewSubjectIdentityFromCanonical } from "@/features/review/model/subject";
import { CURRENT_REVIEW_SCHEDULER_VERSION } from "@/features/review/model/scheduler";
import {
  assertCardBelongsToExpectedMedia,
  isActiveReviewableMutationCard,
  isResettableMutationCard,
  isSuspensionMutationCard,
  loadReviewCardForMutation,
  loadReviewSubjectMutationContext,
  patchReviewSubjectState,
  resolveReviewSubjectStateSource,
  type ReviewSubjectStateInsert,
  upsertReviewSubjectState
} from "@/features/review/server/mutation-context";
import { appendReviewEvent } from "@/features/review/server/event-ledger";

type ReviewEntryMutationStatus = "known_manual" | "learning" | "ignored";

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

    if (!isResettableMutationCard(loadedCard)) {
      throw new Error("Review card not available for reset.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );

    await tx
      .update(card)
      .set({
        status: "active",
        updatedAt: nowIso
      })
      .where(
        inArray(
          card.id,
          subjectContext.memberCards.map((member) => member.id)
        )
      );

    const sourceState = resolveReviewSubjectStateSource(subjectContext, nowIso);
    const nextState = patchReviewSubjectState(sourceState, {
      cardId: loadedCard.id,
      crossMediaGroupId: subjectContext.identity.crossMediaGroupId,
      difficulty: null,
      dueAt: nowIso,
      entryId: subjectContext.identity.entryId,
      entryType: subjectContext.identity.entryType,
      lapses: 0,
      lastInteractionAt: nowIso,
      lastReviewedAt: null,
      learningSteps: 0,
      manualOverride: false,
      reps: 0,
      scheduledDays: 0,
      schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
      stability: null,
      state: "new",
      subjectType: subjectContext.identity.subjectKind,
      suspended: false,
      updatedAt: nowIso
    });

    await upsertReviewSubjectState(tx, nextState);
    await appendReviewEvent(tx, {
      afterState: nextState,
      answeredAt: nowIso,
      beforeState: sourceState,
      cardId: loadedCard.id,
      cardType: loadedCard.cardType,
      eventKind: "reset",
      identity: subjectContext.identity,
      mediaId: loadedCard.mediaId,
      reason: "user_reset"
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

    if (!isSuspensionMutationCard(loadedCard)) {
      throw new Error("Review card not available for suspension changes.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );

    await tx
      .update(card)
      .set({
        status: input.suspended ? "suspended" : "active",
        updatedAt: nowIso
      })
      .where(
        inArray(
          card.id,
          subjectContext.memberCards.map((member) => member.id)
        )
      );

    const sourceState = resolveReviewSubjectStateSource(subjectContext, nowIso);
    const nextState = patchReviewSubjectState(sourceState, {
      lastInteractionAt: nowIso,
      suspended: input.suspended,
      updatedAt: nowIso
    });

    await upsertReviewSubjectState(tx, nextState);
    await appendReviewEvent(tx, {
      afterState: nextState,
      answeredAt: nowIso,
      beforeState: sourceState,
      cardId: loadedCard.id,
      cardType: loadedCard.cardType,
      eventKind: "manual",
      identity: subjectContext.identity,
      mediaId: loadedCard.mediaId,
      reason: input.suspended ? "suspend" : "resume"
    });

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
  status: ReviewEntryMutationStatus;
}) {
  const database = input.database ?? db;
  const nowIso = (input.now ?? new Date()).toISOString();

  return database.transaction(async (tx) => {
    const loadedCard = await loadReviewCardForMutation(tx, input.cardId);

    if (!isActiveReviewableMutationCard(loadedCard)) {
      throw new Error("Linked entry status cannot be changed for this card.");
    }

    assertCardBelongsToExpectedMedia(loadedCard.mediaId, input.expectedMediaId);

    const subjectContext = await loadReviewSubjectMutationContext(
      tx,
      loadedCard,
      nowIso
    );

    if (subjectContext.drivingEntries.length === 0) {
      throw new Error("This card has no canonical entry to update.");
    }

    const sourceState = resolveReviewSubjectStateSource(
      subjectContext,
      nowIso,
      {
        initialState: input.status === "learning" ? "learning" : "new"
      }
    );
    await tx
      .insert(reviewCanonicalControl)
      .values({
        canonicalSubjectKey: subjectContext.identity.canonicalSubjectKey,
        createdAt: nowIso,
        status: input.status,
        updatedAt: nowIso
      })
      .onConflictDoUpdate({
        target: reviewCanonicalControl.canonicalSubjectKey,
        set: {
          status: input.status,
          updatedAt: nowIso
        }
      });

    const canonicalStates = await tx.query.reviewSubjectState.findMany({
      where: eq(
        reviewSubjectState.canonicalSubjectKey,
        subjectContext.identity.canonicalSubjectKey
      )
    });
    const statesByKey = new Map<string, ReviewSubjectStateInsert>(
      canonicalStates.map((state) => [state.subjectKey, state])
    );

    statesByKey.set(sourceState.subjectKey, sourceState);

    const representativeCardIds = [...statesByKey.values()]
      .map((state) => state.cardId)
      .filter(
        (cardId): cardId is string => cardId !== null && cardId !== undefined
      );
    const representativeCards =
      representativeCardIds.length > 0
        ? await tx.query.card.findMany({
            where: inArray(card.id, representativeCardIds)
          })
        : [];
    const cardById = new Map(
      representativeCards.map((representativeCard) => [
        representativeCard.id,
        representativeCard
      ])
    );

    for (const state of statesByKey.values()) {
      const representativeCard = state.cardId
        ? cardById.get(state.cardId)
        : undefined;

      if (!representativeCard) {
        throw new Error(
          `Review memory ${state.subjectKey} has no representative card.`
        );
      }

      const nextState = patchReviewSubjectState(state, {
        lastInteractionAt: nowIso,
        manualOverride: input.status === "known_manual",
        state:
          input.status === "learning" && state.state === "known_manual"
            ? "learning"
            : state.state,
        suspended: input.status === "ignored",
        updatedAt: nowIso
      });
      const identity = buildReviewSubjectIdentityFromCanonical({
        cardId: representativeCard.id,
        cardType: representativeCard.cardType,
        canonicalSubjectKey: subjectContext.identity.canonicalSubjectKey,
        crossMediaGroupId: state.crossMediaGroupId ?? null,
        entryId: state.entryId ?? null,
        entryType: state.entryType ?? null,
        subjectKind: state.subjectType
      });

      await upsertReviewSubjectState(tx, nextState);
      await appendReviewEvent(tx, {
        afterState: nextState,
        answeredAt: nowIso,
        beforeState: state,
        cardId: representativeCard.id,
        cardType: representativeCard.cardType,
        eventKind: "manual",
        identity,
        mediaId: representativeCard.mediaId,
        reason: `entry_status_${input.status}`
      });
    }

    return {
      cardId: loadedCard.id,
      entries: subjectContext.drivingEntries,
      mediaId: loadedCard.mediaId,
      status: input.status
    };
  });
}

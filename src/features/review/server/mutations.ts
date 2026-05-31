import { inArray } from "drizzle-orm";

import { db, type DatabaseClient } from "@/db";
import { card } from "@/db/schema";
import {
  assertCardBelongsToExpectedMedia,
  isActiveReviewableMutationCard,
  isResettableMutationCard,
  isSuspensionMutationCard,
  loadReviewCardForMutation,
  loadReviewSubjectMutationContext,
  patchReviewSubjectState,
  resolveReviewSubjectStateSource,
  upsertReviewSubjectState
} from "@/features/review/server/mutation-context";

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

    await upsertReviewSubjectState(
      tx,
      patchReviewSubjectState(sourceState, {
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
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "new",
        subjectType: subjectContext.identity.subjectKind,
        suspended: false,
        updatedAt: nowIso
      })
    );

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

    await upsertReviewSubjectState(
      tx,
      patchReviewSubjectState(sourceState, {
        lastInteractionAt: nowIso,
        schedulerVersion: "fsrs_v1",
        suspended: input.suspended,
        updatedAt: nowIso
      })
    );

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

    const isManualOverride = input.status === "known_manual";
    const isSuspended = input.status === "ignored";
    const sourceState = resolveReviewSubjectStateSource(
      subjectContext,
      nowIso,
      {
        initialState: input.status === "learning" ? "learning" : "new"
      }
    );
    const restoredState =
      input.status === "learning" && sourceState.state === "known_manual"
        ? "learning"
        : sourceState.state;

    await upsertReviewSubjectState(
      tx,
      patchReviewSubjectState(sourceState, {
        lastInteractionAt: nowIso,
        manualOverride: isManualOverride,
        schedulerVersion: "fsrs_v1",
        state: restoredState,
        suspended: isSuspended,
        updatedAt: nowIso
      })
    );

    return {
      cardId: loadedCard.id,
      entries: subjectContext.drivingEntries,
      mediaId: loadedCard.mediaId,
      status: input.status
    };
  });
}

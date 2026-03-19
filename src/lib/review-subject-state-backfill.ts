import type { DatabaseClient } from "../db/client.ts";
import { listReviewSubjectStatesByKeys } from "../db/queries/review-subject.ts";
import { listReviewCardsByMediaIds } from "../db/queries/review.ts";
import { reviewSubjectState } from "../db/schema/review.ts";

import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  type ReviewSubjectStateSnapshot
} from "./review-subject.ts";
import { loadReviewSubjectStateLookup } from "./review-subject-state-lookup.ts";

export type ReviewSubjectStateBackfillResult = {
  cardCount: number;
  insertedCount: number;
  legacyFallbackCount: number;
  subjectCount: number;
};

export type ReviewSubjectStateCoverageResult = {
  cardCount: number;
  complete: boolean;
  existingStateCount: number;
  legacyFallbackCounts: {
    complex: number;
    inline: number;
  };
  missingStateCount: number;
  subjectCount: number;
};

export async function backfillReviewSubjectState(
  database: DatabaseClient,
  input: {
    now?: Date;
  } = {}
): Promise<ReviewSubjectStateBackfillResult> {
  const [mediaRows, terms, grammar] = await Promise.all([
    database.query.media.findMany({
      columns: {
        id: true
      }
    }),
    database.query.term.findMany({
      columns: {
        crossMediaGroupId: true,
        id: true,
        lemma: true,
        reading: true
      }
    }),
    database.query.grammarPattern.findMany({
      columns: {
        crossMediaGroupId: true,
        id: true,
        pattern: true,
        reading: true
      }
    })
  ]);
  const mediaIds = mediaRows.map((row) => row.id);

  if (mediaIds.length === 0) {
    return {
      cardCount: 0,
      insertedCount: 0,
      legacyFallbackCount: 0,
      subjectCount: 0
    };
  }

  const cards = await listReviewCardsByMediaIds(database, mediaIds);

  if (cards.length === 0) {
    return {
      cardCount: 0,
      insertedCount: 0,
      legacyFallbackCount: 0,
      subjectCount: 0
    };
  }

  const lookup = await loadReviewSubjectStateLookup({
    cards,
    database,
    grammar,
    nowIso: input.now?.toISOString(),
    terms
  });

  if (lookup.fallbackStates.length > 0) {
    await database
      .insert(reviewSubjectState)
      .values(
        lookup.fallbackStates.map((state) => ({
          cardId: state.cardId,
          createdAt: state.createdAt,
          crossMediaGroupId: state.crossMediaGroupId,
          difficulty: state.difficulty,
          dueAt: state.dueAt,
          entryId: state.entryId,
          entryType: state.entryType,
          lapses: state.lapses,
          lastInteractionAt: state.lastInteractionAt,
          lastReviewedAt: state.lastReviewedAt,
          learningSteps: state.learningSteps,
          manualOverride: state.manualOverride,
          reps: state.reps,
          scheduledDays: state.scheduledDays,
          stability: state.stability,
          state: state.state,
          subjectKey: state.subjectKey,
          subjectType: state.subjectType,
          suspended: state.suspended,
          updatedAt: state.updatedAt
        }))
      )
      .onConflictDoNothing({
        target: reviewSubjectState.subjectKey
      });
  }

  return {
    cardCount: cards.length,
    insertedCount: lookup.fallbackStates.length,
    legacyFallbackCount: lookup.fallbackStates.length,
    subjectCount: lookup.subjectGroups.length
  };
}

export async function inspectReviewSubjectStateCoverage(
  database: DatabaseClient,
  input: {
    now?: Date;
  } = {}
): Promise<ReviewSubjectStateCoverageResult> {
  const [mediaRows, terms, grammar] = await Promise.all([
    database.query.media.findMany({
      columns: {
        id: true
      }
    }),
    database.query.term.findMany({
      columns: {
        crossMediaGroupId: true,
        id: true,
        lemma: true,
        reading: true
      }
    }),
    database.query.grammarPattern.findMany({
      columns: {
        crossMediaGroupId: true,
        id: true,
        pattern: true,
        reading: true
      }
    })
  ]);
  const mediaIds = mediaRows.map((row) => row.id);

  if (mediaIds.length === 0) {
    return {
      cardCount: 0,
      complete: true,
      existingStateCount: 0,
      legacyFallbackCounts: {
        complex: 0,
        inline: 0
      },
      missingStateCount: 0,
      subjectCount: 0
    };
  }

  const cards = await listReviewCardsByMediaIds(database, mediaIds);

  if (cards.length === 0) {
    return {
      cardCount: 0,
      complete: true,
      existingStateCount: 0,
      legacyFallbackCounts: {
        complex: 0,
        inline: 0
      },
      missingStateCount: 0,
      subjectCount: 0
    };
  }

  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar,
    terms
  });
  const subjectKeys = [
    ...new Set(
      cards.map(
        (card) =>
          deriveReviewSubjectIdentity({
            cardId: card.id,
            cardType: card.cardType,
            front: card.front,
            entryLinks: card.entryLinks,
            entryLookup: subjectEntryLookup
          }).subjectKey
      )
    )
  ];
  const subjectStateRows = await listReviewSubjectStatesByKeys(
    database,
    subjectKeys
  );
  const subjectStates = new Map(
    [...subjectStateRows.entries()].map(([subjectKey, row]) => [
      subjectKey,
      row as ReviewSubjectStateSnapshot
    ])
  );
  const subjectGroups = groupReviewCardsBySubject({
    cards,
    entryLookup: subjectEntryLookup,
    nowIso: input.now?.toISOString(),
    subjectStates
  });
  const missingSubjectGroups = subjectGroups.filter(
    (group) => !subjectStates.has(group.identity.subjectKey)
  );

  return {
    cardCount: cards.length,
    complete: missingSubjectGroups.length === 0,
    existingStateCount: subjectStates.size,
    legacyFallbackCounts: {
      complex: missingSubjectGroups.filter(
        (group) => group.identity.subjectKind !== "card"
      ).length,
      inline: missingSubjectGroups.filter(
        (group) => group.identity.subjectKind === "card"
      ).length
    },
    missingStateCount: missingSubjectGroups.length,
    subjectCount: subjectGroups.length
  };
}

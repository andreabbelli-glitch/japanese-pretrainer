import type { DatabaseClient } from "../db/client.ts";
import {
  listReviewSubjectStatesByKeys,
  type ReviewCardListItem
} from "../db/queries/index.ts";

import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectGroup,
  type ReviewSubjectStateSnapshot
} from "./review-subject.ts";

export type ReviewSubjectStateLookupResult = {
  subjectGroups: ReviewSubjectGroup[];
};

type ResolveReviewSubjectGroupsInput = {
  cards: ReviewCardListItem[];
  database: DatabaseClient;
  grammar: Array<{
    crossMediaGroupId: string | null;
    id: string;
    pattern: string;
    reading?: string | null;
  }>;
  nowIso?: string;
  terms: Array<{
    crossMediaGroupId: string | null;
    id: string;
    lemma: string;
    reading?: string | null;
  }>;
};

export type ResolveReviewSubjectGroupsResult = {
  subjectGroups: ReviewSubjectGroup[];
  subjectStates: Map<string, ReviewSubjectStateSnapshot>;
};

export async function resolveReviewSubjectGroups(
  input: ResolveReviewSubjectGroupsInput
): Promise<ResolveReviewSubjectGroupsResult> {
  const subjectEntryLookup = buildReviewSubjectEntryLookup({
    grammar: input.grammar,
    terms: input.terms
  });
  const subjectKeys = [
    ...new Set(
      input.cards.map(
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
    input.database,
    subjectKeys
  );
  const subjectStates = new Map(
    [...subjectStateRows.entries()].map(([subjectKey, row]) => [
      subjectKey,
      row as ReviewSubjectStateSnapshot
    ])
  );
  const groupedCards = groupReviewCardsBySubject({
    cards: input.cards,
    entryLookup: subjectEntryLookup,
    nowIso: input.nowIso,
    subjectStates
  });

  return {
    subjectGroups: groupedCards,
    subjectStates
  };
}

export async function loadReviewSubjectStateLookup(
  input: ResolveReviewSubjectGroupsInput
): Promise<ReviewSubjectStateLookupResult> {
  const { subjectGroups, subjectStates } = await resolveReviewSubjectGroups(
    input
  );

  return {
    subjectGroups: subjectGroups.map((group) => {
      const subjectState = subjectStates.get(group.identity.subjectKey) ?? null;

      return {
        ...group,
        lastInteractionAt: subjectState?.lastInteractionAt ?? group.lastInteractionAt,
        representativeCard: selectReviewSubjectRepresentativeCard(
          group.cards,
          subjectState,
          input.nowIso
        ),
        subjectState
      } satisfies ReviewSubjectGroup;
    })
  };
}

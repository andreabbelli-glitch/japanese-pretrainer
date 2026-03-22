import type { DatabaseClient } from "../db/client.ts";
import {
  listReviewSubjectStatesByKeys,
  type ReviewCardListItem
} from "../db/queries/index.ts";

import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  type ReviewSubjectGroup,
  type ReviewSubjectIdentity,
  type ReviewSubjectStateSnapshot
} from "./review-subject.ts";


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
  const precomputedIdentities = new Map<string, ReviewSubjectIdentity>();
  const subjectKeysSet = new Set<string>();

  for (const card of input.cards) {
    const identity = deriveReviewSubjectIdentity({
      cardId: card.id,
      cardType: card.cardType,
      front: card.front,
      entryLinks: card.entryLinks,
      entryLookup: subjectEntryLookup
    });

    precomputedIdentities.set(card.id, identity);
    subjectKeysSet.add(identity.subjectKey);
  }

  const subjectKeys = [...subjectKeysSet];
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
    subjectStates,
    precomputedIdentities
  });

  return {
    subjectGroups: groupedCards,
    subjectStates
  };
}

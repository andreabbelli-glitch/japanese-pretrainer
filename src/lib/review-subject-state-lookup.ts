import type { ReviewCardSource } from "./review-card-contract.ts";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  type ReviewSubjectGroup,
  type ReviewSubjectIdentity,
  type ReviewSubjectStateSnapshot
} from "./review-subject.ts";

type ReviewSubjectStateLoader = (
  subjectKeys: string[]
) => Promise<ReadonlyMap<string, ReviewSubjectStateSnapshot>>;

type ResolveReviewSubjectGroupsInput = {
  cards: ReviewCardSource[];
  grammar: Array<{
    crossMediaGroupId: string | null;
    id: string;
    pattern: string;
    reading?: string | null;
  }>;
  loadSubjectStatesByKeys: ReviewSubjectStateLoader;
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
  const subjectStateRows = await input.loadSubjectStatesByKeys(subjectKeys);
  const subjectStates = new Map(subjectStateRows);
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

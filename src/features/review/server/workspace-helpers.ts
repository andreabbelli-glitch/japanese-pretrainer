import type { DatabaseClient } from "@/db";
import {
  listReviewSubjectStatesByKeys,
  type ReviewCardListItem
} from "@/db/queries";
import { getPendingConsolidationSubjectKeySet } from "@/features/consolidation/server";
import { hasCompletedReviewLesson } from "@/features/review/model/state";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import { resolveReviewSubjectGroups } from "@/features/review/server/subject-state-lookup";

export function filterEligibleReviewCards(cards: ReviewCardListItem[]) {
  return cards.filter((card) => hasCompletedReviewLesson(card));
}

export function filterReviewCardsBySubjectGroups(
  cards: ReviewCardListItem[],
  subjectGroups: ReviewSubjectGroup[]
) {
  const visibleCardIds = new Set(
    subjectGroups.flatMap((group) => group.cards.map((card) => card.id))
  );

  return cards.filter((card) => visibleCardIds.has(card.id));
}

export async function resolveReviewWorkspaceSubjectGroups(input: {
  cards: ReviewCardListItem[];
  database: DatabaseClient;
  grammar: Array<{
    crossMediaGroupId: string | null;
    id: string;
    pattern: string;
    reading?: string | null;
  }>;
  now: Date;
  profiler?: ReviewProfiler | null;
  terms: Array<{
    crossMediaGroupId: string | null;
    id: string;
    lemma: string;
    reading?: string | null;
  }>;
}) {
  if (input.cards.length === 0) {
    return [] as ReviewSubjectGroup[];
  }

  const { subjectGroups } = await measureWith(
    input.profiler,
    "resolveReviewSubjectGroups",
    () =>
      resolveReviewSubjectGroups({
        cards: input.cards,
        grammar: input.grammar,
        loadSubjectStatesByKeys: (subjectKeys) =>
          listReviewSubjectStatesByKeys(input.database, subjectKeys),
        nowIso: input.now.toISOString(),
        terms: input.terms
      }),
    (value) => ({ subjectGroups: value.subjectGroups.length })
  );

  const pendingConsolidationSubjectKeys =
    await getPendingConsolidationSubjectKeySet(
      input.database,
      subjectGroups.map((group) => group.identity.subjectKey)
    );

  if (pendingConsolidationSubjectKeys.size === 0) {
    return subjectGroups;
  }

  return subjectGroups.filter(
    (group) => !pendingConsolidationSubjectKeys.has(group.identity.subjectKey)
  );
}

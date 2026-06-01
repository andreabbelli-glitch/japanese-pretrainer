import { db, type DatabaseClient } from "@/db";
import {
  countReviewSubjectsIntroducedOnDay,
  type ReviewCardListItem
} from "@/db/queries";
import {
  buildReviewSummaryTags,
  canUseDataCache,
  runWithTaggedCache
} from "@/features/cache/server/data-cache";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import {
  filterReviewCardsBySubjectGroups,
  resolveReviewWorkspaceSubjectGroups
} from "@/features/review/server/workspace-helpers";
import { getLocalIsoDateKey } from "@/features/shared/model/local-date";
import { getReviewDailyLimit } from "@/features/settings/server";

export type ReviewWorkspaceTermIdentityRow = {
  crossMediaGroupId: string | null;
  id: string;
  lemma: string;
  reading?: string | null;
};

export type ReviewWorkspaceGrammarIdentityRow = {
  crossMediaGroupId: string | null;
  id: string;
  pattern: string;
  reading?: string | null;
};

export type StableReviewWorkspaceCore = {
  cards: ReviewCardListItem[];
  grammar: ReviewWorkspaceGrammarIdentityRow[];
  rawCardCount: number;
  terms: ReviewWorkspaceTermIdentityRow[];
};

export type LoadedReviewWorkspaceCore<
  TStable extends StableReviewWorkspaceCore
> = {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  newIntroducedTodayCount: number;
  now: Date;
  rawCardCount: number;
  stableWorkspace: TStable;
  subjectGroups: ReviewSubjectGroup[];
};

export async function resolveLoadedReviewWorkspaceCore<
  TStable extends StableReviewWorkspaceCore
>(input: {
  bypassCache?: boolean;
  database: DatabaseClient;
  mediaIds: string[];
  now: Date;
  profiler?: ReviewProfiler | null;
  resolvedDailyLimit?: number | Promise<number>;
  resolvedNewIntroducedTodayCount?: number;
  stableWorkspacePromise: Promise<TStable>;
}): Promise<LoadedReviewWorkspaceCore<TStable>> {
  const subjectGroupsPromise = input.stableWorkspacePromise.then(
    async (stableWorkspace) =>
      resolveReviewWorkspaceSubjectGroups({
        cards: stableWorkspace.cards,
        database: input.database,
        grammar: stableWorkspace.grammar,
        now: input.now,
        profiler: input.profiler,
        terms: stableWorkspace.terms
      })
  );
  const [stableWorkspace, dailyLimit, newIntroducedTodayCount, subjectGroups] =
    await Promise.all([
      input.stableWorkspacePromise,
      input.resolvedDailyLimit != null
        ? input.resolvedDailyLimit
        : measureWith(input.profiler, "getReviewDailyLimit", () =>
            getReviewDailyLimit(input.database)
          ),
      input.resolvedNewIntroducedTodayCount != null
        ? input.resolvedNewIntroducedTodayCount
        : measureWith(
            input.profiler,
            "countReviewSubjectsIntroducedOnDay",
            () =>
              loadReviewIntroducedTodayCountCached(
                input.database,
                input.now,
                input.bypassCache
              )
          ),
      subjectGroupsPromise
    ]);
  const cards = filterReviewCardsBySubjectGroups(
    stableWorkspace.cards,
    subjectGroups
  );

  input.profiler?.addMeta({
    cards: cards.length,
    mediaIds: input.mediaIds.length,
    rawCardCount: stableWorkspace.rawCardCount
  });

  return {
    cards,
    dailyLimit,
    newIntroducedTodayCount,
    now: input.now,
    rawCardCount: stableWorkspace.rawCardCount,
    stableWorkspace,
    subjectGroups: cards.length === 0 ? [] : subjectGroups
  };
}

export async function loadReviewIntroducedTodayCountCached(
  database: DatabaseClient = db,
  asOf: Date = new Date(),
  bypassCache?: boolean
) {
  return runWithTaggedCache({
    enabled: !bypassCache && canUseDataCache(database),
    keyParts: ["review-introduced-global", getLocalIsoDateKey(asOf)],
    loader: () => countReviewSubjectsIntroducedOnDay(database, asOf),
    tags: buildReviewSummaryTags()
  });
}

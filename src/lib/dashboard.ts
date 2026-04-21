import { db, type DatabaseClient } from "@/db";
import {
  GLOSSARY_SUMMARY_TAG,
  MEDIA_LIST_TAG,
  canUseDataCache,
  listMediaCached,
  REVIEW_FIRST_CANDIDATE_TAG,
  REVIEW_SUMMARY_TAG,
  runWithTaggedCache,
  SETTINGS_TAG
} from "@/lib/data-cache";
import { pickBestBy } from "@/lib/collections";
import {
  loadMediaShellSnapshots,
  pickFocusMedia,
  type MediaShellSnapshot
} from "@/lib/media-shell";
import {
  loadGlobalReviewOverviewSnapshot,
  loadReviewIntroducedTodayCountCached,
  loadReviewLaunchCandidatesCached
} from "@/lib/review";
import { getLocalIsoTimeBucketKey } from "@/lib/local-date";
import { getReviewDailyLimit } from "@/lib/settings";

export type DashboardData = {
  focusMedia: MediaShellSnapshot | null;
  reviewMedia: MediaShellSnapshot | null;
  media: MediaShellSnapshot[];
  review: {
    activeReviewCards: number;
    cardsDue: number;
    queueCount: number;
    newQueuedCount: number;
    queueLabel: string;
  };
  totals: {
    lessonsCompleted: number;
    lessonsTotal: number;
    entriesKnown: number;
    entriesTotal: number;
  };
};

export async function getDashboardData(
  database: DatabaseClient = db
): Promise<DashboardData> {
  const now = new Date();
  const cacheBucketKey = getLocalIsoTimeBucketKey(now);

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "dashboard", `bucket:${cacheBucketKey}`],
    loader: () => loadDashboardData(database, now),
    tags: [
      MEDIA_LIST_TAG,
      GLOSSARY_SUMMARY_TAG,
      REVIEW_SUMMARY_TAG,
      REVIEW_FIRST_CANDIDATE_TAG,
      SETTINGS_TAG
    ]
  });
}

async function loadDashboardData(
  database: DatabaseClient,
  now: Date
): Promise<DashboardData> {
  const mediaRowsPromise = listMediaCached(database);
  const dailyLimitPromise = getReviewDailyLimit(database);
  const newIntroducedTodayCountPromise = loadReviewIntroducedTodayCountCached(
    database,
    now
  );
  const reviewCandidatesPromise = loadReviewLaunchCandidatesCached(
    database,
    now.toISOString()
  );
  const globalReviewOverviewPromise = Promise.all([
    dailyLimitPromise,
    newIntroducedTodayCountPromise
  ]).then(([dailyLimit, newIntroducedTodayCount]) =>
    loadGlobalReviewOverviewSnapshot(database, {
      asOf: now,
      resolvedDailyLimit: dailyLimit,
      resolvedNewIntroducedTodayCount: newIntroducedTodayCount
    })
  );
  const mediaPromise = Promise.all([
    mediaRowsPromise,
    dailyLimitPromise,
    newIntroducedTodayCountPromise,
    reviewCandidatesPromise
  ]).then(
    ([mediaRows, dailyLimit, newIntroducedTodayCount, reviewCandidates]) =>
      loadMediaShellSnapshots(database, mediaRows, {
        now,
        resolvedDailyLimit: dailyLimit,
        resolvedNewIntroducedTodayCount: newIntroducedTodayCount,
        resolvedReviewCandidates: reviewCandidates
      })
  );
  const [media, globalReviewOverview] = await Promise.all([
    mediaPromise,
    globalReviewOverviewPromise
  ]);
  const focusMedia = pickFocusMedia(media);
  const reviewMedia = pickReviewMedia(media);

  return {
    focusMedia,
    reviewMedia,
    media,
    review: {
      activeReviewCards: globalReviewOverview.activeCards,
      cardsDue: globalReviewOverview.dueCount,
      queueCount: globalReviewOverview.queueCount,
      newQueuedCount: globalReviewOverview.newQueuedCount,
      queueLabel: globalReviewOverview.queueLabel
    },
    totals: media.reduce(
      (acc, item) => {
        acc.lessonsCompleted += item.lessonsCompleted;
        acc.lessonsTotal += item.lessonsTotal;
        acc.entriesKnown += item.entriesKnown;
        acc.entriesTotal += item.entriesTotal;
        return acc;
      },
      {
        lessonsCompleted: 0,
        lessonsTotal: 0,
        entriesKnown: 0,
        entriesTotal: 0
      }
    )
  };
}

function pickReviewMedia(media: MediaShellSnapshot[]) {
  return pickBestBy(media, (left, right) => {
    const scoreDifference = scoreMediaReview(left) - scoreMediaReview(right);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if (left.cardsDue !== right.cardsDue) {
      return right.cardsDue - left.cardsDue;
    }

    if (left.activeReviewCards !== right.activeReviewCards) {
      return right.activeReviewCards - left.activeReviewCards;
    }

    if (left.cardsTotal !== right.cardsTotal) {
      return right.cardsTotal - left.cardsTotal;
    }

    return left.title.localeCompare(right.title, "it");
  });
}

function scoreMediaReview(item: MediaShellSnapshot) {
  if (item.cardsDue > 0) {
    return 0;
  }

  if (item.activeReviewCards > 0) {
    return 1;
  }

  if (item.cardsTotal > 0) {
    return 2;
  }

  return 3;
}

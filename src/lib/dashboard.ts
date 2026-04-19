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
  loadReviewIntroducedTodayCountCached
} from "@/lib/review";
import { getLocalIsoDateKey } from "@/lib/local-date";
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
  const cacheDayKey = getLocalIsoDateKey(new Date());

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "dashboard", `day:${cacheDayKey}`],
    loader: () => loadDashboardData(database),
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
  database: DatabaseClient
): Promise<DashboardData> {
  const [mediaRows, dailyLimit, newIntroducedTodayCount] = await Promise.all([
    listMediaCached(database),
    getReviewDailyLimit(database),
    loadReviewIntroducedTodayCountCached(database)
  ]);
  const [media, globalReviewOverview] = await Promise.all([
    loadMediaShellSnapshots(database, mediaRows, {
      resolvedDailyLimit: dailyLimit,
      resolvedNewIntroducedTodayCount: newIntroducedTodayCount
    }),
    loadGlobalReviewOverviewSnapshot(database, {
      resolvedDailyLimit: dailyLimit,
      resolvedNewIntroducedTodayCount: newIntroducedTodayCount
    })
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

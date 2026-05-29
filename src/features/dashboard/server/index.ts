import { db, type DatabaseClient } from "@/db";
import { listRecentLessonsForDashboard } from "@/db/queries";
import type { Route } from "next";
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
} from "@/features/media/server";
import {
  loadReviewIntroducedTodayCountCached,
  loadReviewOverviewBundle
} from "@/features/review/server";
import { getLocalIsoTimeBucketKey } from "@/lib/local-date";
import { getReviewDailyLimit } from "@/features/settings/server";
import { mediaTextbookLessonHref } from "@/lib/site";

const DASHBOARD_RECENT_LESSON_LIMIT = 3;

export type DashboardRecentLesson = {
  createdAt: string;
  href: Route;
  id: string;
  mediaSlug: string;
  mediaTitle: string;
  segmentTitle: string | null;
  summary: string | null;
  title: string;
};

export type DashboardData = {
  focusMedia: MediaShellSnapshot | null;
  reviewMedia: MediaShellSnapshot | null;
  media: MediaShellSnapshot[];
  recentLessons: DashboardRecentLesson[];
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
  const recentLessonRowsPromise = listRecentLessonsForDashboard(
    database,
    DASHBOARD_RECENT_LESSON_LIMIT
  );
  const reviewOverviewBundlePromise = Promise.all([
    mediaRowsPromise,
    dailyLimitPromise,
    newIntroducedTodayCountPromise
  ]).then(([mediaRows, dailyLimit, newIntroducedTodayCount]) =>
    loadReviewOverviewBundle(
      database,
      mediaRows.map((item) => ({
        id: item.id,
        slug: item.slug
      })),
      {
        asOf: now,
        globalMediaRows: mediaRows,
        resolvedDailyLimit: dailyLimit,
        resolvedNewIntroducedTodayCount: newIntroducedTodayCount
      }
    )
  );
  const mediaPromise = Promise.all([
    mediaRowsPromise,
    dailyLimitPromise,
    newIntroducedTodayCountPromise,
    reviewOverviewBundlePromise
  ]).then(
    ([mediaRows, dailyLimit, newIntroducedTodayCount, reviewOverviewBundle]) =>
      loadMediaShellSnapshots(database, mediaRows, {
        now,
        resolvedDailyLimit: dailyLimit,
        resolvedNewIntroducedTodayCount: newIntroducedTodayCount,
        resolvedReviewSnapshots: reviewOverviewBundle.byMedia
      })
  );
  const [media, reviewOverviewBundle, recentLessonRows] = await Promise.all([
    mediaPromise,
    reviewOverviewBundlePromise,
    recentLessonRowsPromise
  ]);
  const globalReviewOverview = reviewOverviewBundle.global;
  const focusMedia = pickFocusMedia(media);
  const reviewMedia = pickReviewMedia(media);

  return {
    focusMedia,
    reviewMedia,
    media,
    recentLessons: recentLessonRows.map((row) => ({
      createdAt: row.createdAt,
      href: mediaTextbookLessonHref(row.mediaSlug, row.lessonSlug),
      id: row.id,
      mediaSlug: row.mediaSlug,
      mediaTitle: row.mediaTitle,
      segmentTitle: row.segmentTitle,
      summary: row.summary,
      title: row.title
    })),
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

    const newQueuedDifference =
      (right.newQueuedReviewCards ?? 0) - (left.newQueuedReviewCards ?? 0);

    if (newQueuedDifference !== 0) {
      return newQueuedDifference;
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

  if ((item.newQueuedReviewCards ?? 0) > 0) {
    return 1;
  }

  if (item.activeReviewCards > 0) {
    return 2;
  }

  if (item.cardsTotal > 0) {
    return 3;
  }

  return 4;
}

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
  type MediaShellSnapshot
} from "@/lib/media-shell";

export type DashboardData = {
  focusMedia: MediaShellSnapshot | null;
  reviewMedia: MediaShellSnapshot | null;
  media: MediaShellSnapshot[];
  totals: {
    cardsDue: number;
    lessonsCompleted: number;
    lessonsTotal: number;
    entriesKnown: number;
    entriesTotal: number;
    activeReviewCards: number;
  };
};

export async function getDashboardData(
  database: DatabaseClient = db
): Promise<DashboardData> {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["app-shell", "dashboard"],
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
  const media = await loadMediaShellSnapshots(
    database,
    await listMediaCached(database)
  );
  const focusMedia = pickFocusMedia(media);
  const reviewMedia = pickReviewMedia(media);

  return {
    focusMedia,
    reviewMedia,
    media,
    totals: {
      cardsDue: media.reduce((sum, item) => sum + item.cardsDue, 0),
      lessonsCompleted: media.reduce(
        (sum, item) => sum + item.lessonsCompleted,
        0
      ),
      lessonsTotal: media.reduce((sum, item) => sum + item.lessonsTotal, 0),
      entriesKnown: media.reduce((sum, item) => sum + item.entriesKnown, 0),
      entriesTotal: media.reduce((sum, item) => sum + item.entriesTotal, 0),
      activeReviewCards: media.reduce(
        (sum, item) => sum + item.activeReviewCards,
        0
      )
    }
  };
}

function pickFocusMedia(media: MediaShellSnapshot[]) {
  return pickBestBy(media, (left, right) => {
    return scoreMediaFocus(left) - scoreMediaFocus(right);
  });
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

function scoreMediaFocus(item: MediaShellSnapshot) {
  if (item.activeLesson) {
    return 0;
  }

  if (item.cardsDue > 0) {
    return 1;
  }

  if ((item.textbookProgressPercent ?? 0) < 100) {
    return 2;
  }

  return 3;
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

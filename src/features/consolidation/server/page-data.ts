import { asc, eq } from "drizzle-orm";

import { db, type DatabaseClient, type DatabaseQueryClient } from "@/db";
import { preReviewConsolidationState } from "@/db/schema";
import { getLessonBySlug, getMediaBySlug } from "@/db/queries";
import {
  consolidationLessonHref,
  consolidationRetrainingHref,
  reviewHref,
  type AppHref
} from "@/features/navigation";

import type {
  ConsolidationHubData,
  ConsolidationHubMediaGroup,
  ConsolidationSessionData
} from "./contracts";
import {
  countConsolidationRowsByStatus,
  listPendingConsolidationRowsByLessonId,
  listRetrainingConsolidationRows,
  listSameMediaFallbackCards,
  listSameMediaFallbackCardsByMediaIds
} from "./read-queries";
import {
  buildConsolidationPresentations,
  buildSessionSteps,
  comparePendingRowsForSession
} from "./presentation";

export async function getConsolidationHubData(
  database: DatabaseQueryClient = db
): Promise<ConsolidationHubData> {
  const [pendingRows, retrainingCount] = await Promise.all([
    database.query.preReviewConsolidationState.findMany({
      columns: {
        lessonId: true,
        mediaId: true
      },
      where: eq(preReviewConsolidationState.status, "pending"),
      with: {
        lesson: {
          columns: {
            slug: true,
            title: true
          }
        },
        media: {
          columns: {
            slug: true,
            title: true
          }
        }
      },
      orderBy: [
        asc(preReviewConsolidationState.mediaId),
        asc(preReviewConsolidationState.lessonId),
        asc(preReviewConsolidationState.createdAt),
        asc(preReviewConsolidationState.subjectKey)
      ]
    }),
    countConsolidationRowsByStatus(database, "retraining")
  ]);
  const groups = new Map<string, ConsolidationHubMediaGroup>();

  for (const row of pendingRows) {
    const mediaGroup = groups.get(row.mediaId) ?? {
      lessons: [],
      mediaId: row.mediaId,
      mediaSlug: row.media.slug,
      mediaTitle: row.media.title,
      pendingCount: 0
    };
    const existingLesson = mediaGroup.lessons.find(
      (lessonGroup) => lessonGroup.lessonId === row.lessonId
    );
    const lessonGroup = existingLesson ?? {
      href: consolidationLessonHref(row.media.slug, row.lesson.slug),
      lessonId: row.lessonId,
      lessonSlug: row.lesson.slug,
      lessonTitle: row.lesson.title,
      pendingCount: 0
    };

    lessonGroup.pendingCount += 1;
    mediaGroup.pendingCount += 1;

    if (!existingLesson) {
      mediaGroup.lessons.push(lessonGroup);
    }

    groups.set(row.mediaId, mediaGroup);
  }

  return {
    mediaGroups: [...groups.values()],
    retrainingQueue:
      retrainingCount > 0
        ? {
            href: consolidationRetrainingHref(),
            pendingCount: retrainingCount,
            title: "Ripasso da review"
          }
        : null,
    totalPending: pendingRows.length + retrainingCount
  };
}

export async function getConsolidationSessionData(input: {
  database?: DatabaseClient;
  lessonSlug: string;
  mediaSlug: string;
}): Promise<ConsolidationSessionData | null> {
  const database = input.database ?? db;
  const media = await getMediaBySlug(database, input.mediaSlug);

  if (!media) {
    return null;
  }

  const lesson = await getLessonBySlug(database, media.id, input.lessonSlug);

  if (!lesson) {
    return null;
  }

  const pendingRows = await listPendingConsolidationRowsByLessonId(
    database,
    lesson.id
  );

  if (pendingRows.length === 0) {
    return {
      hubHref: "/consolidation" as AppHref,
      lesson: {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title
      },
      media: {
        id: media.id,
        slug: media.slug,
        title: media.title
      },
      reviewHref: reviewHref(),
      subjects: [],
      totalPending: 0
    };
  }

  const sortedPendingRows = [...pendingRows].sort(comparePendingRowsForSession);
  const fallbackCards = await listSameMediaFallbackCards(database, media.id);
  const presentations = await buildConsolidationPresentations({
    database,
    fallbackCards,
    pendingRows: sortedPendingRows
  });
  const pendingSubjectKeys = new Set(
    sortedPendingRows.map((row) => row.subjectKey)
  );
  const pendingPresentations = presentations.filter((presentation) =>
    pendingSubjectKeys.has(presentation.subjectKey)
  );

  return {
    hubHref: "/consolidation" as AppHref,
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title
    },
    media: {
      id: media.id,
      slug: media.slug,
      title: media.title
    },
    reviewHref: reviewHref(),
    subjects: pendingPresentations.map((presentation) => ({
      attemptCount: presentation.attemptCount,
      back: presentation.back,
      canMarkKnown: presentation.canMarkKnown,
      front: presentation.front,
      pronunciation: presentation.pronunciation,
      representativeCardId: presentation.representativeCardId,
      steps: buildSessionSteps(presentation, presentations),
      subjectKey: presentation.subjectKey
    })),
    totalPending: pendingPresentations.length
  };
}

export async function getRetrainingConsolidationSessionData(
  database: DatabaseClient = db
): Promise<ConsolidationSessionData> {
  const retrainingRows = await listRetrainingConsolidationRows(database);
  const fallbackCards = await listSameMediaFallbackCardsByMediaIds(database, [
    ...new Set(retrainingRows.map((row) => row.mediaId))
  ]);
  const presentations = await buildConsolidationPresentations({
    choiceGroupId: () => "retraining",
    database,
    fallbackCards,
    pendingRows: retrainingRows
  });
  const pendingSubjectKeys = new Set(
    retrainingRows.map((row) => row.subjectKey)
  );
  const pendingPresentations = presentations.filter((presentation) =>
    pendingSubjectKeys.has(presentation.subjectKey)
  );

  return {
    hubHref: "/consolidation" as AppHref,
    lesson: {
      id: "retraining",
      slug: "retraining",
      title: "Ripasso da review"
    },
    media: {
      id: "retraining",
      slug: "retraining",
      title: "Consolidamento FSRS"
    },
    reviewHref: reviewHref(),
    subjects: pendingPresentations.map((presentation) => ({
      attemptCount: presentation.attemptCount,
      back: presentation.back,
      canMarkKnown: presentation.canMarkKnown,
      front: presentation.front,
      pronunciation: presentation.pronunciation,
      representativeCardId: presentation.representativeCardId,
      steps: buildSessionSteps(presentation, presentations),
      subjectKey: presentation.subjectKey
    })),
    totalPending: pendingPresentations.length
  };
}

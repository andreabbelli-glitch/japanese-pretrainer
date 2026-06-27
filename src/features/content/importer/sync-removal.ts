import { eq, inArray, sql } from "drizzle-orm";

import type { DatabaseClient } from "../../../db/client.ts";
import {
  card,
  crossMediaGroup,
  grammarPattern,
  lesson,
  media,
  segment,
  term
} from "../../../db/schema/index.ts";
import type { ExistingMediaState, ImportSyncSummary } from "./types.ts";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export async function archiveRemovedLessons(
  transaction: DatabaseTransaction,
  input: {
    currentLessonIds: ReadonlySet<string>;
    mediaId: string;
    nowIso: string;
  }
) {
  const removedIds = (
    await transaction.query.lesson.findMany({
      where: eq(lesson.mediaId, input.mediaId)
    })
  )
    .filter(
      (row) => row.status !== "archived" && !input.currentLessonIds.has(row.id)
    )
    .map((row) => row.id);

  if (removedIds.length === 0) {
    return [];
  }

  await transaction
    .update(lesson)
    .set({
      status: "archived",
      updatedAt: input.nowIso
    })
    .where(inArray(lesson.id, removedIds));

  return removedIds;
}

export async function archiveRemovedCards(
  transaction: DatabaseTransaction,
  input: {
    currentCardIds: ReadonlySet<string>;
    mediaId: string;
    nowIso: string;
  }
) {
  const removedIds = (
    await transaction.query.card.findMany({
      where: eq(card.mediaId, input.mediaId)
    })
  )
    .filter(
      (row) => row.status !== "archived" && !input.currentCardIds.has(row.id)
    )
    .map((row) => row.id);

  if (removedIds.length === 0) {
    return [];
  }

  await transaction
    .update(card)
    .set({
      status: "archived",
      updatedAt: input.nowIso
    })
    .where(inArray(card.id, removedIds));

  return removedIds;
}

export async function archiveRemovedScopedCards(
  transaction: DatabaseTransaction,
  input: {
    currentCardIds: ReadonlySet<string>;
    currentMediaCardIds: ReadonlySet<string>;
    existingCardIds: string[];
    nowIso: string;
  }
) {
  const removedIds = input.existingCardIds.filter(
    (cardId) =>
      !input.currentCardIds.has(cardId) &&
      !input.currentMediaCardIds.has(cardId)
  );

  if (removedIds.length === 0) {
    return [];
  }

  await transaction
    .update(card)
    .set({
      status: "archived",
      updatedAt: input.nowIso
    })
    .where(inArray(card.id, removedIds));

  return removedIds;
}

export function collectScopedExistingEntryIds(
  existingState: ExistingMediaState,
  input: {
    cardIds: ReadonlySet<string>;
    lessonIds: ReadonlySet<string>;
  }
) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  const register = (entry: { entryId: string; entryType: string }) => {
    if (entry.entryType === "term") {
      termIds.add(entry.entryId);
      return;
    }

    if (entry.entryType === "grammar") {
      grammarIds.add(entry.entryId);
    }
  };

  for (const link of existingState.entryLinks) {
    if (
      (link.sourceType === "lesson" && input.lessonIds.has(link.sourceId)) ||
      (link.sourceType === "card" && input.cardIds.has(link.sourceId))
    ) {
      register(link);
    }
  }

  for (const scopedCard of existingState.cards) {
    if (!input.cardIds.has(scopedCard.id)) {
      continue;
    }

    for (const link of scopedCard.entryLinks) {
      register(link);
    }
  }

  return {
    grammarIds,
    termIds
  };
}

export async function pruneRemovedTerms(
  transaction: DatabaseTransaction,
  input: {
    currentTermIds: ReadonlySet<string>;
    existingTermIds: string[];
  }
) {
  const removedIds = input.existingTermIds.filter(
    (termId) => !input.currentTermIds.has(termId)
  );

  if (removedIds.length === 0) {
    return [];
  }

  await transaction.delete(term).where(inArray(term.id, removedIds));
  return removedIds;
}

export async function pruneRemovedGrammarPatterns(
  transaction: DatabaseTransaction,
  input: {
    currentGrammarIds: ReadonlySet<string>;
    existingGrammarIds: string[];
  }
) {
  const removedIds = input.existingGrammarIds.filter(
    (grammarId) => !input.currentGrammarIds.has(grammarId)
  );

  if (removedIds.length === 0) {
    return [];
  }

  await transaction
    .delete(grammarPattern)
    .where(inArray(grammarPattern.id, removedIds));
  return removedIds;
}

export async function pruneRemovedSegments(
  transaction: DatabaseTransaction,
  input: {
    currentSegmentIds: ReadonlySet<string>;
    existingSegmentIds: string[];
  }
) {
  const removedIds = input.existingSegmentIds.filter(
    (segmentId) => !input.currentSegmentIds.has(segmentId)
  );

  if (removedIds.length === 0) {
    return;
  }

  await transaction.delete(segment).where(inArray(segment.id, removedIds));
}

export async function archiveRemovedMedia(
  transaction: DatabaseTransaction,
  input: {
    currentMediaIds: ReadonlySet<string>;
    nowIso: string;
  }
) {
  const removedMedia = (await transaction.query.media.findMany()).filter(
    (row) => row.status !== "archived" && !input.currentMediaIds.has(row.id)
  );

  if (removedMedia.length === 0) {
    return {
      filesChanged: 0,
      summary: {
        archivedCardIds: [],
        archivedLessonIds: [],
        archivedMediaIds: [],
        prunedGrammarIds: [],
        prunedTermIds: []
      } satisfies ImportSyncSummary
    };
  }

  const removedMediaIds = removedMedia.map((row) => row.id);
  const removedLessons = await transaction.query.lesson.findMany({
    where: inArray(lesson.mediaId, removedMediaIds)
  });
  const removedCards = await transaction.query.card.findMany({
    where: inArray(card.mediaId, removedMediaIds)
  });
  const removedTerms = await transaction.query.term.findMany({
    where: inArray(term.mediaId, removedMediaIds)
  });
  const removedGrammarPatterns =
    await transaction.query.grammarPattern.findMany({
      where: inArray(grammarPattern.mediaId, removedMediaIds)
    });
  const archivedLessonIds = removedLessons
    .filter((row) => row.status !== "archived")
    .map((row) => row.id);
  const archivedCardIds = removedCards
    .filter((row) => row.status !== "archived")
    .map((row) => row.id);
  const archivedLessonIdSet = new Set(archivedLessonIds);
  const archivedCardIdSet = new Set(archivedCardIds);

  await transaction
    .update(media)
    .set({
      status: "archived",
      updatedAt: input.nowIso
    })
    .where(inArray(media.id, removedMediaIds));

  if (archivedLessonIds.length > 0) {
    await transaction
      .update(lesson)
      .set({
        status: "archived",
        updatedAt: input.nowIso
      })
      .where(inArray(lesson.id, archivedLessonIds));
  }

  if (archivedCardIds.length > 0) {
    await transaction
      .update(card)
      .set({
        status: "archived",
        updatedAt: input.nowIso
      })
      .where(inArray(card.id, archivedCardIds));
  }

  await transaction
    .delete(segment)
    .where(inArray(segment.mediaId, removedMediaIds));

  if (removedTerms.length > 0) {
    await transaction.delete(term).where(
      inArray(
        term.id,
        removedTerms.map((row) => row.id)
      )
    );
  }

  if (removedGrammarPatterns.length > 0) {
    await transaction.delete(grammarPattern).where(
      inArray(
        grammarPattern.id,
        removedGrammarPatterns.map((row) => row.id)
      )
    );
  }

  return {
    filesChanged:
      removedMedia.length +
      new Set(
        removedLessons
          .filter((row) => archivedLessonIdSet.has(row.id))
          .map((row) => row.sourceFile)
      ).size +
      new Set(
        removedCards
          .filter((row) => archivedCardIdSet.has(row.id))
          .map((row) => row.sourceFile)
      ).size,
    summary: {
      archivedCardIds,
      archivedLessonIds,
      archivedMediaIds: removedMediaIds,
      prunedGrammarIds: removedGrammarPatterns.map((row) => row.id),
      prunedTermIds: removedTerms.map((row) => row.id)
    } satisfies ImportSyncSummary
  };
}

export async function pruneOrphanedCrossMediaGroups(
  transaction: DatabaseTransaction
) {
  const termGroupRows = await transaction
    .select({ id: term.crossMediaGroupId })
    .from(term)
    .where(sql`${term.crossMediaGroupId} is not null`);
  const grammarGroupRows = await transaction
    .select({ id: grammarPattern.crossMediaGroupId })
    .from(grammarPattern)
    .where(sql`${grammarPattern.crossMediaGroupId} is not null`);
  const referencedIds = new Set(
    [...termGroupRows, ...grammarGroupRows]
      .map((row) => row.id)
      .filter((value): value is string => typeof value === "string")
  );
  const existingRows = await transaction.query.crossMediaGroup.findMany();
  const orphanIds = existingRows
    .map((row) => row.id)
    .filter((id) => !referencedIds.has(id));

  if (orphanIds.length === 0) {
    return;
  }

  await transaction
    .delete(crossMediaGroup)
    .where(inArray(crossMediaGroup.id, orphanIds));
}

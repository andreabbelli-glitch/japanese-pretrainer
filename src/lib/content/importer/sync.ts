import { eq, inArray, sql } from "drizzle-orm";

import type { DatabaseClient } from "../../../db/client.ts";
import {
  card,
  cardEntryLink,
  entryLink,
  grammarAlias,
  grammarPattern,
  lesson,
  lessonContent,
  media,
  segment,
  term,
  termAlias
} from "../../../db/schema/index.ts";

import { buildMediaImportPlan } from "./planner.ts";
import type {
  ExistingMediaState,
  ImportSyncSummary,
  MediaImportPlan
} from "./types.ts";

type DatabaseTransaction = Parameters<
  Parameters<DatabaseClient["transaction"]>[0]
>[0];

export async function syncContentWorkspace(
  transaction: DatabaseTransaction,
  input: {
    contentRoot: string;
    importId: string;
    nowIso: string;
    syncMode: "full" | "incremental";
    workspace: {
      bundles: Parameters<typeof buildMediaImportPlan>[0]["bundle"][];
    };
  }
): Promise<{ filesChanged: number; summary: ImportSyncSummary }> {
  const plans = input.workspace.bundles.map((bundle) =>
    buildMediaImportPlan({
      bundle,
      contentRoot: input.contentRoot,
      nowIso: input.nowIso
    })
  );
  const summary: ImportSyncSummary = {
    archivedCardIds: [],
    archivedLessonIds: [],
    archivedMediaIds: [],
    prunedGrammarIds: [],
    prunedTermIds: []
  };
  let filesChanged = 0;

  for (const plan of plans) {
    const existingState = await loadExistingMediaState(transaction, plan.media.row.id);

    filesChanged += countChangedSourceDocuments(plan, existingState);

    const planSummary = await syncMediaPlan(transaction, {
      existingState,
      importId: input.importId,
      nowIso: input.nowIso,
      plan
    });

    summary.archivedCardIds.push(...planSummary.archivedCardIds);
    summary.archivedLessonIds.push(...planSummary.archivedLessonIds);
    summary.prunedGrammarIds.push(...planSummary.prunedGrammarIds);
    summary.prunedTermIds.push(...planSummary.prunedTermIds);
  }

  if (input.syncMode === "full") {
    const removedMediaSummary = await archiveRemovedMedia(transaction, {
      currentMediaIds: plans.map((plan) => plan.media.row.id),
      nowIso: input.nowIso
    });

    filesChanged += removedMediaSummary.filesChanged;
    summary.archivedCardIds.push(...removedMediaSummary.summary.archivedCardIds);
    summary.archivedLessonIds.push(...removedMediaSummary.summary.archivedLessonIds);
    summary.archivedMediaIds.push(...removedMediaSummary.summary.archivedMediaIds);
    summary.prunedGrammarIds.push(...removedMediaSummary.summary.prunedGrammarIds);
    summary.prunedTermIds.push(...removedMediaSummary.summary.prunedTermIds);
  }

  return {
    filesChanged,
    summary: dedupeSummary(summary)
  };
}

async function loadExistingMediaState(
  transaction: DatabaseTransaction,
  mediaId: string
): Promise<ExistingMediaState> {
  const mediaRow = await transaction.query.media.findFirst({
    where: eq(media.id, mediaId)
  });
  const segmentRows = await transaction.query.segment.findMany({
    where: eq(segment.mediaId, mediaId)
  });
  const lessonRows = await transaction.query.lesson.findMany({
    where: eq(lesson.mediaId, mediaId),
    with: {
      content: true
    }
  });
  const termRows = await transaction.query.term.findMany({
    where: eq(term.mediaId, mediaId),
    with: {
      aliases: true
    }
  });
  const grammarRows = await transaction.query.grammarPattern.findMany({
    where: eq(grammarPattern.mediaId, mediaId),
    with: {
      aliases: true
    }
  });
  const cardRows = await transaction.query.card.findMany({
    where: eq(card.mediaId, mediaId),
    with: {
      entryLinks: true
    }
  });
  const sourceIds = [...lessonRows.map((row) => row.id), ...cardRows.map((row) => row.id)];
  const entryLinksRows =
    sourceIds.length > 0
      ? await transaction.query.entryLink.findMany({
        where: inArray(entryLink.sourceId, sourceIds)
      })
      : [];

  return {
    cards: cardRows,
    entryLinks: entryLinksRows,
    grammarPatterns: grammarRows,
    lessonContents: lessonRows
      .map((row) => row.content)
      .filter(
        (row): row is NonNullable<(typeof lessonRows)[number]["content"]> => row !== null
      ),
    lessons: lessonRows.map((row) => {
      const { content, ...lessonRow } = row;
      void content;
      return lessonRow;
    }),
    media: mediaRow ?? null,
    segments: segmentRows,
    terms: termRows
  };
}

async function syncMediaPlan(
  transaction: DatabaseTransaction,
  input: {
    existingState: ExistingMediaState;
    importId: string;
    nowIso: string;
    plan: MediaImportPlan;
  }
) {
  const currentLessonIds = input.plan.lessons.map((plan) => plan.row.id);
  const currentCardIds = input.plan.cards.map((plan) => plan.row.id);
  const currentTermIds = input.plan.terms.map((plan) => plan.row.id);
  const currentGrammarIds = input.plan.grammarPatterns.map((plan) => plan.row.id);
  const currentSegmentIds = input.plan.segments.map((row) => row.id);

  const preparedMediaRow = prepareTimestampedRow(
    input.existingState.media,
    input.plan.media.row,
    mediaComparisonKeys
  );

  await transaction
    .insert(media)
    .values(preparedMediaRow)
    .onConflictDoUpdate({
      target: media.id,
      set: mediaUpsertSet
    });

  if (input.plan.segments.length > 0) {
    await transaction
      .insert(segment)
      .values(input.plan.segments)
      .onConflictDoUpdate({
        target: segment.id,
        set: segmentUpsertSet
      });
  }

  const archivedLessonIds = await archiveRemovedLessons(transaction, {
    currentLessonIds,
    mediaId: input.plan.media.row.id,
    nowIso: input.nowIso
  });
  const archivedCardIds = await archiveRemovedCards(transaction, {
    currentCardIds,
    mediaId: input.plan.media.row.id,
    nowIso: input.nowIso
  });

  if (input.plan.lessons.length > 0) {
    const lessonRows = input.plan.lessons.map((plan) =>
      prepareTimestampedRow(
        input.existingState.lessons.find((row) => row.id === plan.row.id) ?? null,
        plan.row,
        lessonComparisonKeys
      )
    );

    await transaction
      .insert(lesson)
      .values(lessonRows)
      .onConflictDoUpdate({
        target: lesson.id,
        set: lessonUpsertSet
      });
  }

  if (input.plan.lessonContents.length > 0) {
    const existingLessonContents = new Map(
      input.existingState.lessonContents.map((row) => [row.lessonId, row])
    );

    await transaction
      .insert(lessonContent)
      .values(
        input.plan.lessonContents.map((plan) => ({
          ...prepareLessonContentRow(
            existingLessonContents.get(plan.row.lessonId) ?? null,
            plan.row
          ),
          lastImportId: input.importId
        }))
      )
      .onConflictDoUpdate({
        target: lessonContent.lessonId,
        set: lessonContentUpsertSet
      });
  }

  if (currentLessonIds.length > 0) {
    const currentLessonEntryLinkIds = input.existingState.entryLinks
      .filter(
        (row) => row.sourceType === "lesson" && currentLessonIds.includes(row.sourceId)
      )
      .map((row) => row.id);

    if (currentLessonEntryLinkIds.length > 0) {
      await transaction
        .delete(entryLink)
        .where(inArray(entryLink.id, currentLessonEntryLinkIds));
    }
  }

  if (currentCardIds.length > 0) {
    const currentCardEntryLinkIds = input.existingState.entryLinks
      .filter((row) => row.sourceType === "card" && currentCardIds.includes(row.sourceId))
      .map((row) => row.id);

    if (currentCardEntryLinkIds.length > 0) {
      await transaction
        .delete(entryLink)
        .where(inArray(entryLink.id, currentCardEntryLinkIds));
    }
  }

  if (input.plan.entryLinks.length > 0) {
    await transaction.insert(entryLink).values(input.plan.entryLinks);
  }

  if (input.plan.terms.length > 0) {
    const termRows = input.plan.terms.map((plan) =>
      prepareTimestampedRow(
        input.existingState.terms.find((row) => row.id === plan.row.id) ?? null,
        plan.row,
        termComparisonKeys
      )
    );

    await transaction
      .insert(term)
      .values(termRows)
      .onConflictDoUpdate({
        target: term.id,
        set: termUpsertSet
      });
  }

  if (currentTermIds.length > 0) {
    await transaction.delete(termAlias).where(inArray(termAlias.termId, currentTermIds));
  }

  const termAliases = input.plan.terms.flatMap((plan) => plan.aliases);

  if (termAliases.length > 0) {
    await transaction.insert(termAlias).values(termAliases);
  }

  if (input.plan.grammarPatterns.length > 0) {
    const grammarRows = input.plan.grammarPatterns.map((plan) =>
      prepareTimestampedRow(
        input.existingState.grammarPatterns.find((row) => row.id === plan.row.id) ??
        null,
        plan.row,
        grammarComparisonKeys
      )
    );

    await transaction
      .insert(grammarPattern)
      .values(grammarRows)
      .onConflictDoUpdate({
        target: grammarPattern.id,
        set: grammarUpsertSet
      });
  }

  if (currentGrammarIds.length > 0) {
    await transaction
      .delete(grammarAlias)
      .where(inArray(grammarAlias.grammarId, currentGrammarIds));
  }

  const grammarAliases = input.plan.grammarPatterns.flatMap((plan) => plan.aliases);

  if (grammarAliases.length > 0) {
    await transaction.insert(grammarAlias).values(grammarAliases);
  }

  if (input.plan.cards.length > 0) {
    const cardRows = input.plan.cards.map((plan) =>
      prepareTimestampedRow(
        input.existingState.cards.find((row) => row.id === plan.row.id) ?? null,
        plan.row,
        cardComparisonKeys
      )
    );

    await transaction
      .insert(card)
      .values(cardRows)
      .onConflictDoUpdate({
        target: card.id,
        set: cardUpsertSet
      });
  }

  if (currentCardIds.length > 0) {
    await transaction
      .delete(cardEntryLink)
      .where(inArray(cardEntryLink.cardId, currentCardIds));
  }

  const cardEntryLinks = input.plan.cards.flatMap((plan) => plan.termLinks);

  if (cardEntryLinks.length > 0) {
    await transaction.insert(cardEntryLink).values(cardEntryLinks);
  }

  const prunedTermIds = await pruneRemovedTerms(transaction, {
    currentTermIds,
    existingTermIds: input.existingState.terms.map((row) => row.id)
  });
  const prunedGrammarIds = await pruneRemovedGrammarPatterns(transaction, {
    currentGrammarIds,
    existingGrammarIds: input.existingState.grammarPatterns.map((row) => row.id)
  });
  await pruneRemovedSegments(transaction, {
    currentSegmentIds,
    existingSegmentIds: input.existingState.segments.map((row) => row.id)
  });

  return {
    archivedCardIds,
    archivedLessonIds,
    prunedGrammarIds,
    prunedTermIds
  };
}

async function archiveRemovedLessons(
  transaction: DatabaseTransaction,
  input: {
    currentLessonIds: string[];
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
      (row) => row.status !== "archived" && !input.currentLessonIds.includes(row.id)
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

async function archiveRemovedCards(
  transaction: DatabaseTransaction,
  input: {
    currentCardIds: string[];
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
      (row) => row.status !== "archived" && !input.currentCardIds.includes(row.id)
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

async function pruneRemovedTerms(
  transaction: DatabaseTransaction,
  input: {
    currentTermIds: string[];
    existingTermIds: string[];
  }
) {
  const removedIds = input.existingTermIds.filter(
    (termId) => !input.currentTermIds.includes(termId)
  );

  if (removedIds.length === 0) {
    return [];
  }

  await transaction.delete(term).where(inArray(term.id, removedIds));
  return removedIds;
}

async function pruneRemovedGrammarPatterns(
  transaction: DatabaseTransaction,
  input: {
    currentGrammarIds: string[];
    existingGrammarIds: string[];
  }
) {
  const removedIds = input.existingGrammarIds.filter(
    (grammarId) => !input.currentGrammarIds.includes(grammarId)
  );

  if (removedIds.length === 0) {
    return [];
  }

  await transaction
    .delete(grammarPattern)
    .where(inArray(grammarPattern.id, removedIds));
  return removedIds;
}

async function pruneRemovedSegments(
  transaction: DatabaseTransaction,
  input: {
    currentSegmentIds: string[];
    existingSegmentIds: string[];
  }
) {
  const removedIds = input.existingSegmentIds.filter(
    (segmentId) => !input.currentSegmentIds.includes(segmentId)
  );

  if (removedIds.length === 0) {
    return;
  }

  await transaction.delete(segment).where(inArray(segment.id, removedIds));
}

async function archiveRemovedMedia(
  transaction: DatabaseTransaction,
  input: {
    currentMediaIds: string[];
    nowIso: string;
  }
) {
  const removedMedia = (await transaction.query.media.findMany()).filter(
    (row) => row.status !== "archived" && !input.currentMediaIds.includes(row.id)
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
  const removedGrammarPatterns = await transaction.query.grammarPattern.findMany({
    where: inArray(grammarPattern.mediaId, removedMediaIds)
  });
  const archivedLessonIds = removedLessons
    .filter((row) => row.status !== "archived")
    .map((row) => row.id);
  const archivedCardIds = removedCards
    .filter((row) => row.status !== "archived")
    .map((row) => row.id);

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

  await transaction.delete(segment).where(inArray(segment.mediaId, removedMediaIds));

  if (removedTerms.length > 0) {
    await transaction
      .delete(term)
      .where(inArray(term.id, removedTerms.map((row) => row.id)));
  }

  if (removedGrammarPatterns.length > 0) {
    await transaction
      .delete(grammarPattern)
      .where(inArray(grammarPattern.id, removedGrammarPatterns.map((row) => row.id)));
  }

  return {
    filesChanged:
      removedMedia.length +
      new Set(
        removedLessons
          .filter((row) => archivedLessonIds.includes(row.id))
          .map((row) => row.sourceFile)
      ).size +
      new Set(
        removedCards
          .filter((row) => archivedCardIds.includes(row.id))
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

function countChangedSourceDocuments(
  plan: MediaImportPlan,
  existingState: ExistingMediaState
) {
  const existingLessonsById = new Map(existingState.lessons.map((row) => [row.id, row]));
  const existingLessonContentById = new Map(
    existingState.lessonContents.map((row) => [row.lessonId, row])
  );
  const existingTermsById = new Map(existingState.terms.map((row) => [row.id, row]));
  const existingGrammarById = new Map(
    existingState.grammarPatterns.map((row) => [row.id, row])
  );
  const existingCardsById = new Map(existingState.cards.map((row) => [row.id, row]));
  const existingSegmentsById = new Map(existingState.segments.map((row) => [row.id, row]));
  const currentSourceFiles = new Set(plan.sourceDocuments.map((document) => document.sourceFile));
  const changedDocuments = plan.sourceDocuments.filter((document) => {
    if (document.kind === "media") {
      return (
        !rowsMatch(existingState.media, plan.media.row, mediaComparisonKeys) ||
        plan.segments.some(
          (row) =>
            !rowsMatch(existingSegmentsById.get(row.id) ?? null, row, segmentComparisonKeys)
        )
      );
    }

    if (document.kind === "lesson") {
      return (
        document.entityIds.lessons.some((lessonId) =>
          !rowsMatch(
            existingLessonsById.get(lessonId) ?? null,
            plan.lessons.find((row) => row.row.id === lessonId)?.row ?? null,
            lessonComparisonKeys
          )
        ) ||
        document.entityIds.lessons.some((lessonId) =>
          !rowsMatch(
            existingLessonContentById.get(lessonId) ?? null,
            plan.lessonContents.find((row) => row.row.lessonId === lessonId)?.row ?? null,
            lessonContentComparisonKeys
          )
        ) ||
        document.entityIds.terms.some((termId) =>
          !rowsMatch(
            existingTermsById.get(termId) ?? null,
            plan.terms.find((row) => row.row.id === termId)?.row ?? null,
            termComparisonKeys
          ) ||
          !aliasSetsMatch(
            existingTermsById.get(termId)?.aliases ?? [],
            plan.terms.find((row) => row.row.id === termId)?.aliases ?? [],
            termAliasComparisonKeys
          )
        ) ||
        document.entityIds.grammarPatterns.some((grammarId) =>
          !rowsMatch(
            existingGrammarById.get(grammarId) ?? null,
            plan.grammarPatterns.find((row) => row.row.id === grammarId)?.row ?? null,
            grammarComparisonKeys
          ) ||
          !aliasSetsMatch(
            existingGrammarById.get(grammarId)?.aliases ?? [],
            plan.grammarPatterns.find((row) => row.row.id === grammarId)?.aliases ?? [],
            grammarAliasComparisonKeys
          )
        ) ||
        existingState.lessons.some(
          (row) =>
            row.sourceFile === document.sourceFile &&
            row.status !== "archived" &&
            !document.entityIds.lessons.includes(row.id)
        )
      );
    }

    return (
      document.entityIds.cards.some((cardId) =>
        !rowsMatch(
          existingCardsById.get(cardId) ?? null,
          plan.cards.find((row) => row.row.id === cardId)?.row ?? null,
          cardComparisonKeys
        )
      ) ||
      document.entityIds.terms.some((termId) =>
        !rowsMatch(
          existingTermsById.get(termId) ?? null,
          plan.terms.find((row) => row.row.id === termId)?.row ?? null,
          termComparisonKeys
        ) ||
        !aliasSetsMatch(
          existingTermsById.get(termId)?.aliases ?? [],
          plan.terms.find((row) => row.row.id === termId)?.aliases ?? [],
          termAliasComparisonKeys
        )
      ) ||
      document.entityIds.grammarPatterns.some((grammarId) =>
        !rowsMatch(
          existingGrammarById.get(grammarId) ?? null,
          plan.grammarPatterns.find((row) => row.row.id === grammarId)?.row ?? null,
          grammarComparisonKeys
        ) ||
        !aliasSetsMatch(
          existingGrammarById.get(grammarId)?.aliases ?? [],
          plan.grammarPatterns.find((row) => row.row.id === grammarId)?.aliases ?? [],
          grammarAliasComparisonKeys
        )
      ) ||
      existingState.cards.some(
        (row) =>
          row.sourceFile === document.sourceFile &&
          row.status !== "archived" &&
          !document.entityIds.cards.includes(row.id)
      )
    );
  });
  const removedLessonFiles = new Set(
    existingState.lessons
      .filter((row) => row.status !== "archived" && !currentSourceFiles.has(row.sourceFile))
      .map((row) => row.sourceFile)
  );
  const removedCardFiles = new Set(
    existingState.cards
      .filter((row) => row.status !== "archived" && !currentSourceFiles.has(row.sourceFile))
      .map((row) => row.sourceFile)
  );

  return changedDocuments.length + removedLessonFiles.size + removedCardFiles.size;
}

function prepareTimestampedRow<T extends { createdAt: string; updatedAt: string }>(
  existingRow: T | null,
  nextRow: T,
  comparisonKeys: string[]
) {
  if (!existingRow) {
    return nextRow;
  }

  if (rowsMatch(existingRow, nextRow, comparisonKeys)) {
    return {
      ...nextRow,
      createdAt: existingRow.createdAt,
      updatedAt: existingRow.updatedAt
    };
  }

  return {
    ...nextRow,
    createdAt: existingRow.createdAt
  };
}

function prepareLessonContentRow<
  T extends {
    astJson?: string | null;
    excerpt?: string | null;
    htmlRendered: string;
    lessonId: string;
    markdownRaw: string;
    lastImportId: string;
  }
>(existingRow: T | null, nextRow: T) {
  if (!existingRow || !rowsMatch(existingRow, nextRow, lessonContentComparisonKeys)) {
    return nextRow;
  }

  return {
    ...nextRow,
    astJson: existingRow.astJson,
    excerpt: existingRow.excerpt,
    htmlRendered: existingRow.htmlRendered,
    markdownRaw: existingRow.markdownRaw
  };
}

function rowsMatch(
  existingRow: Record<string, unknown> | null | undefined,
  nextRow: Record<string, unknown> | null | undefined,
  comparisonKeys: string[]
) {
  if (!existingRow || !nextRow) {
    return false;
  }

  return comparisonKeys.every((key) => {
    return serializeComparableValue(existingRow[key]) === serializeComparableValue(nextRow[key]);
  });
}

function aliasSetsMatch(
  existingRows: Array<Record<string, unknown>>,
  nextRows: Array<Record<string, unknown>>,
  comparisonKeys: string[]
) {
  if (existingRows.length !== nextRows.length) {
    return false;
  }

  const left = [...existingRows]
    .map((row) => serializeComparableFields(row, comparisonKeys))
    .sort();
  const right = [...nextRows]
    .map((row) => serializeComparableFields(row, comparisonKeys))
    .sort();

  return left.every((value, index) => value === right[index]);
}

function serializeComparableFields(
  row: Record<string, unknown>,
  comparisonKeys: string[]
) {
  return JSON.stringify(
    comparisonKeys.map((key) => [key, serializeComparableValue(row[key])])
  );
}

function serializeComparableValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

function dedupeSummary(summary: ImportSyncSummary): ImportSyncSummary {
  return {
    archivedCardIds: [...new Set(summary.archivedCardIds)],
    archivedLessonIds: [...new Set(summary.archivedLessonIds)],
    archivedMediaIds: [...new Set(summary.archivedMediaIds)],
    prunedGrammarIds: [...new Set(summary.prunedGrammarIds)],
    prunedTermIds: [...new Set(summary.prunedTermIds)]
  };
}

function excluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

const mediaUpsertSet = {
  slug: excluded("slug"),
  title: excluded("title"),
  mediaType: excluded("media_type"),
  segmentKind: excluded("segment_kind"),
  language: excluded("language"),
  baseExplanationLanguage: excluded("base_explanation_language"),
  description: excluded("description"),
  status: excluded("status"),
  updatedAt: excluded("updated_at")
};

const segmentUpsertSet = {
  mediaId: excluded("media_id"),
  slug: excluded("slug"),
  title: excluded("title"),
  orderIndex: excluded("order_index"),
  segmentType: excluded("segment_type"),
  notes: excluded("notes")
};

const lessonUpsertSet = {
  mediaId: excluded("media_id"),
  segmentId: excluded("segment_id"),
  slug: excluded("slug"),
  title: excluded("title"),
  orderIndex: excluded("order_index"),
  difficulty: excluded("difficulty"),
  summary: excluded("summary"),
  status: excluded("status"),
  sourceFile: excluded("source_file"),
  updatedAt: excluded("updated_at")
};

const lessonContentUpsertSet = {
  markdownRaw: excluded("markdown_raw"),
  htmlRendered: excluded("html_rendered"),
  astJson: excluded("ast_json"),
  excerpt: excluded("excerpt"),
  lastImportId: excluded("last_import_id")
};

const termUpsertSet = {
  mediaId: excluded("media_id"),
  segmentId: excluded("segment_id"),
  lemma: excluded("lemma"),
  reading: excluded("reading"),
  romaji: excluded("romaji"),
  pos: excluded("pos"),
  meaningIt: excluded("meaning_it"),
  meaningLiteralIt: excluded("meaning_literal_it"),
  notesIt: excluded("notes_it"),
  levelHint: excluded("level_hint"),
  searchLemmaNorm: excluded("search_lemma_norm"),
  searchReadingNorm: excluded("search_reading_norm"),
  searchRomajiNorm: excluded("search_romaji_norm"),
  updatedAt: excluded("updated_at")
};

const grammarUpsertSet = {
  mediaId: excluded("media_id"),
  segmentId: excluded("segment_id"),
  pattern: excluded("pattern"),
  title: excluded("title"),
  reading: excluded("reading"),
  meaningIt: excluded("meaning_it"),
  notesIt: excluded("notes_it"),
  levelHint: excluded("level_hint"),
  searchPatternNorm: excluded("search_pattern_norm"),
  updatedAt: excluded("updated_at")
};

const cardUpsertSet = {
  mediaId: excluded("media_id"),
  segmentId: excluded("segment_id"),
  sourceFile: excluded("source_file"),
  cardType: excluded("card_type"),
  front: excluded("front"),
  back: excluded("back"),
  exampleJp: excluded("example_jp"),
  exampleIt: excluded("example_it"),
  notesIt: excluded("notes_it"),
  status: excluded("status"),
  orderIndex: excluded("order_index"),
  updatedAt: excluded("updated_at")
};

const mediaComparisonKeys = [
  "id",
  "slug",
  "title",
  "mediaType",
  "segmentKind",
  "language",
  "baseExplanationLanguage",
  "description",
  "status"
];

const segmentComparisonKeys = [
  "id",
  "mediaId",
  "slug",
  "title",
  "orderIndex",
  "segmentType",
  "notes"
];

const lessonComparisonKeys = [
  "id",
  "mediaId",
  "segmentId",
  "slug",
  "title",
  "orderIndex",
  "difficulty",
  "summary",
  "status",
  "sourceFile"
];

const lessonContentComparisonKeys = [
  "lessonId",
  "markdownRaw",
  "htmlRendered",
  "astJson",
  "excerpt"
];

const termComparisonKeys = [
  "id",
  "mediaId",
  "segmentId",
  "lemma",
  "reading",
  "romaji",
  "pos",
  "meaningIt",
  "meaningLiteralIt",
  "notesIt",
  "levelHint",
  "searchLemmaNorm",
  "searchReadingNorm",
  "searchRomajiNorm"
];

const termAliasComparisonKeys = ["termId", "aliasText", "aliasNorm", "aliasType"];

const grammarComparisonKeys = [
  "id",
  "mediaId",
  "segmentId",
  "pattern",
  "title",
  "reading",
  "meaningIt",
  "notesIt",
  "levelHint",
  "searchPatternNorm"
];

const grammarAliasComparisonKeys = ["grammarId", "aliasText", "aliasNorm"];

const cardComparisonKeys = [
  "id",
  "mediaId",
  "segmentId",
  "sourceFile",
  "cardType",
  "front",
  "back",
  "exampleJp",
  "exampleIt",
  "notesIt",
  "status",
  "orderIndex"
];

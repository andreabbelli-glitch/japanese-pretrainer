import type { ExistingMediaState, MediaImportPlan } from "./types.ts";

export const mediaComparisonKeys = [
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

export const lessonComparisonKeys = [
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

export const lessonContentComparisonKeys = [
  "lessonId",
  "markdownRaw",
  "htmlRendered",
  "astJson",
  "excerpt"
];

export const termComparisonKeys = [
  "id",
  "sourceId",
  "crossMediaGroupId",
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
  "audioSrc",
  "audioSource",
  "audioSpeaker",
  "audioLicense",
  "audioAttribution",
  "audioPageUrl",
  "pitchAccent",
  "pitchAccentSource",
  "pitchAccentPageUrl",
  "searchLemmaNorm",
  "searchReadingNorm",
  "searchRomajiNorm"
];

export const termAliasComparisonKeys = [
  "termId",
  "aliasText",
  "aliasNorm",
  "aliasType"
];

export const grammarComparisonKeys = [
  "id",
  "sourceId",
  "crossMediaGroupId",
  "mediaId",
  "segmentId",
  "pattern",
  "title",
  "reading",
  "meaningIt",
  "notesIt",
  "levelHint",
  "audioSrc",
  "audioSource",
  "audioSpeaker",
  "audioLicense",
  "audioAttribution",
  "audioPageUrl",
  "pitchAccent",
  "pitchAccentSource",
  "pitchAccentPageUrl",
  "searchPatternNorm",
  "searchRomajiNorm"
];

export const grammarAliasComparisonKeys = ["grammarId", "aliasText", "aliasNorm"];

export const cardComparisonKeys = [
  "id",
  "lessonId",
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

export const crossMediaGroupComparisonKeys = ["id", "entryType", "groupKey"];

export function countChangedSourceDocuments(
  plan: MediaImportPlan,
  existingState: ExistingMediaState
) {
  const existingLessonsById = new Map(
    existingState.lessons.map((row) => [row.id, row])
  );
  const existingLessonContentById = new Map(
    existingState.lessonContents.map((row) => [row.lessonId, row])
  );
  const existingTermsById = new Map(
    existingState.terms.map((row) => [row.id, row])
  );
  const existingGrammarById = new Map(
    existingState.grammarPatterns.map((row) => [row.id, row])
  );
  const existingCardsById = new Map(
    existingState.cards.map((row) => [row.id, row])
  );
  const planLessonsById = new Map(
    plan.lessons.map((row) => [row.row.id, row])
  );
  const planLessonContentsByLessonId = new Map(
    plan.lessonContents.map((row) => [row.row.lessonId, row])
  );
  const planTermsById = new Map(plan.terms.map((row) => [row.row.id, row]));
  const planGrammarById = new Map(
    plan.grammarPatterns.map((row) => [row.row.id, row])
  );
  const planCardsById = new Map(plan.cards.map((row) => [row.row.id, row]));
  const currentSourceFiles = new Set(
    plan.sourceDocuments.map((document) => document.sourceFile)
  );
  const activeLessonIdsBySourceFile = groupActiveEntityIdsBySourceFile(
    existingState.lessons
  );
  const activeCardIdsBySourceFile = groupActiveEntityIdsBySourceFile(
    existingState.cards
  );
  const changedDocuments = plan.sourceDocuments.filter((document) => {
    if (document.kind === "media") {
      return !rowsMatch(existingState.media, plan.media.row, mediaComparisonKeys);
    }

    if (document.kind === "lesson") {
      return (
        document.entityIds.lessons.some(
          (lessonId) =>
            !rowsMatch(
              existingLessonsById.get(lessonId) ?? null,
              planLessonsById.get(lessonId)?.row ?? null,
              lessonComparisonKeys
            )
        ) ||
        document.entityIds.lessons.some(
          (lessonId) =>
            !rowsMatch(
              existingLessonContentById.get(lessonId) ?? null,
              planLessonContentsByLessonId.get(lessonId)?.row ?? null,
              lessonContentComparisonKeys
            )
        ) ||
        document.entityIds.terms.some((termId) => {
          const plannedTerm = planTermsById.get(termId);

          return (
            !rowsMatch(
              existingTermsById.get(termId) ?? null,
              plannedTerm?.row ?? null,
              termComparisonKeys
            ) ||
            !aliasSetsMatch(
              existingTermsById.get(termId)?.aliases ?? [],
              plannedTerm?.aliases ?? [],
              termAliasComparisonKeys
            )
          );
        }) ||
        document.entityIds.grammarPatterns.some((grammarId) => {
          const plannedGrammar = planGrammarById.get(grammarId);

          return (
            !rowsMatch(
              existingGrammarById.get(grammarId) ?? null,
              plannedGrammar?.row ?? null,
              grammarComparisonKeys
            ) ||
            !aliasSetsMatch(
              existingGrammarById.get(grammarId)?.aliases ?? [],
              plannedGrammar?.aliases ?? [],
              grammarAliasComparisonKeys
            )
          );
        }) ||
        hasRemovedActiveEntity(
          activeLessonIdsBySourceFile,
          document.sourceFile,
          document.entityIds.lessons
        )
      );
    }

    return (
      document.entityIds.cards.some(
        (cardId) =>
          !rowsMatch(
            existingCardsById.get(cardId) ?? null,
            planCardsById.get(cardId)?.row ?? null,
            cardComparisonKeys
          )
      ) ||
      document.entityIds.terms.some((termId) => {
        const plannedTerm = planTermsById.get(termId);

        return (
          !rowsMatch(
            existingTermsById.get(termId) ?? null,
            plannedTerm?.row ?? null,
            termComparisonKeys
          ) ||
          !aliasSetsMatch(
            existingTermsById.get(termId)?.aliases ?? [],
            plannedTerm?.aliases ?? [],
            termAliasComparisonKeys
          )
        );
      }) ||
      document.entityIds.grammarPatterns.some((grammarId) => {
        const plannedGrammar = planGrammarById.get(grammarId);

        return (
          !rowsMatch(
            existingGrammarById.get(grammarId) ?? null,
            plannedGrammar?.row ?? null,
            grammarComparisonKeys
          ) ||
          !aliasSetsMatch(
            existingGrammarById.get(grammarId)?.aliases ?? [],
            plannedGrammar?.aliases ?? [],
            grammarAliasComparisonKeys
          )
        );
      }) ||
      hasRemovedActiveEntity(
        activeCardIdsBySourceFile,
        document.sourceFile,
        document.entityIds.cards
      )
    );
  });
  const removedLessonFiles = new Set(
    existingState.lessons
      .filter(
        (row) =>
          row.status !== "archived" && !currentSourceFiles.has(row.sourceFile)
      )
      .map((row) => row.sourceFile)
  );
  const removedCardFiles = new Set(
    existingState.cards
      .filter(
        (row) =>
          row.status !== "archived" && !currentSourceFiles.has(row.sourceFile)
      )
      .map((row) => row.sourceFile)
  );

  return (
    changedDocuments.length + removedLessonFiles.size + removedCardFiles.size
  );
}

function groupActiveEntityIdsBySourceFile<
  T extends { id: string; sourceFile: string; status: string }
>(rows: T[]) {
  const idsBySourceFile = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.status === "archived") {
      continue;
    }

    const existing = idsBySourceFile.get(row.sourceFile);

    if (existing) {
      existing.add(row.id);
      continue;
    }

    idsBySourceFile.set(row.sourceFile, new Set([row.id]));
  }

  return idsBySourceFile;
}

function hasRemovedActiveEntity(
  activeIdsBySourceFile: ReadonlyMap<string, ReadonlySet<string>>,
  sourceFile: string,
  currentIds: readonly string[]
) {
  const activeIds = activeIdsBySourceFile.get(sourceFile);

  if (!activeIds || activeIds.size === 0) {
    return false;
  }

  const currentIdSet = new Set(currentIds);

  for (const id of activeIds) {
    if (!currentIdSet.has(id)) {
      return true;
    }
  }

  return false;
}

export function prepareTimestampedRow<
  T extends { createdAt: string; updatedAt: string }
>(existingRow: T | null, nextRow: T, comparisonKeys: string[]) {
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

export function prepareLessonContentRow<
  T extends {
    astJson?: string | null;
    excerpt?: string | null;
    htmlRendered: string;
    lessonId: string;
    markdownRaw: string;
    lastImportId: string;
  }
>(existingRow: T | null, nextRow: T) {
  if (
    !existingRow ||
    !rowsMatch(existingRow, nextRow, lessonContentComparisonKeys)
  ) {
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
    return (
      serializeComparableValue(existingRow[key]) ===
      serializeComparableValue(nextRow[key])
    );
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

import type { EntryType } from "../../../domain/content.ts";

import type { NormalizedMediaBundle } from "../types.ts";
import {
  buildDeterministicId,
  buildLessonExcerpt,
  collectReferenceKeysFromBlocks,
  collectReferenceKeysFromRichText,
  humanizeSegmentSlug,
  inferTermAliasType,
  normalizeGrammarSearchText,
  normalizeSearchText,
  normalizeSourceFile,
  renderLessonHtml,
  resolveEntrySegmentRef
} from "./render.ts";
import type {
  CardImportPlan,
  GrammarImportPlan,
  ImportSourceDocument,
  LessonContentImportPlan,
  LessonImportPlan,
  MediaImportPlan,
  MediaRowPlan,
  TermImportPlan
} from "./types.ts";

export function buildMediaImportPlan(input: {
  bundle: NormalizedMediaBundle;
  contentRoot: string;
  nowIso: string;
}): MediaImportPlan {
  const mediaDocument = input.bundle.media;

  if (!mediaDocument) {
    throw new Error(
      `Cannot build an import plan for '${input.bundle.mediaSlug}' without media.md.`
    );
  }

  const segmentRows = buildSegmentRows(input.bundle);
  const segmentIdByRef = new Map(
    segmentRows.map((row) => [row.slug, row.id])
  );
  const mediaRow = buildMediaRow({
    bundle: input.bundle,
    contentRoot: input.contentRoot,
    nowIso: input.nowIso
  });
  const lessonPlans = input.bundle.lessons.map((lesson) =>
    buildLessonPlan({
      contentRoot: input.contentRoot,
      lesson,
      mediaId: mediaDocument.frontmatter.id,
      nowIso: input.nowIso,
      segmentIdByRef
    })
  );
  const lessonContentPlans = lessonPlans.map((plan) => plan.content);
  const lessonRows = lessonPlans.map((plan) => plan.lesson);
  const termPlans = input.bundle.terms.map((term) =>
    buildTermPlan({
      contentRoot: input.contentRoot,
      mediaId: mediaDocument.frontmatter.id,
      nowIso: input.nowIso,
      segmentIdByRef,
      term
    })
  );
  const grammarPlans = input.bundle.grammarPatterns.map((grammarPattern) =>
    buildGrammarPlan({
      contentRoot: input.contentRoot,
      grammarPattern,
      mediaId: mediaDocument.frontmatter.id,
      nowIso: input.nowIso,
      segmentIdByRef
    })
  );
  const cardPlans = buildCardPlans({
    cards: input.bundle.cards,
    contentRoot: input.contentRoot,
    mediaId: mediaDocument.frontmatter.id,
    nowIso: input.nowIso,
    segmentIdByRef
  });
  const entryLinks = [
    ...lessonPlans.flatMap((plan) => plan.entryLinks),
    ...cardPlans.flatMap((plan) => plan.entryLinks)
  ];
  const sourceDocuments = buildSourceDocumentList({
    cards: cardPlans,
    grammarPatterns: grammarPlans,
    lessons: lessonRows,
    media: mediaRow,
    terms: termPlans
  });

  return {
    cards: cardPlans,
    entryLinks,
    grammarPatterns: grammarPlans,
    lessonContents: lessonContentPlans,
    lessons: lessonRows,
    media: mediaRow,
    segments: segmentRows,
    sourceDocuments,
    terms: termPlans
  };
}

function buildMediaRow(input: {
  bundle: NormalizedMediaBundle;
  contentRoot: string;
  nowIso: string;
}): MediaRowPlan {
  const mediaDocument = input.bundle.media;

  if (!mediaDocument) {
    throw new Error("Media document is required.");
  }

  const description =
    mediaDocument.frontmatter.description ??
    buildLessonExcerpt(mediaDocument.body, 320) ??
    null;

  return {
    row: {
      id: mediaDocument.frontmatter.id,
      slug: mediaDocument.frontmatter.slug,
      title: mediaDocument.frontmatter.title,
      mediaType: mediaDocument.frontmatter.mediaType,
      segmentKind: mediaDocument.frontmatter.segmentKind,
      language: mediaDocument.frontmatter.language,
      baseExplanationLanguage: mediaDocument.frontmatter.baseExplanationLanguage,
      description,
      status: (mediaDocument.frontmatter.status ?? "active") as
        | "active"
        | "archived",
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    },
    sourceFile: normalizeSourceFile(input.contentRoot, mediaDocument.sourceFile)
  };
}

function buildSegmentRows(bundle: NormalizedMediaBundle) {
  const mediaDocument = bundle.media;

  if (!mediaDocument) {
    return [];
  }

  const registry = new Map<
    string,
    {
      orderIndex: number;
      slug: string;
      title: string;
    }
  >();

  const register = (segmentRef: string | undefined, orderIndex: number) => {
    if (!segmentRef) {
      return;
    }

    const existing = registry.get(segmentRef);

    if (existing) {
      existing.orderIndex = Math.min(existing.orderIndex, orderIndex);
      return;
    }

    registry.set(segmentRef, {
      orderIndex,
      slug: segmentRef,
      title: humanizeSegmentSlug(segmentRef)
    });
  };

  for (const lesson of bundle.lessons) {
    register(lesson.frontmatter.segmentRef, lesson.frontmatter.order);
  }

  for (const term of bundle.terms) {
    register(
      resolveEntrySegmentRef({
        segmentRef: term.segmentRef,
        sourceSegmentRef: term.source.segmentRef
      }),
      term.source.documentOrder ?? Number.MAX_SAFE_INTEGER
    );
  }

  for (const grammarPattern of bundle.grammarPatterns) {
    register(
      resolveEntrySegmentRef({
        segmentRef: grammarPattern.segmentRef,
        sourceSegmentRef: grammarPattern.source.segmentRef
      }),
      grammarPattern.source.documentOrder ?? Number.MAX_SAFE_INTEGER
    );
  }

  for (const card of bundle.cards) {
    register(card.source.segmentRef, card.source.documentOrder ?? Number.MAX_SAFE_INTEGER);
  }

  return [...registry.values()]
    .sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return left.slug.localeCompare(right.slug);
    })
    .map((segmentData, index) => ({
      id: buildDeterministicId(
        "segment",
        mediaDocument.frontmatter.id,
        segmentData.slug
      ),
      mediaId: mediaDocument.frontmatter.id,
      slug: segmentData.slug,
      title: segmentData.title,
      orderIndex: index + 1,
      segmentType: mediaDocument.frontmatter.segmentKind,
      notes: null
    }));
}

function buildLessonPlan(input: {
  contentRoot: string;
  lesson: NormalizedMediaBundle["lessons"][number];
  mediaId: string;
  nowIso: string;
  segmentIdByRef: Map<string, string>;
}) {
  const sourceFile = normalizeSourceFile(input.contentRoot, input.lesson.sourceFile);
  const segmentId =
    (input.lesson.frontmatter.segmentRef
      ? input.segmentIdByRef.get(input.lesson.frontmatter.segmentRef)
      : undefined) ?? null;
  const entryLinks = buildLessonEntryLinks(input.lesson.frontmatter.id, input.lesson.body);
  const htmlRendered = renderLessonHtml(input.lesson.body);
  const astJson = JSON.stringify(input.lesson.body);
  const excerpt = buildLessonExcerpt(input.lesson.body);
  const lesson: LessonImportPlan = {
    row: {
      id: input.lesson.frontmatter.id,
      mediaId: input.mediaId,
      segmentId,
      slug: input.lesson.frontmatter.slug,
      title: input.lesson.frontmatter.title,
      orderIndex: input.lesson.frontmatter.order,
      difficulty: input.lesson.frontmatter.difficulty ?? null,
      summary: input.lesson.frontmatter.summary ?? excerpt,
      status: (input.lesson.frontmatter.status ?? "active") as
        | "active"
        | "archived",
      sourceFile,
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    },
    sourceFile
  };
  const content: LessonContentImportPlan = {
    row: {
      lessonId: input.lesson.frontmatter.id,
      markdownRaw: input.lesson.body.raw,
      htmlRendered,
      astJson,
      excerpt,
      lastImportId: ""
    },
    sourceFile
  };

  return {
    content,
    entryLinks,
    lesson
  };
}

function buildTermPlan(input: {
  contentRoot: string;
  mediaId: string;
  nowIso: string;
  segmentIdByRef: Map<string, string>;
  term: NormalizedMediaBundle["terms"][number];
}): TermImportPlan {
  const sourceFile = normalizeSourceFile(input.contentRoot, input.term.source.filePath);
  const searchReadingNorm = normalizeSearchText(input.term.reading);
  const searchRomajiNorm = normalizeSearchText(input.term.romaji);
  const aliases = dedupeStrings(input.term.aliases).map((aliasText) => {
    const aliasNorm = normalizeSearchText(aliasText);
    const aliasType = inferTermAliasType(
      aliasText,
      searchReadingNorm,
      searchRomajiNorm
    );

    return {
      id: buildDeterministicId(
        "term_alias",
        input.term.id,
        aliasType,
        aliasNorm
      ),
      termId: input.term.id,
      aliasText,
      aliasNorm,
      aliasType
    };
  });
  const segmentRef = resolveEntrySegmentRef({
    segmentRef: input.term.segmentRef,
    sourceSegmentRef: input.term.source.segmentRef
  });

  return {
    aliases,
    row: {
      id: input.term.id,
      mediaId: input.mediaId,
      segmentId: segmentRef ? input.segmentIdByRef.get(segmentRef) ?? null : null,
      lemma: input.term.lemma,
      reading: input.term.reading,
      romaji: input.term.romaji,
      pos: input.term.pos ?? null,
      meaningIt: input.term.meaningIt,
      meaningLiteralIt: input.term.meaningLiteralIt ?? null,
      notesIt: input.term.notesIt?.raw ?? null,
      levelHint: input.term.levelHint ?? null,
      searchLemmaNorm: normalizeSearchText(input.term.lemma),
      searchReadingNorm,
      searchRomajiNorm,
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    },
    sourceFile
  };
}

function buildGrammarPlan(input: {
  contentRoot: string;
  grammarPattern: NormalizedMediaBundle["grammarPatterns"][number];
  mediaId: string;
  nowIso: string;
  segmentIdByRef: Map<string, string>;
}): GrammarImportPlan {
  const sourceFile = normalizeSourceFile(
    input.contentRoot,
    input.grammarPattern.source.filePath
  );
  const aliases = dedupeStrings(input.grammarPattern.aliases).map((aliasText) => {
    const aliasNorm = normalizeGrammarSearchText(aliasText);

    return {
      id: buildDeterministicId(
        "grammar_alias",
        input.grammarPattern.id,
        aliasNorm
      ),
      grammarId: input.grammarPattern.id,
      aliasText,
      aliasNorm
    };
  });
  const segmentRef = resolveEntrySegmentRef({
    segmentRef: input.grammarPattern.segmentRef,
    sourceSegmentRef: input.grammarPattern.source.segmentRef
  });

  return {
    aliases,
    row: {
      id: input.grammarPattern.id,
      mediaId: input.mediaId,
      segmentId: segmentRef ? input.segmentIdByRef.get(segmentRef) ?? null : null,
      pattern: input.grammarPattern.pattern,
      title: input.grammarPattern.title,
      reading: input.grammarPattern.reading ?? null,
      meaningIt: input.grammarPattern.meaningIt,
      notesIt: input.grammarPattern.notesIt?.raw ?? null,
      levelHint: input.grammarPattern.levelHint ?? null,
      searchPatternNorm: normalizeGrammarSearchText(input.grammarPattern.pattern),
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    },
    sourceFile
  };
}

function buildCardPlans(input: {
  cards: NormalizedMediaBundle["cards"];
  contentRoot: string;
  mediaId: string;
  nowIso: string;
  segmentIdByRef: Map<string, string>;
}) {
  return [...input.cards]
    .sort((left, right) => {
      const leftOrder = left.source.documentOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.source.documentOrder ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      if (left.source.filePath !== right.source.filePath) {
        return left.source.filePath.localeCompare(right.source.filePath);
      }

      return left.source.sequence - right.source.sequence;
    })
    .map((card, index) => {
      const sourceFile = normalizeSourceFile(input.contentRoot, card.source.filePath);
      const segmentId = card.source.segmentRef
        ? input.segmentIdByRef.get(card.source.segmentRef) ?? null
        : null;
      const primaryEntryLink = buildEntryLinkRow({
        entryId: card.entryId,
        entryType: card.entryType,
        linkRole: "reviewed",
        sortOrder: 1,
        sourceId: card.id,
        sourceType: "card"
      });
      const contextualReferences = collectReferenceKeysFromCard(card);
      const contextualEntryLinks = contextualReferences.map((reference, referenceIndex) =>
        buildEntryLinkRow({
          entryId: reference.entryId,
          entryType: reference.entryType,
          linkRole: "mentioned",
          sortOrder: referenceIndex + 2,
          sourceId: card.id,
          sourceType: "card"
        })
      );
      const cardEntryLinks = [
        buildCardEntryLinkRow({
          cardId: card.id,
          entryId: card.entryId,
          entryType: card.entryType,
          relationshipType: "primary"
        }),
        ...contextualReferences
          .filter(
            (reference) =>
              !(
                reference.entryId === card.entryId &&
                reference.entryType === card.entryType
              )
          )
          .map((reference) =>
            buildCardEntryLinkRow({
              cardId: card.id,
              entryId: reference.entryId,
              entryType: reference.entryType,
              relationshipType: "context"
            })
          )
      ];

      return {
        entryLinks: dedupeById([primaryEntryLink, ...contextualEntryLinks]),
        row: {
          id: card.id,
          mediaId: input.mediaId,
          segmentId,
          sourceFile,
          cardType: card.cardType,
          front: card.front.raw,
          back: card.back.raw,
          exampleJp: card.exampleJp?.raw ?? null,
          exampleIt: card.exampleIt?.raw ?? null,
          notesIt: card.notesIt?.raw ?? null,
          status: "active",
          orderIndex: index + 1,
          createdAt: input.nowIso,
          updatedAt: input.nowIso
        },
        sourceFile,
        sourceFileId: card.source.documentId ?? sourceFile,
        termLinks: dedupeById(cardEntryLinks)
      } satisfies CardImportPlan;
    });
}

function buildLessonEntryLinks(lessonId: string, body: NormalizedMediaBundle["lessons"][number]["body"]) {
  const definitionLinks = body.blocks.flatMap((block, index) => {
    if (block.type === "termDefinition") {
      return [
        buildEntryLinkRow({
          entryId: block.entry.id,
          entryType: "term",
          linkRole: "introduced",
          sortOrder: index + 1,
          sourceId: lessonId,
          sourceType: "lesson"
        })
      ];
    }

    if (block.type === "grammarDefinition") {
      return [
        buildEntryLinkRow({
          entryId: block.entry.id,
          entryType: "grammar",
          linkRole: "explained",
          sortOrder: index + 1,
          sourceId: lessonId,
          sourceType: "lesson"
        })
      ];
    }

    return [];
  });
  const referenceLinks = collectReferenceKeysFromBlocks(body.blocks).map(
    (reference, referenceIndex) =>
      buildEntryLinkRow({
        entryId: reference.entryId,
        entryType: reference.entryType,
        linkRole: "mentioned",
        sortOrder: definitionLinks.length + referenceIndex + 1,
        sourceId: lessonId,
        sourceType: "lesson"
      })
  );

  return dedupeById([...definitionLinks, ...referenceLinks]);
}

function collectReferenceKeysFromCard(card: NormalizedMediaBundle["cards"][number]) {
  return dedupeReferenceEntries([
    ...collectReferenceKeysFromRichText(card.front),
    ...collectReferenceKeysFromRichText(card.back),
    ...collectReferenceKeysFromRichText(card.exampleJp),
    ...collectReferenceKeysFromRichText(card.exampleIt),
    ...collectReferenceKeysFromRichText(card.notesIt)
  ]);
}

function buildEntryLinkRow(input: {
  entryId: string;
  entryType: EntryType;
  linkRole: "introduced" | "explained" | "mentioned" | "reviewed";
  sortOrder: number;
  sourceId: string;
  sourceType: "lesson" | "card";
}) {
  return {
    id: buildDeterministicId(
      "entry_link",
      input.entryType,
      input.entryId,
      input.sourceType,
      input.sourceId,
      input.linkRole
    ),
    entryType: input.entryType,
    entryId: input.entryId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    linkRole: input.linkRole,
    sortOrder: input.sortOrder
  };
}

function buildCardEntryLinkRow(input: {
  cardId: string;
  entryId: string;
  entryType: EntryType;
  relationshipType: "primary" | "secondary" | "context";
}) {
  return {
    id: buildDeterministicId(
      "card_entry_link",
      input.cardId,
      input.entryType,
      input.entryId,
      input.relationshipType
    ),
    cardId: input.cardId,
    entryType: input.entryType,
    entryId: input.entryId,
    relationshipType: input.relationshipType
  };
}

function buildSourceDocumentList(input: {
  cards: CardImportPlan[];
  grammarPatterns: GrammarImportPlan[];
  lessons: LessonImportPlan[];
  media: MediaRowPlan;
  terms: TermImportPlan[];
}) {
  const registry = new Map<string, ImportSourceDocument>();

  const ensureDocument = (
    sourceFile: string,
    kind: ImportSourceDocument["kind"]
  ) => {
    const key = `${kind}:${sourceFile}`;
    const existing = registry.get(key);

    if (existing) {
      return existing;
    }

    const document: ImportSourceDocument = {
      entityIds: {
        cards: [],
        grammarPatterns: [],
        lessons: [],
        terms: []
      },
      kind,
      sourceFile
    };
    registry.set(key, document);
    return document;
  };

  ensureDocument(input.media.sourceFile, "media");

  for (const lesson of input.lessons) {
    ensureDocument(lesson.sourceFile, "lesson").entityIds.lessons.push(lesson.row.id);
  }

  for (const term of input.terms) {
    const kind = term.sourceFile.includes("/cards/") ? "cards" : "lesson";
    ensureDocument(term.sourceFile, kind).entityIds.terms.push(term.row.id);
  }

  for (const grammarPattern of input.grammarPatterns) {
    const kind = grammarPattern.sourceFile.includes("/cards/") ? "cards" : "lesson";
    ensureDocument(grammarPattern.sourceFile, kind).entityIds.grammarPatterns.push(
      grammarPattern.row.id
    );
  }

  for (const card of input.cards) {
    ensureDocument(card.sourceFile, "cards").entityIds.cards.push(card.row.id);
  }

  return [...registry.values()].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }

    return left.sourceFile.localeCompare(right.sourceFile);
  });
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function dedupeReferenceEntries(
  values: Array<{ entryId: string; entryType: EntryType }>
) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.entryType}:${value.entryId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeById<T extends { id: string }>(values: T[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    if (seen.has(value.id)) {
      return false;
    }

    seen.add(value.id);
    return true;
  });
}

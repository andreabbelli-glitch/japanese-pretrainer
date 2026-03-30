import type {
  CrossMediaSibling,
  CrossMediaGroupRecord,
  EntryCardConnection,
  EntryLessonConnection,
  GrammarGlossaryEntry,
  GrammarGlossaryEntrySummary,
  TermGlossaryEntry,
  TermGlossaryEntrySummary
} from "@/db";
import {
  aggregateGlossaryLessonConnections,
  formatGlossaryEntryLinkRole,
  formatGlossaryShortDate,
  groupAliasesForGlossaryDetail,
  mapGlossaryCrossMediaSibling,
  pickPrimaryGlossaryLesson
} from "@/lib/glossary-detail-helpers";
import {
  mediaGlossaryHref,
  mediaReviewCardHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatMediaTypeLabel,
  formatReviewStateLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
import {
  compactLatinSearchText,
  foldJapaneseKana,
  normalizeGrammarSearchText,
  normalizeSearchText,
  romanizeKanaForSearch
} from "@/lib/study-search";
import {
  buildPronunciationData
} from "@/lib/pronunciation";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import type {
  GlossaryBaseEntry,
  GlossaryDetailData,
  GlossaryKind,
  GlossaryMediaSummary,
  RankedGlossaryEntry
} from "@/lib/glossary";

export function mapEntryToBaseModel(
  entry: TermGlossaryEntry,
  kind: "term"
): GlossaryBaseEntry;
export function mapEntryToBaseModel(
  entry: GrammarGlossaryEntry,
  kind: "grammar"
): GlossaryBaseEntry;
export function mapEntryToBaseModel(
  entry: TermGlossaryEntry | GrammarGlossaryEntry,
  kind: GlossaryKind
): GlossaryBaseEntry {
  if (kind === "term") {
    const termEntry = entry as TermGlossaryEntry;

    return {
      internalId: termEntry.id,
      id: termEntry.sourceId,
      kind,
      crossMediaGroupId: termEntry.crossMediaGroupId ?? undefined,
      crossMediaGroupKey: termEntry.crossMediaGroup?.groupKey ?? undefined,
      label: termEntry.lemma,
      mediaId: termEntry.mediaId,
      mediaSlug: termEntry.media.slug,
      mediaTitle: termEntry.media.title,
      reading: termEntry.reading,
      romaji: termEntry.romaji,
      pronunciation:
        buildPronunciationData(termEntry.media.slug, {
          ...termEntry,
          reading: termEntry.reading
        }) ?? undefined,
      meaning: termEntry.meaningIt,
      literalMeaning: termEntry.meaningLiteralIt ?? undefined,
      notes: termEntry.notesIt ?? undefined,
      pos: termEntry.pos ?? undefined,
      levelHint: termEntry.levelHint ?? undefined,
      segmentId: termEntry.segmentId,
      segmentTitle: termEntry.segment?.title ?? undefined,
      aliases: termEntry.aliases.map((alias) => ({
        kana: foldJapaneseKana(alias.aliasNorm),
        text: alias.aliasText,
        normalized: alias.aliasNorm,
        type: alias.aliasType
      })),
      lemmaNorm: termEntry.searchLemmaNorm,
      readingNorm: termEntry.searchReadingNorm,
      romajiNorm: termEntry.searchRomajiNorm,
      romajiCompact: termEntry.searchRomajiNorm
        ? compactLatinSearchText(termEntry.searchRomajiNorm)
        : undefined,
      meaningNorm: normalizeSearchText(termEntry.meaningIt),
      literalMeaningNorm: termEntry.meaningLiteralIt
        ? normalizeSearchText(termEntry.meaningLiteralIt)
        : undefined,
      notesNorm: termEntry.notesIt
        ? normalizeSearchText(stripInlineMarkdown(termEntry.notesIt))
        : undefined
    };
  }

  const grammarEntry = entry as GrammarGlossaryEntry;

  return {
    internalId: grammarEntry.id,
    id: grammarEntry.sourceId,
    kind,
    crossMediaGroupId: grammarEntry.crossMediaGroupId ?? undefined,
    crossMediaGroupKey: grammarEntry.crossMediaGroup?.groupKey ?? undefined,
    label: grammarEntry.pattern,
    mediaId: grammarEntry.mediaId,
    mediaSlug: grammarEntry.media.slug,
    mediaTitle: grammarEntry.media.title,
    title: grammarEntry.title,
    reading: grammarEntry.reading ?? undefined,
    pronunciation:
      buildPronunciationData(grammarEntry.media.slug, {
        ...grammarEntry,
        reading: grammarEntry.reading ?? grammarEntry.pattern
      }) ?? undefined,
    meaning: grammarEntry.meaningIt,
    notes: grammarEntry.notesIt ?? undefined,
    levelHint: grammarEntry.levelHint ?? undefined,
    segmentId: grammarEntry.segmentId,
    segmentTitle: grammarEntry.segment?.title ?? undefined,
    aliases: grammarEntry.aliases.map((alias) => ({
      kana: foldJapaneseKana(normalizeGrammarSearchText(alias.aliasText)),
      romajiCompact: romanizeKanaForSearch(alias.aliasNorm),
      text: alias.aliasText,
      normalized: alias.aliasNorm
    })),
    lemmaNorm: grammarEntry.searchPatternNorm,
    romajiNorm: grammarEntry.searchRomajiNorm,
    romajiCompact: grammarEntry.searchRomajiNorm,
    patternNorm: grammarEntry.searchPatternNorm,
    patternKana: foldJapaneseKana(grammarEntry.searchPatternNorm),
    meaningNorm: normalizeSearchText(grammarEntry.meaningIt),
    titleNorm: normalizeSearchText(grammarEntry.title),
    notesNorm: grammarEntry.notesIt
      ? normalizeSearchText(stripInlineMarkdown(grammarEntry.notesIt))
      : undefined
  };
}

export function mapTermSummaryToBaseModel(
  entry: TermGlossaryEntrySummary
): GlossaryBaseEntry {
  return {
    internalId: entry.id,
    id: entry.sourceId,
    kind: "term",
    crossMediaGroupId: entry.crossMediaGroupId ?? undefined,
    crossMediaGroupKey: entry.crossMediaGroupKey ?? undefined,
    label: entry.lemma,
    mediaId: entry.mediaId,
    mediaSlug: entry.mediaSlug,
    mediaTitle: entry.mediaTitle,
    reading: entry.reading,
    romaji: entry.romaji,
    pronunciation:
      buildPronunciationData(entry.mediaSlug, {
        ...entry,
        reading: entry.reading
      }) ?? undefined,
    meaning: entry.meaningIt,
    levelHint: entry.levelHint ?? undefined,
    segmentId: entry.segmentId,
    segmentTitle: entry.segmentTitle ?? undefined,
    aliases: [],
    lemmaNorm: entry.searchLemmaNorm,
    readingNorm: entry.searchReadingNorm,
    romajiNorm: entry.searchRomajiNorm,
    romajiCompact: entry.searchRomajiNorm
      ? compactLatinSearchText(entry.searchRomajiNorm)
      : undefined,
    meaningNorm: normalizeSearchText(entry.meaningIt)
  };
}

export function mapGrammarSummaryToBaseModel(
  entry: GrammarGlossaryEntrySummary
): GlossaryBaseEntry {
  return {
    internalId: entry.id,
    id: entry.sourceId,
    kind: "grammar",
    crossMediaGroupId: entry.crossMediaGroupId ?? undefined,
    crossMediaGroupKey: entry.crossMediaGroupKey ?? undefined,
    label: entry.pattern,
    mediaId: entry.mediaId,
    mediaSlug: entry.mediaSlug,
    mediaTitle: entry.mediaTitle,
    title: entry.title,
    reading: entry.reading ?? undefined,
    pronunciation:
      buildPronunciationData(entry.mediaSlug, {
        ...entry,
        reading: entry.reading ?? entry.pattern
      }) ?? undefined,
    meaning: entry.meaningIt,
    levelHint: entry.levelHint ?? undefined,
    segmentId: entry.segmentId,
    segmentTitle: entry.segmentTitle ?? undefined,
    aliases: [],
    lemmaNorm: entry.searchPatternNorm,
    romajiNorm: entry.searchRomajiNorm,
    romajiCompact: entry.searchRomajiNorm,
    patternNorm: entry.searchPatternNorm,
    patternKana: foldJapaneseKana(entry.searchPatternNorm),
    meaningNorm: normalizeSearchText(entry.meaningIt),
    titleNorm: normalizeSearchText(entry.title)
  };
}

export function buildGlossaryMediaSummary(
  media: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    mediaType: string;
    segmentKind: string;
  }
): GlossaryMediaSummary {
  return {
    id: media.id,
    slug: media.slug,
    title: media.title,
    description:
      media.description ??
      `${media.title} usa il glossary come strumento di lookup rapido dentro il percorso di studio.`,
    glossaryHref: mediaGlossaryHref(media.slug),
    mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
    segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
    textbookHref: mediaStudyHref(media.slug, "textbook")
  };
}

export function buildGlossaryDetailData(input: {
  cardConnections: EntryCardConnection[];
  crossMediaFamily: {
    group: CrossMediaGroupRecord | null;
    siblings: CrossMediaSibling[];
  };
  entry: RankedGlossaryEntry;
  lessonConnections: EntryLessonConnection[];
  media: GlossaryMediaSummary;
}): GlossaryDetailData {
  const lessons = aggregateGlossaryLessonConnections(input.lessonConnections);
  const primaryLesson = pickPrimaryGlossaryLesson(lessons, input.media.slug);
  const forceKnownReviewLabel = input.entry.studyState.hasKnownSignal;

  return {
    entry: {
      ...input.entry,
      aliasGroups: groupAliasesForGlossaryDetail(input.entry.aliases)
    },
    lessons: lessons.map((lesson) => ({
      href: mediaTextbookLessonHref(input.media.slug, lesson.lessonSlug),
      id: lesson.lessonId,
      roleLabels: lesson.linkRoles.map((role) =>
        formatGlossaryEntryLinkRole(role)
      ),
      segmentTitle: lesson.segmentTitle ?? undefined,
      summary: lesson.lessonSummary ?? undefined,
      title: lesson.lessonTitle
    })),
    cards: input.cardConnections.map((row) => ({
      back: row.cardBack,
      dueLabel: row.dueAt
        ? `Scadenza ${formatGlossaryShortDate(row.dueAt)}`
        : undefined,
      front: row.cardFront,
      href: mediaReviewCardHref(input.media.slug, row.cardId),
      id: row.cardId,
      relationshipLabel: formatCardRelationshipLabel(row.relationshipType),
      reviewLabel:
        row.cardStatus === "suspended"
          ? "Sospesa"
          : forceKnownReviewLabel
            ? "Già nota"
            : formatReviewStateLabel(
                row.reviewState,
                row.manualOverride ?? false
              ),
      segmentTitle: row.segmentTitle ?? undefined,
      typeLabel: capitalizeToken(row.cardType),
      notes: row.cardNotesIt ?? undefined
    })),
    crossMedia:
      input.crossMediaFamily.group && input.crossMediaFamily.siblings.length > 0
        ? {
            groupKey: input.crossMediaFamily.group.groupKey,
            siblings: input.crossMediaFamily.siblings.map(
              mapGlossaryCrossMediaSibling
            )
          }
        : null,
    media: input.media,
    related: {
      cardsLabel:
        input.cardConnections.length === 1
          ? "1 card collegata"
          : `${input.cardConnections.length} card collegate`,
      primaryLessonLabel: primaryLesson
        ? `${primaryLesson.roleLabel} in ${primaryLesson.title}`
        : "Nessuna lesson collegata"
    }
  };
}

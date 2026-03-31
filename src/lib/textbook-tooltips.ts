import {
  getCardsByIds,
  getCrossMediaSiblingCounts,
  getGlossaryEntriesByIds,
  listEntryCardConnections,
  listEntryStudySignals,
  type EntryCardConnection,
  type CardListItem,
  type DatabaseClient,
  type GrammarGlossaryEntry,
  type TermGlossaryEntry
} from "@/db";
import { mediaGlossaryEntryHref, mediaReviewCardHref } from "@/lib/site";
import { resolveReviewSubjectGroups } from "@/lib/review-subject-state-lookup";
import { buildPronunciationData } from "@/lib/pronunciation";
import { buildEntryKey } from "@/lib/entry-id";
import { deriveInlineReading, stripInlineMarkdown } from "@/lib/inline-markdown";
import { deriveEntryStudyState } from "@/lib/study-entry";
import type {
  TextbookCardTooltip,
  TextbookEntryTooltip,
  TextbookTooltipEntry
} from "@/lib/textbook";

type StudySignalRow = Awaited<ReturnType<typeof listEntryStudySignals>>[number];

export async function loadLessonTooltipEntries(input: {
  database: DatabaseClient;
  lessonEntryLinks: Awaited<
    ReturnType<typeof import("@/db").listLessonEntryLinks>
  >;
  imageCardIds: string[];
  mediaSlug: string;
}): Promise<TextbookTooltipEntry[]> {
  const uniqueLessonEntryLinks = dedupeLessonEntryLinks(input.lessonEntryLinks);
  const termIds: string[] = [];
  const grammarIds: string[] = [];
  const studySignalEntries: Array<{
    entryId: string;
    entryType: "term" | "grammar";
  }> = [];

  for (const entry of uniqueLessonEntryLinks) {
    studySignalEntries.push({
      entryId: entry.entryId,
      entryType: entry.entryType
    });

    if (entry.entryType === "term") {
      termIds.push(entry.entryId);
      continue;
    }

    grammarIds.push(entry.entryId);
  }

  // Launch cross-media counts in parallel with glossary/study queries.
  // They only need the IDs we already have — no need to wait for the
  // full glossary rows first.
  const [
    terms,
    grammar,
    studySignals,
    cardConnections,
    cards,
    termCrossMediaCounts,
    grammarCrossMediaCounts
  ] = await Promise.all([
    getGlossaryEntriesByIds(input.database, "term", termIds),
    getGlossaryEntriesByIds(input.database, "grammar", grammarIds),
    listEntryStudySignals(input.database, studySignalEntries),
    listEntryCardConnections(input.database, studySignalEntries),
    getCardsByIds(input.database, input.imageCardIds),
    getCrossMediaSiblingCounts(input.database, "term", termIds),
    getCrossMediaSiblingCounts(input.database, "grammar", grammarIds)
  ]);
  const termMap = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarMap = new Map(grammar.map((entry) => [entry.id, entry]));
  const grammarCardFrontByEntryId = buildGrammarCardFrontMap(cardConnections);
  const studySignalsByEntry = buildStudySignalMap(studySignals);
  const subjectLookup =
    cards.length > 0
      ? await resolveReviewSubjectGroups({
          cards,
          database: input.database,
          grammar,
          terms
        })
      : { subjectGroups: [] };
  const subjectStateByCardId = new Map(
    subjectLookup.subjectGroups.flatMap((group) =>
      group.cards.map((card) => [card.id, group.subjectState] as const)
    )
  );

  const baseEntries = uniqueLessonEntryLinks.flatMap((link) => {
    if (link.entryType === "term") {
      const entry = termMap.get(link.entryId);

      if (!entry) {
        return [];
      }

      return [
        mapTooltipEntry({
          crossMediaSiblingCount: termCrossMediaCounts.get(entry.id) ?? 0,
          entry,
          kind: "term",
          mediaSlug: input.mediaSlug,
          studySignals:
            studySignalsByEntry.get(buildEntryKey("term", entry.id)) ?? []
        })
      ];
    }

    const entry = grammarMap.get(link.entryId);

    if (!entry) {
      return [];
    }

    return [
      mapTooltipEntry({
        crossMediaSiblingCount: grammarCrossMediaCounts.get(entry.id) ?? 0,
        entry,
        grammarCardFront: grammarCardFrontByEntryId.get(entry.id),
        kind: "grammar",
        mediaSlug: input.mediaSlug,
        studySignals:
          studySignalsByEntry.get(buildEntryKey("grammar", entry.id)) ?? []
      })
    ];
  });

  const cardEntries = cards.map((card) =>
    mapCardTooltipEntry(
      card,
      input.mediaSlug,
      subjectStateByCardId.get(card.id) ?? null
    )
  );

  return [...baseEntries, ...cardEntries];
}

function dedupeLessonEntryLinks(
  links: Awaited<ReturnType<typeof import("@/db").listLessonEntryLinks>>
) {
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = buildEntryKey(link.entryType, link.entryId);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildStudySignalMap(rows: StudySignalRow[]) {
  const map = new Map<string, StudySignalRow[]>();

  for (const row of rows) {
    const key = buildEntryKey(row.entryType, row.entryId);
    const existing = map.get(key);

    if (existing) {
      existing.push(row);
      continue;
    }

    map.set(key, [row]);
  }

  return map;
}

function mapTooltipEntry(input: {
  crossMediaSiblingCount: number;
  entry: GrammarGlossaryEntry | TermGlossaryEntry;
  grammarCardFront?: string;
  kind: "grammar" | "term";
  mediaSlug: string;
  studySignals: StudySignalRow[];
}): TextbookEntryTooltip {
  const baseEntry = {
    id: input.entry.sourceId,
    crossMediaHint:
      input.crossMediaSiblingCount > 0
        ? {
            otherMediaCount: input.crossMediaSiblingCount
          }
        : undefined,
    kind: input.kind,
    meaning: input.entry.meaningIt,
    notes: input.entry.notesIt ?? undefined,
    levelHint: input.entry.levelHint ?? undefined,
    statusLabel: resolveEntryStudyStateLabel(input.studySignals),
    segmentTitle: input.entry.segment?.title ?? undefined,
    glossaryHref: mediaGlossaryEntryHref(
      input.mediaSlug,
      input.kind,
      input.entry.sourceId
    )
  };

  if (input.kind === "term") {
    const entry = input.entry as TermGlossaryEntry;

    return {
      ...baseEntry,
      label: entry.lemma,
      reading: entry.reading,
      romaji: entry.romaji,
      literalMeaning: entry.meaningLiteralIt ?? undefined,
      pos: entry.pos ?? undefined,
      pronunciation:
        buildPronunciationData(input.mediaSlug, {
          ...entry,
          reading: entry.reading
        }) ?? undefined
    };
  }

  const entry = input.entry as GrammarGlossaryEntry;
  const useGrammarCardFront =
    typeof input.grammarCardFront === "string" &&
    stripInlineMarkdown(input.grammarCardFront) === entry.pattern;
  const label = useGrammarCardFront ? input.grammarCardFront! : entry.pattern;
  const reading =
    entry.reading ??
    (useGrammarCardFront
      ? deriveInlineReading(input.grammarCardFront!)
      : undefined);

  return {
    ...baseEntry,
    label,
    title: entry.title,
    reading,
    pronunciation:
      buildPronunciationData(input.mediaSlug, {
        ...entry,
        reading: reading ?? entry.pattern
      }) ?? undefined
  };
}

function buildGrammarCardFrontMap(cardConnections: EntryCardConnection[]) {
  const map = new Map<string, string>();

  for (const card of cardConnections) {
    if (
      card.entryType !== "grammar" ||
      card.cardType !== "concept" ||
      card.relationshipType !== "primary" ||
      map.has(card.entryId)
    ) {
      continue;
    }

    map.set(card.entryId, card.cardFront);
  }

  return map;
}

function mapCardTooltipEntry(
  card: CardListItem,
  mediaSlug: string,
  subjectState: {
    manualOverride: boolean;
    state: string;
    suspended: boolean;
  } | null
): TextbookCardTooltip {
  return {
    id: card.id,
    kind: "card",
    label: card.front,
    reading: undefined,
    meaning: card.back,
    notes: card.notesIt ?? undefined,
    typeLabel: card.cardType,
    statusLabel:
      card.status === "suspended" || subjectState?.suspended
        ? "Sospesa"
        : subjectState?.state === "known_manual" || subjectState?.manualOverride
          ? "Nota"
          : subjectState?.state
            ? "In review"
            : "Disponibile",
    segmentTitle: card.segment?.title ?? undefined,
    reviewHref: mediaReviewCardHref(mediaSlug, card.id)
  };
}

function resolveEntryStudyStateLabel(studySignals: StudySignalRow[]) {
  return deriveEntryStudyState(studySignals).label;
}

import {
  getCrossMediaSiblingCounts,
  getGlossaryEntriesByIds,
  listEntryCardConnections,
  listEntryStudySignals,
  type EntryCardConnection,
  type DatabaseClient,
  type GrammarGlossaryEntry,
  type TermGlossaryEntry
} from "@/db";
import { mediaGlossaryEntryHref } from "@/lib/site";
import { buildPronunciationData } from "@/lib/pronunciation";
import { buildEntryKey } from "@/lib/entry-id";
import { deriveInlineReading, stripInlineMarkdown } from "@/lib/inline-markdown";
import { deriveEntryStudyState } from "@/lib/study-entry";
import type {
  TextbookEntryTooltip,
  TextbookTooltipEntry
} from "@/lib/textbook-types";

type StudySignalRow = Awaited<ReturnType<typeof listEntryStudySignals>>[number];

export async function loadLessonTooltipEntries(input: {
  database: DatabaseClient;
  lessonEntryLinks: Awaited<
    ReturnType<typeof import("@/db").listLessonEntryLinks>
  >;
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
    termCrossMediaCounts,
    grammarCrossMediaCounts
  ] = await Promise.all([
    getGlossaryEntriesByIds(input.database, "term", termIds),
    getGlossaryEntriesByIds(input.database, "grammar", grammarIds),
    listEntryStudySignals(input.database, studySignalEntries),
    listEntryCardConnections(input.database, studySignalEntries),
    getCrossMediaSiblingCounts(input.database, "term", termIds),
    getCrossMediaSiblingCounts(input.database, "grammar", grammarIds)
  ]);
  const termMap = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarMap = new Map(grammar.map((entry) => [entry.id, entry]));
  const grammarCardFrontByEntryId = buildGrammarCardFrontMap(cardConnections);
  const studySignalsByEntry = buildStudySignalMap(studySignals);

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

  return baseEntries;
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

function resolveEntryStudyStateLabel(studySignals: StudySignalRow[]) {
  return deriveEntryStudyState(studySignals).label;
}

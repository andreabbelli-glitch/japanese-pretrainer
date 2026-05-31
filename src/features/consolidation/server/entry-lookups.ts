import type { DatabaseQueryClient } from "@/db";
import {
  listGrammarEntryReviewSummariesByIds,
  listTermEntryReviewSummariesByIds
} from "@/db/queries";
import type { EntryType } from "@/db/schema";
import { buildReviewSubjectEntryLookup } from "@/features/review/model/subject";
import { buildEntryKey } from "@/features/study/model/entry-id";
import {
  buildPronunciationData,
  type PronunciationData
} from "@/features/pronunciation/model/data";

type ConsolidationLinkedCard = {
  entryLinks: Array<{
    entryId: string;
    entryType: EntryType;
  }>;
};

export type ConsolidationEntrySummary = {
  crossMediaGroupId: string | null;
  entryType: EntryType;
  entryId: string;
  id: string;
  label: string;
  meaning: string;
  pronunciation?: PronunciationData;
  reading: string | null;
};

export async function buildConsolidationEntryLookup(
  database: DatabaseQueryClient,
  cards: ConsolidationLinkedCard[]
) {
  const { grammarIds, termIds } = collectConsolidationLinkedEntryIds(cards);
  const [terms, grammar] = await Promise.all([
    listTermEntryReviewSummariesByIds(database, termIds),
    listGrammarEntryReviewSummariesByIds(database, grammarIds)
  ]);

  return buildReviewSubjectEntryLookup({
    grammar,
    terms
  });
}

function collectConsolidationLinkedEntryIds(cards: ConsolidationLinkedCard[]) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const cardItem of cards) {
    for (const link of cardItem.entryLinks) {
      if (link.entryType === "term") {
        termIds.add(link.entryId);
        continue;
      }

      if (link.entryType === "grammar") {
        grammarIds.add(link.entryId);
      }
    }
  }

  return {
    grammarIds: [...grammarIds],
    termIds: [...termIds]
  };
}

export async function buildConsolidationEntrySummaryLookup(
  database: DatabaseQueryClient,
  cards: ConsolidationLinkedCard[]
) {
  const { grammarIds, termIds } = collectConsolidationLinkedEntryIds(cards);
  const [terms, grammar] = await Promise.all([
    listTermEntryReviewSummariesByIds(database, termIds),
    listGrammarEntryReviewSummariesByIds(database, grammarIds)
  ]);
  const lookup = new Map<string, ConsolidationEntrySummary>();

  for (const entry of terms) {
    lookup.set(buildEntryKey("term", entry.id), {
      crossMediaGroupId: entry.crossMediaGroupId,
      entryType: "term",
      entryId: entry.id,
      id: entry.id,
      label: entry.lemma,
      meaning: entry.meaningIt,
      pronunciation:
        buildPronunciationData(entry.mediaSlug, {
          audioAttribution: entry.audioAttribution,
          audioLicense: entry.audioLicense,
          audioPageUrl: entry.audioPageUrl,
          audioSource: entry.audioSource,
          audioSpeaker: entry.audioSpeaker,
          audioSrc: entry.audioSrc,
          pitchAccent: entry.pitchAccent,
          pitchAccentPageUrl: entry.pitchAccentPageUrl,
          pitchAccentSource: entry.pitchAccentSource,
          reading: entry.reading
        }) ?? undefined,
      reading: entry.reading
    });
  }

  for (const entry of grammar) {
    lookup.set(buildEntryKey("grammar", entry.id), {
      crossMediaGroupId: entry.crossMediaGroupId,
      entryType: "grammar",
      entryId: entry.id,
      id: entry.id,
      label: entry.pattern,
      meaning: entry.meaningIt,
      pronunciation:
        buildPronunciationData(entry.mediaSlug, {
          audioAttribution: entry.audioAttribution,
          audioLicense: entry.audioLicense,
          audioPageUrl: entry.audioPageUrl,
          audioSource: entry.audioSource,
          audioSpeaker: entry.audioSpeaker,
          audioSrc: entry.audioSrc,
          pitchAccent: entry.pitchAccent,
          pitchAccentPageUrl: entry.pitchAccentPageUrl,
          pitchAccentSource: entry.pitchAccentSource,
          reading: entry.reading
        }) ?? undefined,
      reading: entry.reading ?? null
    });
  }

  return lookup;
}

import type { GlossaryKind } from "@/features/glossary/types";

export type GlossaryAudioFields = {
  audioAttribution?: string | null;
  audioLicense?: string | null;
  audioPageUrl?: string | null;
  audioSource?: string | null;
  audioSpeaker?: string | null;
  audioSrc?: string | null;
  audioUpdatedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  pitchAccent?: number | null;
  pitchAccentPageUrl?: string | null;
  pitchAccentSource?: string | null;
};

type GlossaryAliasRecord = {
  aliasNorm: string;
  aliasText: string;
  aliasType?: string | null;
};

type GlossaryCrossMediaGroupRecord = {
  groupKey: string;
};

type GlossaryEntryMediaRecord = {
  slug: string;
  title: string;
};

type GlossaryEntrySegmentRecord = {
  title: string;
};

export type TermGlossaryEntry = GlossaryAudioFields & {
  aliases: GlossaryAliasRecord[];
  crossMediaGroup: GlossaryCrossMediaGroupRecord | null;
  crossMediaGroupId: string | null;
  id: string;
  lemma: string;
  meaningIt: string;
  meaningLiteralIt?: string | null;
  media: GlossaryEntryMediaRecord;
  mediaId: string;
  notesIt?: string | null;
  pos?: string | null;
  reading: string;
  romaji: string;
  searchLemmaNorm: string;
  searchReadingNorm: string;
  searchRomajiNorm: string;
  segment: GlossaryEntrySegmentRecord | null;
  segmentId: string | null;
  sourceId: string;
  levelHint?: string | null;
};

export type GrammarGlossaryEntry = GlossaryAudioFields & {
  aliases: GlossaryAliasRecord[];
  crossMediaGroup: GlossaryCrossMediaGroupRecord | null;
  crossMediaGroupId: string | null;
  id: string;
  meaningIt: string;
  media: GlossaryEntryMediaRecord;
  mediaId: string;
  notesIt?: string | null;
  pattern: string;
  reading?: string | null;
  searchPatternNorm: string;
  searchRomajiNorm: string | null;
  segment: GlossaryEntrySegmentRecord | null;
  segmentId: string | null;
  sourceId: string;
  title: string;
  levelHint?: string | null;
};

export type TermGlossaryEntrySummary = GlossaryAudioFields & {
  crossMediaGroupId: string | null;
  crossMediaGroupKey: string | null;
  id: string;
  lemma: string;
  levelHint?: string | null;
  meaningIt: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  reading: string;
  romaji: string;
  searchLemmaNorm: string;
  searchReadingNorm: string;
  searchRomajiNorm: string;
  segmentId: string | null;
  segmentTitle: string | null;
  sourceId: string;
};

export type GrammarGlossaryEntrySummary = GlossaryAudioFields & {
  crossMediaGroupId: string | null;
  crossMediaGroupKey: string | null;
  id: string;
  levelHint?: string | null;
  meaningIt: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  pattern: string;
  reading: string | null;
  searchPatternNorm: string;
  searchRomajiNorm: string | null;
  segmentId: string | null;
  segmentTitle: string | null;
  sourceId: string;
  title: string;
};

export type GlossaryCrossMediaGroupSummary = {
  groupKey: string;
};

export type GlossaryCardConnectionRow = {
  cardBack: string;
  cardFront: string;
  cardId: string;
  cardNotesIt: string | null;
  cardStatus: string;
  cardType: string;
  dueAt: string | null;
  manualOverride: boolean | null;
  relationshipType: string;
  reviewState: string | null;
  segmentTitle: string | null;
};

export type GlossaryEntryRecord = TermGlossaryEntry | GrammarGlossaryEntry;

export function isTermGlossaryEntry(
  entry: GlossaryEntryRecord,
  kind: GlossaryKind
): entry is TermGlossaryEntry {
  return kind === "term";
}

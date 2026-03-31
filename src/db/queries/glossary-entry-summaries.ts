import { and, asc, eq, inArray, type SQL } from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  crossMediaGroup,
  grammarAlias,
  grammarPattern,
  media,
  segment,
  term,
  termAlias,
  type EntryType
} from "../schema/index.ts";

type ListGlossaryEntriesOptions = {
  mediaId?: string;
  mediaIds?: string[];
};

type TermGlossaryRow = typeof term.$inferSelect & {
  aliases: (typeof termAlias.$inferSelect)[];
  crossMediaGroup: typeof crossMediaGroup.$inferSelect | null;
  media: typeof media.$inferSelect;
  segment: typeof segment.$inferSelect | null;
};

type GrammarGlossaryRow = typeof grammarPattern.$inferSelect & {
  aliases: (typeof grammarAlias.$inferSelect)[];
  crossMediaGroup: typeof crossMediaGroup.$inferSelect | null;
  media: typeof media.$inferSelect;
  segment: typeof segment.$inferSelect | null;
};

type GlossaryRowByKind = {
  grammar: GrammarGlossaryRow;
  term: TermGlossaryRow;
};

type GlossaryQueryLoader<K extends EntryType> = {
  findFirst: (
    where?: SQL<unknown>
  ) => Promise<GlossaryRowByKind[K] | undefined>;
  findMany: (where?: SQL<unknown>) => Promise<GlossaryRowByKind[K][]>;
};

const glossaryEntryRelations = {
  aliases: true,
  crossMediaGroup: true,
  media: true,
  segment: true
} as const;

function buildMediaScopeFilter(
  column: typeof term.mediaId | typeof grammarPattern.mediaId,
  options: ListGlossaryEntriesOptions
) {
  if (options.mediaId) {
    return eq(column, options.mediaId);
  }

  if (options.mediaIds && options.mediaIds.length > 0) {
    return inArray(column, options.mediaIds);
  }

  return undefined;
}

function buildGlossaryMediaScopeFilter(
  kind: EntryType,
  options: ListGlossaryEntriesOptions
) {
  return buildMediaScopeFilter(
    kind === "term" ? term.mediaId : grammarPattern.mediaId,
    options
  );
}

function buildGlossaryIdsFilter(kind: EntryType, entryIds: string[]) {
  return inArray(kind === "term" ? term.id : grammarPattern.id, entryIds);
}

function buildGlossaryCrossMediaGroupFilter(
  kind: EntryType,
  groupIds: string[]
) {
  return inArray(
    kind === "term" ? term.crossMediaGroupId : grammarPattern.crossMediaGroupId,
    groupIds
  );
}

function buildGlossarySourceFilter(
  kind: EntryType,
  mediaId: string,
  sourceId: string
) {
  return and(
    eq(kind === "term" ? term.mediaId : grammarPattern.mediaId, mediaId),
    eq(kind === "term" ? term.sourceId : grammarPattern.sourceId, sourceId)
  );
}

function getGlossaryQueryLoader<K extends EntryType>(
  database: DatabaseQueryClient,
  kind: K
): GlossaryQueryLoader<K>;
function getGlossaryQueryLoader<K extends EntryType>(
  database: DatabaseQueryClient,
  kind: K
) {
  if (kind === "term") {
    return {
      findFirst: (where?: SQL<unknown>) =>
        database.query.term.findFirst({
          where,
          with: glossaryEntryRelations
        }),
      findMany: (where?: SQL<unknown>) =>
        database.query.term.findMany({
          where,
          with: glossaryEntryRelations,
          orderBy: [asc(term.lemma), asc(term.reading)]
        })
    } as unknown as GlossaryQueryLoader<K>;
  }

  return {
    findFirst: (where?: SQL<unknown>) =>
      database.query.grammarPattern.findFirst({
        where,
        with: glossaryEntryRelations
      }),
    findMany: (where?: SQL<unknown>) =>
      database.query.grammarPattern.findMany({
        where,
        with: glossaryEntryRelations,
        orderBy: [asc(grammarPattern.pattern), asc(grammarPattern.title)]
      })
  } as unknown as GlossaryQueryLoader<K>;
}

async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: "term",
  where?: SQL<unknown>
): Promise<TermGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: "grammar",
  where?: SQL<unknown>
): Promise<GrammarGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
): Promise<TermGlossaryRow[] | GrammarGlossaryRow[]>;
async function queryGlossaryEntries(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
) {
  return getGlossaryQueryLoader(database, kind).findMany(where) as Promise<
    TermGlossaryRow[] | GrammarGlossaryRow[]
  >;
}

async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: "term",
  where?: SQL<unknown>
): Promise<TermGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: "grammar",
  where?: SQL<unknown>
): Promise<GrammarGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
): Promise<TermGlossaryRow | GrammarGlossaryRow | null>;
async function queryGlossaryEntry(
  database: DatabaseQueryClient,
  kind: EntryType,
  where?: SQL<unknown>
) {
  return (
    (await getGlossaryQueryLoader(database, kind).findFirst(where)) ?? null
  );
}

export async function listGlossaryEntriesByKind(
  database: DatabaseClient,
  kind: "term",
  options: ListGlossaryEntriesOptions
): Promise<TermGlossaryRow[]>;
export async function listGlossaryEntriesByKind(
  database: DatabaseClient,
  kind: "grammar",
  options: ListGlossaryEntriesOptions
): Promise<GrammarGlossaryRow[]>;
export async function listGlossaryEntriesByKind(
  database: DatabaseClient,
  kind: EntryType,
  options: ListGlossaryEntriesOptions = {}
) {
  return queryGlossaryEntries(
    database,
    kind,
    buildGlossaryMediaScopeFilter(kind, options)
  );
}

export async function listGlossarySegmentsByMediaId(
  database: DatabaseClient,
  mediaId: string
) {
  return database.query.segment.findMany({
    where: eq(segment.mediaId, mediaId),
    orderBy: [asc(segment.orderIndex), asc(segment.title)]
  });
}

function buildTermSummaryBaseSelection() {
  return {
    id: term.id,
    sourceId: term.sourceId,
    crossMediaGroupId: term.crossMediaGroupId,
    mediaId: term.mediaId,
    segmentId: term.segmentId,
    lemma: term.lemma,
    reading: term.reading,
    romaji: term.romaji,
    meaningIt: term.meaningIt,
    audioSrc: term.audioSrc,
    audioSource: term.audioSource,
    audioSpeaker: term.audioSpeaker,
    audioLicense: term.audioLicense,
    audioAttribution: term.audioAttribution,
    audioPageUrl: term.audioPageUrl,
    pitchAccent: term.pitchAccent,
    pitchAccentSource: term.pitchAccentSource,
    pitchAccentPageUrl: term.pitchAccentPageUrl,
    mediaSlug: media.slug,
    mediaTitle: media.title,
    segmentTitle: segment.title,
    crossMediaGroupKey: crossMediaGroup.groupKey
  };
}

function buildTermSummarySelection(includeExtendedFields: true): ReturnType<
  typeof buildTermSummaryBaseSelection
> & {
  levelHint: typeof term.levelHint;
  searchLemmaNorm: typeof term.searchLemmaNorm;
  searchReadingNorm: typeof term.searchReadingNorm;
  searchRomajiNorm: typeof term.searchRomajiNorm;
};
function buildTermSummarySelection(includeExtendedFields: false): ReturnType<
  typeof buildTermSummaryBaseSelection
>;
function buildTermSummarySelection(includeExtendedFields: boolean) {
  const selection = buildTermSummaryBaseSelection();

  if (includeExtendedFields) {
    return {
      ...selection,
      levelHint: term.levelHint,
      searchLemmaNorm: term.searchLemmaNorm,
      searchReadingNorm: term.searchReadingNorm,
      searchRomajiNorm: term.searchRomajiNorm
    };
  }

  return selection;
}

function buildGrammarSummaryBaseSelection() {
  return {
    id: grammarPattern.id,
    sourceId: grammarPattern.sourceId,
    crossMediaGroupId: grammarPattern.crossMediaGroupId,
    mediaId: grammarPattern.mediaId,
    segmentId: grammarPattern.segmentId,
    pattern: grammarPattern.pattern,
    title: grammarPattern.title,
    reading: grammarPattern.reading,
    meaningIt: grammarPattern.meaningIt,
    audioSrc: grammarPattern.audioSrc,
    audioSource: grammarPattern.audioSource,
    audioSpeaker: grammarPattern.audioSpeaker,
    audioLicense: grammarPattern.audioLicense,
    audioAttribution: grammarPattern.audioAttribution,
    audioPageUrl: grammarPattern.audioPageUrl,
    pitchAccent: grammarPattern.pitchAccent,
    pitchAccentSource: grammarPattern.pitchAccentSource,
    pitchAccentPageUrl: grammarPattern.pitchAccentPageUrl,
    mediaSlug: media.slug,
    mediaTitle: media.title,
    segmentTitle: segment.title,
    crossMediaGroupKey: crossMediaGroup.groupKey
  };
}

function buildGrammarSummarySelection(includeExtendedFields: true): ReturnType<
  typeof buildGrammarSummaryBaseSelection
> & {
  levelHint: typeof grammarPattern.levelHint;
  searchPatternNorm: typeof grammarPattern.searchPatternNorm;
  searchRomajiNorm: typeof grammarPattern.searchRomajiNorm;
};
function buildGrammarSummarySelection(includeExtendedFields: false): ReturnType<
  typeof buildGrammarSummaryBaseSelection
>;
function buildGrammarSummarySelection(includeExtendedFields: boolean) {
  const selection = buildGrammarSummaryBaseSelection();

  if (includeExtendedFields) {
    return {
      ...selection,
      levelHint: grammarPattern.levelHint,
      searchPatternNorm: grammarPattern.searchPatternNorm,
      searchRomajiNorm: grammarPattern.searchRomajiNorm
    };
  }

  return selection;
}

export async function listTermEntrySummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildTermSummarySelection(true))
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .where(buildMediaScopeFilter(term.mediaId, options))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listTermEntryReviewSummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildTermSummarySelection(false))
    .from(term)
    .innerJoin(media, eq(media.id, term.mediaId))
    .leftJoin(segment, eq(segment.id, term.segmentId))
    .leftJoin(crossMediaGroup, eq(crossMediaGroup.id, term.crossMediaGroupId))
    .where(buildMediaScopeFilter(term.mediaId, options))
    .orderBy(asc(term.lemma), asc(term.reading));
}

export async function listGrammarEntrySummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildGrammarSummarySelection(true))
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .where(buildMediaScopeFilter(grammarPattern.mediaId, options))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export async function listGrammarEntryReviewSummaries(
  database: DatabaseClient,
  options: ListGlossaryEntriesOptions = {}
) {
  return database
    .select(buildGrammarSummarySelection(false))
    .from(grammarPattern)
    .innerJoin(media, eq(media.id, grammarPattern.mediaId))
    .leftJoin(segment, eq(segment.id, grammarPattern.segmentId))
    .leftJoin(
      crossMediaGroup,
      eq(crossMediaGroup.id, grammarPattern.crossMediaGroupId)
    )
    .where(buildMediaScopeFilter(grammarPattern.mediaId, options))
    .orderBy(asc(grammarPattern.pattern), asc(grammarPattern.title));
}

export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: "term",
  entryIds: string[]
): Promise<TermGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: "grammar",
  entryIds: string[]
): Promise<GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryIds: string[]
): Promise<TermGlossaryRow[] | GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryIds: string[]
) {
  if (entryIds.length === 0) {
    return [];
  }

  return queryGlossaryEntries(
    database,
    kind,
    buildGlossaryIdsFilter(kind, entryIds)
  );
}

export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseQueryClient,
  kind: "term",
  groupIds: string[]
): Promise<TermGlossaryRow[]>;
export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseQueryClient,
  kind: "grammar",
  groupIds: string[]
): Promise<GrammarGlossaryRow[]>;
export async function getGlossaryEntriesByCrossMediaGroupIds(
  database: DatabaseQueryClient,
  kind: EntryType,
  groupIds: string[]
) {
  if (groupIds.length === 0) {
    return [];
  }

  return queryGlossaryEntries(
    database,
    kind,
    buildGlossaryCrossMediaGroupFilter(kind, groupIds)
  );
}

export async function getGlossaryEntryById(
  database: DatabaseQueryClient,
  kind: "term",
  entryId: string
): Promise<TermGlossaryRow | null>;
export async function getGlossaryEntryById(
  database: DatabaseQueryClient,
  kind: "grammar",
  entryId: string
): Promise<GrammarGlossaryRow | null>;
export async function getGlossaryEntryById(
  database: DatabaseQueryClient,
  kind: EntryType,
  entryId: string
): Promise<TermGlossaryRow | GrammarGlossaryRow | null> {
  const [entry] = await getGlossaryEntriesByIds(database, kind, [entryId]);

  return entry ?? null;
}

export async function getGlossaryEntryBySourceId(
  database: DatabaseQueryClient,
  kind: "term",
  mediaId: string,
  sourceId: string
): Promise<TermGlossaryRow | null>;
export async function getGlossaryEntryBySourceId(
  database: DatabaseQueryClient,
  kind: "grammar",
  mediaId: string,
  sourceId: string
): Promise<GrammarGlossaryRow | null>;
export async function getGlossaryEntryBySourceId(
  database: DatabaseQueryClient,
  kind: EntryType,
  mediaId: string,
  sourceId: string
) {
  return queryGlossaryEntry(
    database,
    kind,
    buildGlossarySourceFilter(kind, mediaId, sourceId)
  );
}

export type GlossarySegment = Awaited<
  ReturnType<typeof listGlossarySegmentsByMediaId>
>[number];
export type TermGlossaryEntry = TermGlossaryRow;
export type GrammarGlossaryEntry = GrammarGlossaryRow;
export type TermGlossaryEntrySummary = Awaited<
  ReturnType<typeof listTermEntrySummaries>
>[number];
export type GrammarGlossaryEntrySummary = Awaited<
  ReturnType<typeof listGrammarEntrySummaries>
>[number];
export type TermEntryReviewSummary = Awaited<
  ReturnType<typeof listTermEntryReviewSummaries>
>[number];
export type GrammarEntryReviewSummary = Awaited<
  ReturnType<typeof listGrammarEntryReviewSummaries>
>[number];

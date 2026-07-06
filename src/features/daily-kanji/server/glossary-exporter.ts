import type { DatabaseQueryClient } from "../../../db/create-client.ts";
import {
  listGlossaryEntriesByKind,
  type GrammarGlossaryEntry,
  type TermGlossaryEntry
} from "../../../db/queries/index.ts";
import type {
  DailyKanjiGlossaryAlias,
  DailyKanjiGlossaryEntry,
  DailyKanjiGlossaryMediaRef,
  DailyKanjiGlossarySnapshot
} from "../types.ts";

export const dailyKanjiGlossarySnapshotVersion = 1 as const;

export async function buildDailyKanjiGlossarySnapshot(input: {
  database: DatabaseQueryClient;
  nowIso: string;
}): Promise<DailyKanjiGlossarySnapshot> {
  const [terms, grammar] = await Promise.all([
    listGlossaryEntriesByKind(input.database, "term", {}),
    listGlossaryEntriesByKind(input.database, "grammar", {})
  ]);
  const entries = buildDailyKanjiGlossaryEntries(terms, grammar);

  return {
    version: dailyKanjiGlossarySnapshotVersion,
    generatedAt: input.nowIso,
    entryCount: entries.length,
    entries
  };
}

function buildDailyKanjiGlossaryEntries(
  terms: TermGlossaryEntry[],
  grammar: GrammarGlossaryEntry[]
) {
  const groups = new Map<string, GlossaryExportGroup>();

  for (const term of terms) {
    appendGlossaryGroup(groups, mapTermGlossaryExportEntry(term));
  }

  for (const pattern of grammar) {
    appendGlossaryGroup(groups, mapGrammarGlossaryExportEntry(pattern));
  }

  return Array.from(groups.values())
    .map(buildDailyKanjiGlossaryEntry)
    .sort(compareDailyKanjiGlossaryEntries);
}

type GlossaryExportGroup = {
  aliases: DailyKanjiGlossaryAlias[];
  groupKey: string;
  kind: "term" | "grammar";
  locals: GlossaryLocalExportEntry[];
};

type GlossaryLocalExportEntry = Omit<
  DailyKanjiGlossaryEntry,
  "aliases" | "id" | "media" | "searchText"
> & {
  aliases: DailyKanjiGlossaryAlias[];
  groupKey: string;
  literalMeaning?: string;
  media: DailyKanjiGlossaryMediaRef;
};

function appendGlossaryGroup(
  groups: Map<string, GlossaryExportGroup>,
  entry: GlossaryLocalExportEntry
) {
  const key = `${entry.kind}:${entry.groupKey}`;
  const group =
    groups.get(key) ??
    ({
      aliases: [],
      groupKey: entry.groupKey,
      kind: entry.kind,
      locals: []
    } satisfies GlossaryExportGroup);

  group.locals.push(entry);
  group.aliases.push(...entry.aliases);
  groups.set(key, group);
}

function mapTermGlossaryExportEntry(
  entry: TermGlossaryEntry
): GlossaryLocalExportEntry {
  return {
    aliases: entry.aliases.map((alias) => ({
      text: alias.aliasText,
      type: alias.aliasType
    })),
    groupKey: entry.crossMediaGroup?.groupKey ?? entry.id,
    kind: "term",
    label: entry.lemma,
    literalMeaning: entry.meaningLiteralIt ?? undefined,
    meaning: entry.meaningIt,
    media: mapGlossaryMediaRef(entry),
    notes: entry.notesIt ?? undefined,
    pitchAccent: entry.pitchAccent,
    pitchAccentSource: entry.pitchAccentSource,
    reading: entry.reading,
    romaji: entry.romaji,
    title: undefined
  };
}

function mapGrammarGlossaryExportEntry(
  entry: GrammarGlossaryEntry
): GlossaryLocalExportEntry {
  return {
    aliases: entry.aliases.map((alias) => ({ text: alias.aliasText })),
    groupKey: entry.crossMediaGroup?.groupKey ?? entry.id,
    kind: "grammar",
    label: entry.pattern,
    meaning: entry.meaningIt,
    media: mapGlossaryMediaRef(entry),
    notes: entry.notesIt ?? undefined,
    pitchAccent: entry.pitchAccent,
    pitchAccentSource: entry.pitchAccentSource,
    reading: entry.reading,
    romaji: entry.searchRomajiNorm,
    title: entry.title
  };
}

function mapGlossaryMediaRef(
  entry: TermGlossaryEntry | GrammarGlossaryEntry
): DailyKanjiGlossaryMediaRef {
  return {
    entryId: entry.id,
    mediaSlug: entry.media.slug,
    mediaTitle: entry.media.title,
    ...(entry.segment?.title ? { segmentTitle: entry.segment.title } : {}),
    sourceId: entry.sourceId
  };
}

function buildDailyKanjiGlossaryEntry(
  group: GlossaryExportGroup
): DailyKanjiGlossaryEntry {
  const locals = group.locals.sort(compareGlossaryLocalEntries);
  const primary = locals[0]!;
  const aliases = dedupeGlossaryAliases(group.aliases);
  const media = dedupeGlossaryMediaRefs(locals.map((entry) => entry.media));

  return {
    aliases,
    id: `${group.kind}:${group.groupKey}`,
    kind: group.kind,
    label: primary.label,
    meaning: primary.meaning,
    media,
    ...(primary.notes ? { notes: primary.notes } : {}),
    pitchAccent: primary.pitchAccent,
    pitchAccentSource: primary.pitchAccentSource,
    reading: primary.reading,
    romaji: primary.romaji,
    searchText: buildGlossarySearchText(locals, aliases, media),
    ...(primary.title ? { title: primary.title } : {})
  };
}

function buildGlossarySearchText(
  locals: GlossaryLocalExportEntry[],
  aliases: DailyKanjiGlossaryAlias[],
  media: DailyKanjiGlossaryMediaRef[]
) {
  return uniqueCompactStrings([
    ...locals.flatMap((entry) => [
      entry.label,
      entry.title,
      entry.reading,
      entry.romaji,
      entry.meaning,
      entry.literalMeaning,
      entry.notes
    ]),
    ...aliases.map((alias) => alias.text),
    ...media.flatMap((ref) => [ref.mediaTitle, ref.segmentTitle])
  ]).join(" ");
}

function dedupeGlossaryAliases(aliases: DailyKanjiGlossaryAlias[]) {
  const seen = new Set<string>();
  return aliases
    .sort(compareGlossaryAliases)
    .filter((alias) => {
      const key = `${alias.text}:${alias.type ?? ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function dedupeGlossaryMediaRefs(refs: DailyKanjiGlossaryMediaRef[]) {
  const seen = new Set<string>();
  return refs
    .sort(compareGlossaryMediaRefs)
    .filter((ref) => {
      const key = `${ref.entryId}:${ref.mediaSlug}:${ref.segmentTitle ?? ""}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function uniqueCompactStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const compacted: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    compacted.push(trimmed);
  }

  return compacted;
}

function compareGlossaryAliases(
  left: DailyKanjiGlossaryAlias,
  right: DailyKanjiGlossaryAlias
) {
  const typeDifference =
    glossaryAliasTypeRank(left.type) - glossaryAliasTypeRank(right.type);

  if (typeDifference !== 0) {
    return typeDifference;
  }

  return left.text.localeCompare(right.text, "ja");
}

function glossaryAliasTypeRank(type: string | undefined) {
  if (type === "inflected") {
    return 0;
  }

  if (type === "romaji") {
    return 1;
  }

  return 2;
}

function compareGlossaryLocalEntries(
  left: GlossaryLocalExportEntry,
  right: GlossaryLocalExportEntry
) {
  return (
    left.media.mediaTitle.localeCompare(right.media.mediaTitle, "ja") ||
    left.label.localeCompare(right.label, "ja") ||
    left.media.sourceId.localeCompare(right.media.sourceId, "ja")
  );
}

function compareGlossaryMediaRefs(
  left: DailyKanjiGlossaryMediaRef,
  right: DailyKanjiGlossaryMediaRef
) {
  return (
    left.mediaTitle.localeCompare(right.mediaTitle, "ja") ||
    left.mediaSlug.localeCompare(right.mediaSlug, "ja") ||
    left.sourceId.localeCompare(right.sourceId, "ja")
  );
}

function compareDailyKanjiGlossaryEntries(
  left: DailyKanjiGlossaryEntry,
  right: DailyKanjiGlossaryEntry
) {
  return (
    left.label.localeCompare(right.label, "ja") ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

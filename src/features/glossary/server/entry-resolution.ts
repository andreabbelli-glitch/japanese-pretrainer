import type { DatabaseClient } from "@/db";
import { listEntryCardCounts, listEntryStudySignals } from "@/db/queries";
import {
  buildEntryCardCountMap,
  buildResolvedEntriesFromMaps,
  buildStudySignalMap
} from "@/features/glossary/model/filter";
import type {
  GlossaryBaseEntry,
  GlossaryKind,
  GlossaryQueryState
} from "../types";

export async function buildGlossaryResolvedEntries(
  database: DatabaseClient,
  entries: GlossaryBaseEntry[],
  filters: GlossaryQueryState
) {
  const entryRefs = entries.map((entry) => ({
    crossMediaGroupId: entry.crossMediaGroupId ?? null,
    entryId: entry.internalId,
    entryType: entry.kind
  }));
  const [studySignalsByEntry, cardCounts] = await Promise.all([
    loadStudySignalsByEntry(database, entryRefs),
    listEntryCardCounts(database, entryRefs)
  ]);

  return {
    candidates: buildResolvedEntriesFromMaps({
      cardCountByEntry: buildEntryCardCountMap(cardCounts),
      entries,
      filters,
      studySignalsByEntry
    })
  };
}

async function loadStudySignalsByEntry(
  database: DatabaseClient,
  entries: Array<{
    crossMediaGroupId: string | null;
    entryId: string;
    entryType: GlossaryKind;
  }>
) {
  const rows = await listEntryStudySignals(database, entries);

  return buildStudySignalMap(rows);
}

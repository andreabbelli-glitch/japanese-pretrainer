import type { EntryType } from "@/domain/content";

export function buildScopedEntryId(
  entryType: EntryType,
  mediaId: string,
  sourceId: string
) {
  return `${entryType}_${mediaId.length}_${mediaId}_${sourceId.length}_${sourceId}`;
}

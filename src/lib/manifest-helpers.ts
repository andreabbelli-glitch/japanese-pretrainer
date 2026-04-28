import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPronunciationManifest,
  serializePronunciationManifest,
  type PronunciationManifestEntry
} from "./content/pronunciations-manifest.ts";
import { buildEntryKey } from "./entry-id.ts";

type PronunciationAudioManifestFields = Pick<
  PronunciationManifestEntry,
  | "audioAttribution"
  | "audioLicense"
  | "audioPageUrl"
  | "audioSource"
  | "audioSpeaker"
  | "audioSrc"
> &
  Required<Pick<PronunciationManifestEntry, "audioSrc">>;

export function buildManifestEntryMap(
  entries: PronunciationManifestEntry[]
): Map<string, PronunciationManifestEntry> {
  return new Map(
    entries.map((entry) => [
      buildEntryKey(entry.entryType, entry.entryId),
      entry
    ])
  );
}

export async function loadValidatedManifest(
  mediaDirectory: string,
  mediaSlug: string
) {
  const manifest = await loadPronunciationManifest(mediaDirectory);

  if (manifest.issues.length > 0) {
    throw new Error(
      `Cannot update pronunciations for '${mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  return {
    manifest: manifest.manifest,
    entries: buildManifestEntryMap(manifest.manifest?.entries ?? [])
  };
}

export function mergePronunciationAudioManifestEntry(input: {
  audio: PronunciationAudioManifestFields;
  entryId: string;
  entryType: PronunciationManifestEntry["entryType"];
  existing?: PronunciationManifestEntry;
}): PronunciationManifestEntry {
  return {
    ...input.existing,
    entryId: input.entryId,
    entryType: input.entryType,
    ...input.audio
  };
}

export async function persistManifestEntries(
  mediaDirectory: string,
  manifestEntries: Map<string, PronunciationManifestEntry>
) {
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(
    path.join(mediaDirectory, "pronunciations.json"),
    serializePronunciationManifest({
      entries: [...manifestEntries.values()],
      version: 1
    })
  );
}

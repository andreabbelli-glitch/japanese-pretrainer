import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildEntryKey } from "./entry-id.ts";
import type {
  EntryKind,
  PronunciationTargetEntry
} from "./pronunciation-shared.ts";

export type ForvoKnownMissingEntry = {
  entryId: string;
  entryKind: EntryKind;
  label?: string;
  mediaSlug: string;
  reading?: string;
  reason?: "not_found_on_forvo";
  updatedAt?: string;
};

export type ForvoKnownMissingRegistry = {
  version: 1;
  entries: ForvoKnownMissingEntry[];
};

export async function loadForvoKnownMissingRegistry(
  filePath?: string
): Promise<ForvoKnownMissingRegistry> {
  if (!filePath) {
    return createEmptyForvoKnownMissingRegistry();
  }

  try {
    const source = await readFile(filePath, "utf8");
    const parsed = JSON.parse(source);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];

    return {
      entries: entries.filter(isForvoKnownMissingEntry),
      version: 1
    } satisfies ForvoKnownMissingRegistry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return createEmptyForvoKnownMissingRegistry();
    }

    throw new Error(
      `Could not read Forvo known-missing registry at '${filePath}'.`
    );
  }
}

export async function persistForvoKnownMissingRegistry(
  filePath: string | undefined,
  registry: ForvoKnownMissingRegistry
) {
  if (!filePath) {
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        version: 1,
        entries: registry.entries.sort(compareForvoKnownMissingEntries)
      },
      null,
      2
    )}\n`
  );
}

export function hasForvoKnownMissingEntry(
  registry: ForvoKnownMissingRegistry,
  entry: Pick<PronunciationTargetEntry, "id" | "kind" | "mediaSlug">,
  mediaSlug = entry.mediaSlug
) {
  return registry.entries.some(
    (candidate) =>
      candidate.mediaSlug === mediaSlug &&
      candidate.entryKind === entry.kind &&
      candidate.entryId === entry.id
  );
}

export function addForvoKnownMissingEntry(
  registry: ForvoKnownMissingRegistry,
  input: {
    entry: PronunciationTargetEntry;
    mediaSlug?: string;
  }
) {
  if (input.entry.audioSrc) {
    return false;
  }

  const mediaSlug = input.mediaSlug ?? input.entry.mediaSlug;

  if (hasForvoKnownMissingEntry(registry, input.entry, mediaSlug)) {
    return false;
  }

  registry.entries.push({
    entryId: input.entry.id,
    entryKind: input.entry.kind,
    label: input.entry.label,
    mediaSlug,
    reading: input.entry.reading,
    reason: "not_found_on_forvo",
    updatedAt: new Date().toISOString()
  });

  return true;
}

export function pruneForvoKnownMissingRegistry(
  registry: ForvoKnownMissingRegistry,
  targets: PronunciationTargetEntry[],
  mediaSlug: string
) {
  const audioBacked = new Set(
    targets
      .filter((entry) => entry.mediaSlug === mediaSlug && entry.audioSrc)
      .map((entry) => buildEntryKey(entry.kind, entry.id))
  );
  const nextEntries = registry.entries.filter(
    (entry) =>
      entry.mediaSlug !== mediaSlug ||
      !audioBacked.has(buildEntryKey(entry.entryKind, entry.entryId))
  );

  if (nextEntries.length === registry.entries.length) {
    return false;
  }

  registry.entries = nextEntries;
  return true;
}

function createEmptyForvoKnownMissingRegistry() {
  return {
    entries: [],
    version: 1
  } satisfies ForvoKnownMissingRegistry;
}

function isForvoKnownMissingEntry(
  value: unknown
): value is ForvoKnownMissingEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ForvoKnownMissingEntry>;

  return (
    (candidate.entryKind === "term" || candidate.entryKind === "grammar") &&
    typeof candidate.entryId === "string" &&
    typeof candidate.mediaSlug === "string"
  );
}

function compareForvoKnownMissingEntries(
  left: ForvoKnownMissingEntry,
  right: ForvoKnownMissingEntry
) {
  const mediaDelta = left.mediaSlug.localeCompare(right.mediaSlug);

  if (mediaDelta !== 0) {
    return mediaDelta;
  }

  const kindDelta = left.entryKind.localeCompare(right.entryKind);

  if (kindDelta !== 0) {
    return kindDelta;
  }

  return left.entryId.localeCompare(right.entryId);
}

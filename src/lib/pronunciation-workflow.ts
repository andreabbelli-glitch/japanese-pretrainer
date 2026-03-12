import {
  mkdir,
  readFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  loadPronunciationManifest
} from "./content/pronunciations-manifest.ts";
import type { NormalizedMediaBundle } from "./content/types.ts";
import {
  collectPronunciationTargets,
  type PronunciationTargetEntry
} from "./pronunciation-fetch.ts";

export const pronunciationWorkflowDirectoryName = "workflow";
export const pronunciationPendingFileName = "pronunciation-pending.json";

type ForvoKnownMissingEntry = {
  entryId: string;
  entryKind: "term" | "grammar";
  mediaSlug: string;
};

type ForvoKnownMissingRegistry = {
  version: 1;
  entries: ForvoKnownMissingEntry[];
};

export type PronunciationPendingEntry = {
  entryId: string;
  entryType: "term" | "grammar";
  label: string;
  reading?: string;
};

export type MediaPronunciationPendingSummary = {
  audioBackedCount: number;
  knownMissingCount: number;
  mediaSlug: string;
  pending: PronunciationPendingEntry[];
  pendingCount: number;
  totalTargets: number;
  workflowFilePath: string;
};

export async function summarizeBundlePronunciationPending(input: {
  bundle: NormalizedMediaBundle;
  knownMissingPath?: string;
}): Promise<MediaPronunciationPendingSummary> {
  const workflowFilePath = path.join(
    input.bundle.mediaDirectory,
    pronunciationWorkflowDirectoryName,
    pronunciationPendingFileName
  );
  const manifest = await loadPronunciationManifest(input.bundle.mediaDirectory);

  if (manifest.issues.length > 0) {
    throw new Error(
      `Cannot summarize pronunciations for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestAudioBacked = new Set(
    (manifest.manifest?.entries ?? [])
      .filter((entry) => Boolean(entry.audioSrc))
      .map((entry) => buildEntryKey(entry.entryType, entry.entryId))
  );
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    input.knownMissingPath
  );
  const knownMissing = new Set(
    knownMissingRegistry.entries
      .filter(
        (entry: ForvoKnownMissingEntry) =>
          entry.mediaSlug === input.bundle.mediaSlug
      )
      .map((entry: ForvoKnownMissingEntry) =>
        buildEntryKey(entry.entryKind, entry.entryId)
      )
  );
  const allTargets = collectPronunciationTargets(input.bundle);
  const pending: PronunciationPendingEntry[] = [];
  let audioBackedCount = 0;
  let knownMissingCount = 0;

  for (const entry of allTargets) {
    const entryKey = buildEntryKey(entry.kind, entry.id);

    if (hasAudio(entry, manifestAudioBacked)) {
      audioBackedCount += 1;
      continue;
    }

    if (knownMissing.has(entryKey)) {
      knownMissingCount += 1;
      continue;
    }

    pending.push({
      entryId: entry.id,
      entryType: entry.kind,
      label: entry.label,
      reading: entry.reading || undefined
    });
  }

  return {
    audioBackedCount,
    knownMissingCount,
    mediaSlug: input.bundle.mediaSlug,
    pending,
    pendingCount: pending.length,
    totalTargets: allTargets.length,
    workflowFilePath
  };
}

export async function writeBundlePronunciationPendingSummary(input: {
  bundle: NormalizedMediaBundle;
  knownMissingPath?: string;
}) {
  const summary = await summarizeBundlePronunciationPending(input);
  const workflowDirectory = path.dirname(summary.workflowFilePath);
  const nextContent = serializePronunciationPendingSummary(summary);

  await mkdir(workflowDirectory, { recursive: true });
  await writeFileIfChanged(summary.workflowFilePath, nextContent);

  return summary;
}

function serializePronunciationPendingSummary(
  summary: MediaPronunciationPendingSummary
) {
  return `${JSON.stringify(
    {
      version: 1,
      media_slug: summary.mediaSlug,
      total_targets: summary.totalTargets,
      audio_backed_count: summary.audioBackedCount,
      known_missing_count: summary.knownMissingCount,
      pending_count: summary.pendingCount,
      pending: summary.pending.map((entry) => ({
        entry_type: entry.entryType,
        entry_id: entry.entryId,
        label: entry.label,
        reading: entry.reading
      }))
    },
    null,
    2
  )}\n`;
}

function hasAudio(
  entry: PronunciationTargetEntry,
  manifestAudioBacked: Set<string>
) {
  return Boolean(entry.audioSrc) || manifestAudioBacked.has(buildEntryKey(entry.kind, entry.id));
}

function buildEntryKey(entryType: "term" | "grammar", entryId: string) {
  return `${entryType}:${entryId}`;
}

async function loadForvoKnownMissingRegistry(knownMissingPath?: string) {
  if (!knownMissingPath) {
    return {
      entries: [],
      version: 1
    } satisfies ForvoKnownMissingRegistry;
  }

  try {
    const source = await readFile(knownMissingPath, "utf8");
    const parsed = JSON.parse(source);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];

    return {
      entries: entries.filter(isForvoKnownMissingEntry),
      version: 1
    } satisfies ForvoKnownMissingRegistry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {
        entries: [],
        version: 1
      } satisfies ForvoKnownMissingRegistry;
    }

    throw new Error(
      `Could not read Forvo known-missing registry at '${knownMissingPath}'.`
    );
  }
}

function isForvoKnownMissingEntry(value: unknown): value is ForvoKnownMissingEntry {
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

async function writeFileIfChanged(filePath: string, nextContent: string) {
  try {
    const currentContent = await readFile(filePath, "utf8");

    if (currentContent === nextContent) {
      return;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(filePath, nextContent);
}

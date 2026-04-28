import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPronunciationManifest,
  serializePronunciationManifest,
  type PronunciationManifestEntry
} from "./content/pronunciations-manifest.ts";
import type { NormalizedMediaBundle } from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import { mergePronunciationAudioManifestEntry } from "./manifest-helpers.ts";
import { resolveMediaAssetAbsolutePath } from "./media-assets.ts";
import {
  collectPronunciationTargets,
  normalizePronunciationText,
  type PronunciationTargetEntry
} from "./pronunciation-shared.ts";

type AudioBackedEntry = {
  audioAttribution?: string | null;
  audioLicense?: string | null;
  audioPageUrl?: string | null;
  audioSource?: string | null;
  audioSpeaker?: string | null;
  audioSrc: string;
  crossMediaGroup?: string;
  entryId: string;
  entryType: "term" | "grammar";
  label: string;
  mediaDirectory: string;
  mediaSlug: string;
  reading: string;
};

export type PronunciationReuseContext = {
  audioBackedEntries: AudioBackedEntry[];
};

export type PronunciationReuseResult =
  | {
      entryId: string;
      kind: "term" | "grammar";
      sourceEntryId: string;
      sourceMediaSlug: string;
      status: "reused";
    }
  | {
      candidateEntryIds: string[];
      candidateMediaSlugs: string[];
      entryId: string;
      kind: "term" | "grammar";
      status: "ambiguous";
    };

export async function reusePronunciationsAcrossMedia(input: {
  bundle: NormalizedMediaBundle;
  allBundles: NormalizedMediaBundle[];
  dryRun?: boolean;
  onlyTargets?: PronunciationTargetEntry[];
  reuseContext?: PronunciationReuseContext;
}) {
  const manifest = await loadPronunciationManifest(input.bundle.mediaDirectory);

  if (manifest.issues.length > 0) {
    throw new Error(
      `Cannot reuse pronunciations for '${input.bundle.mediaSlug}' because pronunciations.json is invalid.`
    );
  }

  const manifestEntries = new Map<string, PronunciationManifestEntry>(
    (manifest.manifest?.entries ?? []).map((entry) => [
      buildEntryKey(entry.entryType, entry.entryId),
      entry
    ])
  );
  const targetPool =
    input.onlyTargets ?? collectPronunciationTargets(input.bundle);
  const missingTargets = targetPool.filter((entry) => {
    const manifestEntry = manifestEntries.get(
      buildEntryKey(entry.kind, entry.id)
    );
    return !(entry.audioSrc || manifestEntry?.audioSrc);
  });
  const audioBackedEntries =
    input.reuseContext?.audioBackedEntries ??
    (await collectAudioBackedEntries(input.allBundles));
  const results: PronunciationReuseResult[] = [];

  for (const target of missingTargets) {
    const candidates = findReuseCandidates(target, audioBackedEntries);

    if (candidates.length === 0) {
      continue;
    }

    if (candidates.length > 1) {
      results.push({
        candidateEntryIds: candidates.map((candidate) => candidate.entryId),
        candidateMediaSlugs: candidates.map((candidate) => candidate.mediaSlug),
        entryId: target.id,
        kind: target.kind,
        status: "ambiguous"
      });
      continue;
    }

    const source = candidates[0]!;
    const sourcePath = resolveMediaAssetAbsolutePath(
      source.mediaDirectory,
      source.audioSrc
    ).absolutePath;
    const targetRelativePath = buildTargetAudioPath(
      target.kind,
      target.id,
      source.audioSrc
    );
    const targetPath = resolveMediaAssetAbsolutePath(
      input.bundle.mediaDirectory,
      targetRelativePath
    ).absolutePath;

    if (!input.dryRun) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }

    const entryKey = buildEntryKey(target.kind, target.id);
    manifestEntries.set(
      entryKey,
      mergePronunciationAudioManifestEntry({
        audio: {
          audioAttribution: source.audioAttribution ?? undefined,
          audioLicense: source.audioLicense ?? undefined,
          audioPageUrl: source.audioPageUrl ?? undefined,
          audioSource: source.audioSource ?? undefined,
          audioSpeaker: source.audioSpeaker ?? undefined,
          audioSrc: targetRelativePath
        },
        entryId: target.id,
        entryType: target.kind,
        existing: manifestEntries.get(entryKey)
      })
    );
    results.push({
      entryId: target.id,
      kind: target.kind,
      sourceEntryId: source.entryId,
      sourceMediaSlug: source.mediaSlug,
      status: "reused"
    });
  }

  if (!input.dryRun && results.some((result) => result.status === "reused")) {
    const manifestPath = path.join(
      input.bundle.mediaDirectory,
      "pronunciations.json"
    );
    await writeFile(
      manifestPath,
      serializePronunciationManifest({
        entries: [...manifestEntries.values()],
        version: 1
      })
    );
  }

  return {
    ambiguous: results.filter((result) => result.status === "ambiguous").length,
    results,
    reused: results.filter((result) => result.status === "reused").length
  };
}

export async function reuseCrossMediaPronunciationsForBundle(input: {
  bundle: NormalizedMediaBundle;
  bundles: NormalizedMediaBundle[];
  dryRun?: boolean;
  onlyTargets?: PronunciationTargetEntry[];
  reuseContext?: PronunciationReuseContext;
}) {
  return reusePronunciationsAcrossMedia({
    allBundles: input.bundles,
    bundle: input.bundle,
    dryRun: input.dryRun,
    onlyTargets: input.onlyTargets,
    reuseContext: input.reuseContext
  });
}

export async function createPronunciationReuseContext(
  bundles: NormalizedMediaBundle[]
): Promise<PronunciationReuseContext> {
  return {
    audioBackedEntries: await collectAudioBackedEntries(bundles)
  };
}

export async function refreshPronunciationReuseContextBundle(
  context: PronunciationReuseContext,
  bundle: NormalizedMediaBundle
) {
  const nextEntries = await collectAudioBackedEntriesForBundle(bundle);
  const preservedEntries = context.audioBackedEntries.filter(
    (entry) => entry.mediaSlug !== bundle.mediaSlug
  );

  context.audioBackedEntries.splice(
    0,
    context.audioBackedEntries.length,
    ...preservedEntries,
    ...nextEntries
  );
}

async function collectAudioBackedEntries(bundles: NormalizedMediaBundle[]) {
  const entries: AudioBackedEntry[] = [];

  for (const bundle of bundles) {
    entries.push(...(await collectAudioBackedEntriesForBundle(bundle)));
  }

  return entries;
}

async function collectAudioBackedEntriesForBundle(
  bundle: NormalizedMediaBundle
) {
  const manifest = await loadPronunciationManifest(bundle.mediaDirectory);
  const manifestEntries = new Map(
    (manifest.manifest?.entries ?? []).map((entry) => [
      buildEntryKey(entry.entryType, entry.entryId),
      entry
    ])
  );
  const entries: AudioBackedEntry[] = [];

  for (const target of bundle.terms) {
    const manifestEntry = manifestEntries.get(buildEntryKey("term", target.id));
    const audio = target.audio ?? manifestEntry;
    const audioSrc = target.audio?.audioSrc ?? manifestEntry?.audioSrc;

    if (!audioSrc) {
      continue;
    }

    entries.push({
      audioAttribution: audio?.audioAttribution ?? null,
      audioLicense: audio?.audioLicense ?? null,
      audioPageUrl: audio?.audioPageUrl ?? null,
      audioSource: audio?.audioSource ?? null,
      audioSpeaker: audio?.audioSpeaker ?? null,
      audioSrc,
      crossMediaGroup: target.crossMediaGroup,
      entryId: target.id,
      entryType: "term",
      label: target.lemma,
      mediaDirectory: bundle.mediaDirectory,
      mediaSlug: bundle.mediaSlug,
      reading: target.reading
    });
  }

  for (const target of bundle.grammarPatterns) {
    const manifestEntry = manifestEntries.get(
      buildEntryKey("grammar", target.id)
    );
    const audio = target.audio ?? manifestEntry;
    const audioSrc = target.audio?.audioSrc ?? manifestEntry?.audioSrc;

    if (!audioSrc) {
      continue;
    }

    entries.push({
      audioAttribution: audio?.audioAttribution ?? null,
      audioLicense: audio?.audioLicense ?? null,
      audioPageUrl: audio?.audioPageUrl ?? null,
      audioSource: audio?.audioSource ?? null,
      audioSpeaker: audio?.audioSpeaker ?? null,
      audioSrc,
      crossMediaGroup: target.crossMediaGroup,
      entryId: target.id,
      entryType: "grammar",
      label: target.pattern,
      mediaDirectory: bundle.mediaDirectory,
      mediaSlug: bundle.mediaSlug,
      reading: target.reading ?? ""
    });
  }

  return entries;
}

function findReuseCandidates(
  target: PronunciationTargetEntry,
  entries: AudioBackedEntry[]
) {
  const crossMediaMatches = target.crossMediaGroup?.length
    ? entries.filter(
        (entry) =>
          entry.mediaSlug !== target.mediaSlug &&
          entry.entryType === target.kind &&
          entry.crossMediaGroup === target.crossMediaGroup
      )
    : [];

  if (crossMediaMatches.length > 0) {
    return crossMediaMatches;
  }

  const normalizedLabel = normalizePronunciationText(target.label);
  const normalizedReading = normalizePronunciationText(target.reading ?? "");

  return entries.filter((entry) => {
    if (
      entry.mediaSlug === target.mediaSlug ||
      entry.entryType !== target.kind
    ) {
      return false;
    }

    return (
      normalizePronunciationText(entry.label) === normalizedLabel &&
      normalizePronunciationText(entry.reading) === normalizedReading
    );
  });
}

function buildTargetAudioPath(
  entryType: "term" | "grammar",
  entryId: string,
  sourceAudioSrc: string
) {
  return `assets/audio/${entryType}/${entryId}/${path.basename(sourceAudioSrc)}`;
}

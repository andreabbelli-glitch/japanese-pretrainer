import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPronunciationManifest,
  serializePronunciationManifest,
  type PronunciationManifestEntry
} from "../src/lib/content/pronunciations-manifest.ts";
import type { NormalizedMediaBundle } from "../src/lib/content/types.ts";
import { parseContentRoot } from "../src/lib/content/validator.ts";
import {
  resolveMediaAssetAbsolutePath
} from "../src/lib/media-assets.ts";
import { collectPronunciationTargets } from "../src/lib/pronunciation-fetch.ts";
import { writeBundlePronunciationPendingSummary } from "../src/lib/pronunciation-workflow.ts";

type CliOptions = {
  contentRoot: string;
  dryRun: boolean;
  knownMissingPath: string;
  mediaSlugs: string[];
};

type AudioBackedEntry = {
  audioAttribution?: string | null;
  audioLicense?: string | null;
  audioPageUrl?: string | null;
  audioSource?: string | null;
  audioSpeaker?: string | null;
  audioSrc: string;
  entryId: string;
  entryType: "term" | "grammar";
  label: string;
  mediaDirectory: string;
  mediaSlug: string;
  reading: string;
};

const options = parseCliOptions(process.argv.slice(2));
const parseResult = await parseContentRoot(path.resolve(options.contentRoot));

if (!parseResult.ok) {
  console.error("Content validation failed. Fix these issues first:");

  for (const issue of parseResult.issues) {
    console.error(
      `- [${issue.category}] ${issue.code} at ${issue.location.filePath}: ${issue.message}`
    );
  }

  process.exitCode = 1;
} else {
  const bundles = parseResult.data.bundles.filter(
    (bundle) =>
      options.mediaSlugs.length === 0 ||
      options.mediaSlugs.includes(bundle.mediaSlug)
  );
  const audioBackedEntries = await collectAudioBackedEntries(
    parseResult.data.bundles
  );

  for (const bundle of bundles) {
    const manifest = await loadPronunciationManifest(bundle.mediaDirectory);

    if (manifest.issues.length > 0) {
      throw new Error(
        `Cannot reuse pronunciations for '${bundle.mediaSlug}' because pronunciations.json is invalid.`
      );
    }

    const manifestEntries = new Map<string, PronunciationManifestEntry>(
      (manifest.manifest?.entries ?? []).map((entry) => [
        `${entry.entryType}:${entry.entryId}`,
        entry
      ])
    );
    const missingTargets = collectPronunciationTargets(bundle).filter((entry) => {
      const manifestEntry = manifestEntries.get(`${entry.kind}:${entry.id}`);
      return !(entry.audioSrc || manifestEntry?.audioSrc);
    });
    let reused = 0;
    let ambiguous = 0;

    for (const target of missingTargets) {
      const candidates = audioBackedEntries.filter(
        (entry) =>
          entry.mediaSlug !== bundle.mediaSlug &&
          entry.entryType === target.kind &&
          entry.label === target.label &&
          entry.reading === (target.reading ?? "")
      );

      if (candidates.length === 0) {
        continue;
      }

      if (candidates.length > 1) {
        ambiguous += 1;
        console.info(
          `  ambiguous ${target.kind}:${target.id} -> ${candidates
            .map((candidate) => `${candidate.mediaSlug}:${candidate.entryId}`)
            .join(", ")}`
        );
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
        bundle.mediaDirectory,
        targetRelativePath
      ).absolutePath;

      if (!options.dryRun) {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await copyFile(sourcePath, targetPath);
      }

      manifestEntries.set(`${target.kind}:${target.id}`, {
        entryId: target.id,
        entryType: target.kind,
        audioAttribution: source.audioAttribution ?? undefined,
        audioLicense: source.audioLicense ?? undefined,
        audioPageUrl: source.audioPageUrl ?? undefined,
        audioSource: source.audioSource ?? undefined,
        audioSpeaker: source.audioSpeaker ?? undefined,
        audioSrc: targetRelativePath
      });
      reused += 1;

      console.info(
        `  reused ${target.kind}:${target.id} <- ${source.mediaSlug}:${source.entryId}`
      );
    }

    if (!options.dryRun) {
      const manifestPath = path.join(bundle.mediaDirectory, "pronunciations.json");
      await writeFile(
        manifestPath,
        serializePronunciationManifest({
          entries: [...manifestEntries.values()],
          version: 1
        })
      );

      const pendingSummary = await writeBundlePronunciationPendingSummary({
        bundle,
        knownMissingPath: path.resolve(options.knownMissingPath)
      });

      console.info(
        `${bundle.mediaSlug}: reused=${reused} ambiguous=${ambiguous} pending=${pendingSummary.pendingCount}`
      );
    } else {
      console.info(`${bundle.mediaSlug}: reused=${reused} ambiguous=${ambiguous}`);
    }
  }
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    contentRoot: "content",
    dryRun: false,
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    mediaSlugs: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--content-root") {
      options.contentRoot = argv[index + 1] ?? options.contentRoot;
      index += 1;
      continue;
    }

    if (argument === "--media") {
      const mediaSlug = argv[index + 1];

      if (mediaSlug) {
        options.mediaSlugs.push(mediaSlug);
      }

      index += 1;
      continue;
    }

    if (argument === "--known-missing-file") {
      options.knownMissingPath = argv[index + 1] ?? options.knownMissingPath;
      index += 1;
      continue;
    }

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
  }

  return options;
}

async function collectAudioBackedEntries(
  bundles: NormalizedMediaBundle[]
) {
  const entries: AudioBackedEntry[] = [];

  for (const bundle of bundles) {
    const manifest = await loadPronunciationManifest(bundle.mediaDirectory);
    const manifestEntries = new Map(
      (manifest.manifest?.entries ?? []).map((entry) => [
        `${entry.entryType}:${entry.entryId}`,
        entry
      ])
    );

    for (const target of bundle.terms) {
      const manifestEntry = manifestEntries.get(`term:${target.id}`);
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
        entryId: target.id,
        entryType: "term",
        label: target.lemma,
        mediaDirectory: bundle.mediaDirectory,
        mediaSlug: bundle.mediaSlug,
        reading: target.reading
      });
    }

    for (const target of bundle.grammarPatterns) {
      const manifestEntry = manifestEntries.get(`grammar:${target.id}`);
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
        entryId: target.id,
        entryType: "grammar",
        label: target.pattern,
        mediaDirectory: bundle.mediaDirectory,
        mediaSlug: bundle.mediaSlug,
        reading: target.reading ?? ""
      });
    }
  }

  return entries;
}

function buildTargetAudioPath(
  entryType: "term" | "grammar",
  entryId: string,
  sourceAudioSrc: string
) {
  return `assets/audio/${entryType}/${entryId}/${path.basename(sourceAudioSrc)}`;
}

import { access, readFile } from "node:fs/promises";
import path from "node:path";

import {
  isSupportedAudioAssetPath,
  isValidMediaAssetPath,
  isWithinMediaAssetRoot,
  resolveMediaAssetAbsolutePath
} from "../media-assets.ts";
import type {
  EntryAudioMetadata,
  NormalizedGrammarPattern,
  NormalizedTerm,
  SourceRange,
  ValidationIssue
} from "./types.ts";
import { createIssue, isRecord } from "./parser/utils.ts";

const pronunciationManifestFileName = "pronunciations.json";

type ManifestEntryType = "term" | "grammar";

export type PronunciationManifestEntry = EntryAudioMetadata & {
  entryId: string;
  entryType: ManifestEntryType;
};

export interface PronunciationManifest {
  sourceFile: string;
  entries: PronunciationManifestEntry[];
}

export async function loadPronunciationManifest(
  mediaDirectory: string
): Promise<{
  issues: ValidationIssue[];
  manifest: PronunciationManifest | null;
}> {
  const sourceFile = path.join(mediaDirectory, pronunciationManifestFileName);

  try {
    const raw = await readFile(sourceFile, "utf8");
    return parsePronunciationManifest({
      mediaDirectory,
      sourceFile,
      sourceText: raw
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return {
        issues: [],
        manifest: null
      };
    }

    return {
      issues: [
        createIssue({
          code: "pronunciation-manifest.unreadable",
          category: "integrity",
          filePath: sourceFile,
          message: "Pronunciation manifest could not be read.",
          hint: "Check file permissions or remove the broken pronunciations.json file.",
          details: {
            error:
              error instanceof Error && error.message.length > 0
                ? error.message
                : String(error)
          }
        })
      ],
      manifest: null
    };
  }
}

export function applyPronunciationManifest(input: {
  grammarPatterns: NormalizedGrammarPattern[];
  issues: ValidationIssue[];
  manifest: PronunciationManifest | null;
  terms: NormalizedTerm[];
}) {
  if (!input.manifest) {
    return;
  }

  const termById = new Map(input.terms.map((entry) => [entry.id, entry]));
  const grammarById = new Map(
    input.grammarPatterns.map((entry) => [entry.id, entry])
  );

  for (const record of input.manifest.entries) {
    const target =
      record.entryType === "term"
        ? termById.get(record.entryId)
        : grammarById.get(record.entryId);

    if (!target) {
      input.issues.push(
        createIssue({
          code: "pronunciation-manifest.unknown-entry",
          category: "reference",
          filePath: input.manifest.sourceFile,
          message:
            "Pronunciation manifest entry points to a glossary entry that does not exist in this media bundle.",
          path: `entries.${record.entryType}.${record.entryId}`,
          hint: "Use the local editorial source id from a :::term or :::grammar block."
        })
      );
      continue;
    }

    target.audio = mergeEntryAudio(target.audio, record);
  }
}

export function serializePronunciationManifest(manifest: {
  entries: PronunciationManifestEntry[];
  version: number;
}) {
  const sortedEntries = [...manifest.entries].sort((left, right) => {
    if (left.entryType !== right.entryType) {
      return left.entryType.localeCompare(right.entryType);
    }

    return left.entryId.localeCompare(right.entryId);
  });

  return `${JSON.stringify(
    {
      version: manifest.version,
      entries: sortedEntries.map((entry) => ({
        entry_type: entry.entryType,
        entry_id: entry.entryId,
        audio_src: entry.audioSrc,
        audio_source: entry.audioSource,
        audio_speaker: entry.audioSpeaker,
        audio_license: entry.audioLicense,
        audio_attribution: entry.audioAttribution,
        audio_page_url: entry.audioPageUrl
      }))
    },
    null,
    2
  )}\n`;
}

async function parsePronunciationManifest(input: {
  mediaDirectory: string;
  sourceFile: string;
  sourceText: string;
}): Promise<{
  issues: ValidationIssue[];
  manifest: PronunciationManifest | null;
}> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input.sourceText);
  } catch (error) {
    return {
      issues: [
        createIssue({
          code: "pronunciation-manifest.invalid-json",
          category: "syntax",
          filePath: input.sourceFile,
          message: "Pronunciation manifest must contain valid JSON.",
          hint: "Use a JSON object with a numeric version and an entries array.",
          details: {
            error:
              error instanceof Error && error.message.length > 0
                ? error.message
                : String(error)
          }
        })
      ],
      manifest: null
    };
  }

  if (!isRecord(parsed)) {
    return {
      issues: [
        createIssue({
          code: "pronunciation-manifest.invalid-root",
          category: "schema",
          filePath: input.sourceFile,
          message: "Pronunciation manifest root must be a JSON object.",
          hint: "Use { \"version\": 1, \"entries\": [...] }."
        })
      ],
      manifest: null
    };
  }

  const version = parsed.version;
  const entries = parsed.entries;
  const issues: ValidationIssue[] = [];

  if (version !== 1) {
    issues.push(
      createIssue({
        code: "pronunciation-manifest.invalid-version",
        category: "schema",
        filePath: input.sourceFile,
        message: "Pronunciation manifest version must be 1.",
        path: "version"
      })
    );
  }

  if (!Array.isArray(entries)) {
    issues.push(
      createIssue({
        code: "pronunciation-manifest.invalid-entries",
        category: "schema",
        filePath: input.sourceFile,
        message: "Pronunciation manifest entries must be an array.",
        path: "entries"
      })
    );

    return {
      issues,
      manifest: null
    };
  }

  const seenKeys = new Set<string>();
  const manifestEntries: PronunciationManifestEntry[] = [];

  for (const [index, value] of entries.entries()) {
    const entry = await parseManifestEntry({
      index,
      mediaDirectory: input.mediaDirectory,
      sourceFile: input.sourceFile,
      value
    });

    issues.push(...entry.issues);

    if (!entry.value) {
      continue;
    }

    const entryKey = `${entry.value.entryType}:${entry.value.entryId}`;

    if (seenKeys.has(entryKey)) {
      issues.push(
        createIssue({
          code: "pronunciation-manifest.duplicate-entry",
          category: "schema",
          filePath: input.sourceFile,
          message:
            "Pronunciation manifest contains the same glossary entry more than once.",
          path: `entries[${index}]`,
          hint: "Keep a single manifest row per entry_type + entry_id pair."
        })
      );
      continue;
    }

    seenKeys.add(entryKey);
    manifestEntries.push(entry.value);
  }

  return {
    issues,
    manifest:
      issues.some((issue) => issue.category === "syntax")
        ? null
        : {
            sourceFile: input.sourceFile,
            entries: manifestEntries
          }
  };
}

async function parseManifestEntry(input: {
  index: number;
  mediaDirectory: string;
  sourceFile: string;
  value: unknown;
}): Promise<{
  issues: ValidationIssue[];
  value: PronunciationManifestEntry | null;
}> {
  const scope = `entries[${input.index}]`;

  if (!isRecord(input.value)) {
    return {
      issues: [
        createIssue({
          code: "pronunciation-manifest.invalid-entry",
          category: "schema",
          filePath: input.sourceFile,
          message: "Each pronunciation manifest entry must be a JSON object.",
          path: scope
        })
      ],
      value: null
    };
  }

  const entryType = asEntryType(input.value.entry_type);
  const entryId = asTrimmedString(input.value.entry_id);
  const audio = await normalizeEntryAudioMetadata({
    filePath: input.sourceFile,
    mediaDirectory: input.mediaDirectory,
    range: undefined,
    sourcePath: scope,
    values: input.value
  });

  const issues = [...audio.issues];

  if (!entryType) {
    issues.push(
      createIssue({
        code: "pronunciation-manifest.invalid-entry-type",
        category: "schema",
        filePath: input.sourceFile,
        message: "Pronunciation manifest entry_type must be 'term' or 'grammar'.",
        path: `${scope}.entry_type`
      })
    );
  }

  if (!entryId) {
    issues.push(
      createIssue({
        code: "pronunciation-manifest.missing-entry-id",
        category: "schema",
        filePath: input.sourceFile,
        message: "Pronunciation manifest entry_id is required.",
        path: `${scope}.entry_id`
      })
    );
  }

  if (!entryType || !entryId || !audio.value) {
    return {
      issues,
      value: null
    };
  }

  return {
    issues,
    value: {
      ...audio.value,
      entryId,
      entryType
    }
  };
}

export async function normalizeEntryAudioMetadata(input: {
  filePath: string;
  mediaDirectory: string;
  range?: SourceRange;
  sourcePath: string;
  values: Record<string, unknown>;
}): Promise<{
  issues: ValidationIssue[];
  value: EntryAudioMetadata | null;
}> {
  const audioSrc = asTrimmedString(input.values.audio_src);
  const audioSource = asTrimmedString(input.values.audio_source);
  const audioSpeaker = asTrimmedString(input.values.audio_speaker);
  const audioLicense = asTrimmedString(input.values.audio_license);
  const audioAttribution = asTrimmedString(input.values.audio_attribution);
  const audioPageUrl = asTrimmedString(input.values.audio_page_url);
  const issues: ValidationIssue[] = [];
  const hasAudioMetadata =
    audioSrc !== null ||
    audioSource !== null ||
    audioSpeaker !== null ||
    audioLicense !== null ||
    audioAttribution !== null ||
    audioPageUrl !== null;

  if (!hasAudioMetadata) {
    return {
      issues,
      value: null
    };
  }

  if (!audioSrc) {
    issues.push(
      createIssue({
        code: "audio.missing-src",
        category: "schema",
        filePath: input.filePath,
        message: "Audio metadata requires audio_src.",
        path: `${input.sourcePath}.audio_src`,
        range: input.range,
        hint: "Point audio_src to a local file under assets/audio/."
      })
    );

    return {
      issues,
      value: null
    };
  }

  if (!isValidMediaAssetPath(audioSrc) || !audioSrc.startsWith("assets/")) {
    issues.push(
      createIssue({
        code: "audio.invalid-src",
        category: "schema",
        filePath: input.filePath,
        message:
          "Audio src must be a relative media asset path rooted at assets/.",
        path: `${input.sourcePath}.audio_src`,
        range: input.range,
        hint: "Use paths like assets/audio/term-taberu/term-taberu.ogg."
      })
    );
  } else if (!isSupportedAudioAssetPath(audioSrc)) {
    issues.push(
      createIssue({
        code: "audio.unsupported-extension",
        category: "schema",
        filePath: input.filePath,
        message: "Audio src must point to a supported audio format.",
        path: `${input.sourcePath}.audio_src`,
        range: input.range,
        hint: "Use mp3, ogg, wav, or m4a files."
      })
    );
  } else {
    const resolved = resolveMediaAssetAbsolutePath(input.mediaDirectory, audioSrc);

    if (!isWithinMediaAssetRoot(resolved.assetRoot, resolved.absolutePath)) {
      issues.push(
        createIssue({
          code: "audio.invalid-src",
          category: "schema",
          filePath: input.filePath,
          message:
            "Audio src escapes the media asset directory and is not allowed.",
          path: `${input.sourcePath}.audio_src`,
          range: input.range
        })
      );
    } else if (!(await fileExists(resolved.absolutePath))) {
      issues.push(
        createIssue({
          code: "audio.missing-asset",
          category: "integrity",
          filePath: input.filePath,
          message: `Audio asset '${audioSrc}' does not exist in this media bundle.`,
          path: `${input.sourcePath}.audio_src`,
          range: input.range,
          hint: "Add the file under content/media/<slug>/assets/audio/ or fix the path."
        })
      );
    }
  }

  if (audioPageUrl && !isHttpUrl(audioPageUrl)) {
    issues.push(
      createIssue({
        code: "audio.invalid-page-url",
        category: "schema",
        filePath: input.filePath,
        message: "Audio page URL must be an absolute http or https URL.",
        path: `${input.sourcePath}.audio_page_url`,
        range: input.range
      })
    );
  }

  if (issues.length > 0) {
    return {
      issues,
      value: null
    };
  }

  return {
    issues,
    value: {
      audioSrc,
      audioSource: audioSource ?? undefined,
      audioSpeaker: audioSpeaker ?? undefined,
      audioLicense: audioLicense ?? undefined,
      audioAttribution: audioAttribution ?? undefined,
      audioPageUrl: audioPageUrl ?? undefined
    }
  };
}

export function mergeEntryAudio(
  currentAudio: EntryAudioMetadata | undefined,
  incomingAudio: EntryAudioMetadata
): EntryAudioMetadata {
  return {
    audioSrc: currentAudio?.audioSrc ?? incomingAudio.audioSrc,
    audioSource: currentAudio?.audioSource ?? incomingAudio.audioSource,
    audioSpeaker: currentAudio?.audioSpeaker ?? incomingAudio.audioSpeaker,
    audioLicense: currentAudio?.audioLicense ?? incomingAudio.audioLicense,
    audioAttribution:
      currentAudio?.audioAttribution ?? incomingAudio.audioAttribution,
    audioPageUrl: currentAudio?.audioPageUrl ?? incomingAudio.audioPageUrl
  };
}

function asTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asEntryType(value: unknown): ManifestEntryType | null {
  return value === "term" || value === "grammar" ? value : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildForvoSearchQueries } from "./forvo-pronunciation-helpers.ts";
import { stripInlineMarkdown } from "./inline-markdown.ts";

const forvoWordAddLanguageCode = "ja";
const phraseMarkerPattern = /[〜～~]/u;
const phrasePunctuationPattern = /[!?！？。]/u;
const phraseWhitespacePattern = /\s/u;
const forvoWordAddSlashPattern = /\s*\/\s*/gu;
const forvoWordAddMarkerPattern = /[〜～~]/gu;
const japaneseScriptPattern = /[ぁ-ゟ゠-ヿ一-龯々〆ヶ]/u;
const latinLetterPattern = /[a-z]/iu;

export type ForvoWordAddRequestEntry = {
  entryId: string;
  entryKind: "term" | "grammar";
  label: string;
  mediaSlug: string;
  reading?: string;
  requestUrl: string;
  resolvedAt?: string;
  resolvedAudioSource?: string;
  resolvedAudioSrc?: string;
  requestedAt: string;
};

export type ForvoWordAddRequestRegistry = {
  version: 1;
  entries: ForvoWordAddRequestEntry[];
};

export type ForvoWordAddPrefill = {
  autoSubmit: boolean;
  isPersonalName: boolean;
  isPhrase: boolean;
  languageCode: "ja";
};

type ForvoWordAddEntryLike = {
  entryId?: string;
  entryKind?: "term" | "grammar";
  label: string;
  reading?: string;
};

export function buildForvoWordAddPrefill(
  input: ForvoWordAddEntryLike
): ForvoWordAddPrefill {
  const requestLabel = buildForvoWordAddRequestLabel(input);
  const phraseInput =
    requestLabel && hasLatinLetters(input.label)
      ? {
          ...input,
          label: requestLabel,
          reading: requestLabel
        }
      : input;

  return {
    autoSubmit: true,
    isPersonalName: false,
    isPhrase: inferForvoWordAddPhrase(phraseInput),
    languageCode: forvoWordAddLanguageCode
  };
}

export function buildForvoWordAddUrl(input: ForvoWordAddEntryLike) {
  const requestLabel = buildForvoWordAddRequestLabel(input);

  if (!requestLabel) {
    return null;
  }

  const prefill = buildForvoWordAddPrefill(input);
  const url = new URL(
    `/word-add/${encodeURIComponent(requestLabel)}/`,
    "https://forvo.com"
  );

  url.searchParams.set("jcs_lang", prefill.languageCode);
  url.searchParams.set("jcs_phrase", prefill.isPhrase ? "1" : "0");
  url.searchParams.set("jcs_autosubmit", prefill.autoSubmit ? "1" : "0");
  url.searchParams.set("jcs_person_name", prefill.isPersonalName ? "1" : "0");

  return url.toString();
}

export function buildForvoWordAddRequestLabel(input: ForvoWordAddEntryLike) {
  const normalizedLabel = normalizeForvoWordAddLabel(input.label);

  if (
    normalizedLabel &&
    japaneseScriptPattern.test(normalizedLabel) &&
    !hasLatinLetters(normalizedLabel) &&
    input.entryKind !== "grammar"
  ) {
    return normalizedLabel;
  }

  const requestLabel = buildForvoSearchQueries({
    aliases: [],
    id: input.entryId ?? "",
    kind: input.entryKind ?? "term",
    label: input.label,
    mediaDirectory: "",
    mediaSlug: "",
    reading: input.reading
  }).at(0);

  return requestLabel ? normalizeForvoWordAddLabel(requestLabel) : null;
}

export function normalizeForvoWordAddLabel(label: string) {
  return stripInlineMarkdown(label)
    .replace(forvoWordAddMarkerPattern, "")
    .replace(forvoWordAddSlashPattern, "・")
    .replace(/\s+/gu, " ")
    .trim();
}

export async function loadForvoWordAddRequestRegistry(filePath?: string) {
  if (!filePath) {
    return {
      entries: [],
      version: 1
    } satisfies ForvoWordAddRequestRegistry;
  }

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ForvoWordAddRequestRegistry>;

    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries
            .map((entry) => normalizeForvoWordAddRequestEntry(entry))
            .filter(
              (entry): entry is ForvoWordAddRequestEntry => entry !== null
            )
        : [],
      version: 1
    } satisfies ForvoWordAddRequestRegistry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        entries: [],
        version: 1
      } satisfies ForvoWordAddRequestRegistry;
    }

    throw error;
  }
}

export async function persistForvoWordAddRequestRegistry(
  filePath: string | undefined,
  registry: ForvoWordAddRequestRegistry
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
        entries: [...registry.entries].sort((left, right) => {
          const mediaDelta = left.mediaSlug.localeCompare(right.mediaSlug);

          if (mediaDelta !== 0) {
            return mediaDelta;
          }

          const kindDelta = left.entryKind.localeCompare(right.entryKind);

          if (kindDelta !== 0) {
            return kindDelta;
          }

          return left.entryId.localeCompare(right.entryId);
        })
      },
      null,
      2
    )}\n`
  );
}

export function hasForvoWordAddRequestForEntry(
  registry: ForvoWordAddRequestRegistry,
  input: {
    entryId: string;
    entryKind: "term" | "grammar";
    mediaSlug: string;
  }
) {
  return registry.entries.some(
    (candidate) =>
      candidate.mediaSlug === input.mediaSlug &&
      candidate.entryKind === input.entryKind &&
      candidate.entryId === input.entryId
  );
}

export function hasCurrentForvoWordAddRequestForEntry(
  registry: ForvoWordAddRequestRegistry,
  input: {
    entryId: string;
    entryKind: "term" | "grammar";
    label: string;
    mediaSlug: string;
    reading?: string;
  }
) {
  const requestUrl = buildForvoWordAddUrl(input);

  if (!requestUrl) {
    return false;
  }

  return registry.entries.some(
    (candidate) =>
      candidate.mediaSlug === input.mediaSlug &&
      candidate.entryKind === input.entryKind &&
      candidate.entryId === input.entryId &&
      candidate.requestUrl === requestUrl
  );
}

export function addForvoWordAddRequestEntry(
  registry: ForvoWordAddRequestRegistry,
  input: {
    entryId: string;
    entryKind: "term" | "grammar";
    label: string;
    mediaSlug: string;
    reading?: string;
  }
) {
  const requestUrl = buildForvoWordAddUrl({
    entryId: input.entryId,
    entryKind: input.entryKind,
    label: input.label,
    reading: input.reading
  });

  if (!requestUrl) {
    return false;
  }

  const existing = registry.entries.find(
    (candidate) =>
      candidate.mediaSlug === input.mediaSlug &&
      candidate.entryKind === input.entryKind &&
      candidate.entryId === input.entryId
  );

  if (existing) {
    if (existing.resolvedAt || existing.requestUrl === requestUrl) {
      return false;
    }

    existing.label = input.label;
    existing.reading = input.reading;
    existing.requestUrl = requestUrl;
    existing.requestedAt = new Date().toISOString();
    return true;
  }

  registry.entries.push({
    entryId: input.entryId,
    entryKind: input.entryKind,
    label: input.label,
    mediaSlug: input.mediaSlug,
    reading: input.reading,
    requestUrl,
    requestedAt: new Date().toISOString()
  });

  return true;
}

export function reconcileForvoWordAddRequestRegistry(
  registry: ForvoWordAddRequestRegistry,
  resolvedEntries: Array<{
    audioSource?: string;
    audioSrc?: string;
    entryId: string;
    entryKind: "term" | "grammar";
    mediaSlug: string;
  }>
) {
  let changed = 0;
  const resolvedAt = new Date().toISOString();

  for (const resolvedEntry of resolvedEntries) {
    if (!resolvedEntry.audioSrc) {
      continue;
    }

    const match = registry.entries.find(
      (candidate) =>
        candidate.mediaSlug === resolvedEntry.mediaSlug &&
        candidate.entryKind === resolvedEntry.entryKind &&
        candidate.entryId === resolvedEntry.entryId
    );

    if (!match) {
      continue;
    }

    const nextResolvedAt = match.resolvedAt ?? resolvedAt;
    const nextResolvedAudioSource =
      resolvedEntry.audioSource ?? match.resolvedAudioSource;
    const nextResolvedAudioSrc =
      resolvedEntry.audioSrc ?? match.resolvedAudioSrc;

    if (
      match.resolvedAt === nextResolvedAt &&
      match.resolvedAudioSource === nextResolvedAudioSource &&
      match.resolvedAudioSrc === nextResolvedAudioSrc
    ) {
      continue;
    }

    match.resolvedAt = nextResolvedAt;
    match.resolvedAudioSource = nextResolvedAudioSource;
    match.resolvedAudioSrc = nextResolvedAudioSrc;
    changed += 1;
  }

  return changed;
}

function inferForvoWordAddPhrase(input: ForvoWordAddEntryLike) {
  if (input.entryKind === "grammar") {
    return true;
  }

  const normalizedLabel = input.label.normalize("NFKC").trim();
  const normalizedReading = input.reading?.normalize("NFKC").trim() ?? "";

  if (
    phraseMarkerPattern.test(normalizedLabel) ||
    phraseMarkerPattern.test(normalizedReading) ||
    phrasePunctuationPattern.test(normalizedLabel) ||
    phrasePunctuationPattern.test(normalizedReading) ||
    phraseWhitespacePattern.test(normalizedLabel) ||
    phraseWhitespacePattern.test(normalizedReading)
  ) {
    return true;
  }

  if (typeof input.entryId === "string" && input.entryId.startsWith("term-e")) {
    return true;
  }

  return false;
}

function hasLatinLetters(value: string) {
  return latinLetterPattern.test(value.normalize("NFKC"));
}

function normalizeForvoWordAddRequestEntry(
  entry: unknown
): ForvoWordAddRequestEntry | null {
  const record =
    typeof entry === "object" && entry !== null
      ? (entry as Partial<ForvoWordAddRequestEntry>)
      : null;

  if (!record) {
    return null;
  }

  const entryKind =
    record.entryKind === "term" || record.entryKind === "grammar"
      ? record.entryKind
      : null;
  const entryId =
    typeof record.entryId === "string" && record.entryId.trim().length > 0
      ? record.entryId
      : null;
  const mediaSlug =
    typeof record.mediaSlug === "string" && record.mediaSlug.trim().length > 0
      ? record.mediaSlug
      : null;

  if (!entryKind || !entryId || !mediaSlug) {
    return null;
  }

  return {
    entryId,
    entryKind,
    label: typeof record.label === "string" ? record.label : "",
    mediaSlug,
    reading: typeof record.reading === "string" ? record.reading : undefined,
    requestUrl: typeof record.requestUrl === "string" ? record.requestUrl : "",
    requestedAt:
      typeof record.requestedAt === "string" ? record.requestedAt : "",
    resolvedAt:
      typeof record.resolvedAt === "string" ? record.resolvedAt : undefined,
    resolvedAudioSource:
      typeof record.resolvedAudioSource === "string"
        ? record.resolvedAudioSource
        : undefined,
    resolvedAudioSrc:
      typeof record.resolvedAudioSrc === "string"
        ? record.resolvedAudioSrc
        : undefined
  };
}

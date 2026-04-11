import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const forvoWordAddLanguageCode = "ja";
const phraseMarkerPattern = /[〜～~]/u;
const phrasePunctuationPattern = /[!?！？。]/u;
const phraseWhitespacePattern = /\s/u;

export type ForvoWordAddRequestEntry = {
  entryId: string;
  entryKind: "term" | "grammar";
  label: string;
  mediaSlug: string;
  reading?: string;
  requestUrl: string;
  requestedAt: string;
};

export type ForvoWordAddRequestRegistry = {
  version: 1;
  entries: ForvoWordAddRequestEntry[];
};

export type ForvoWordAddPrefill = {
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
  return {
    isPersonalName: false,
    isPhrase: inferForvoWordAddPhrase(input),
    languageCode: forvoWordAddLanguageCode
  };
}

export function buildForvoWordAddUrl(input: ForvoWordAddEntryLike) {
  const prefill = buildForvoWordAddPrefill(input);
  const url = new URL(
    `/word-add/${encodeURIComponent(input.label)}/`,
    "https://forvo.com"
  );

  url.searchParams.set("jcs_lang", prefill.languageCode);
  url.searchParams.set("jcs_phrase", prefill.isPhrase ? "1" : "0");
  url.searchParams.set(
    "jcs_person_name",
    prefill.isPersonalName ? "1" : "0"
  );

  return url.toString();
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
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
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
        entries: registry.entries.sort((left, right) => {
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
  if (
    hasForvoWordAddRequestForEntry(registry, {
      entryId: input.entryId,
      entryKind: input.entryKind,
      mediaSlug: input.mediaSlug
    })
  ) {
    return false;
  }

  registry.entries.push({
    entryId: input.entryId,
    entryKind: input.entryKind,
    label: input.label,
    mediaSlug: input.mediaSlug,
    reading: input.reading,
    requestUrl: buildForvoWordAddUrl({
      entryId: input.entryId,
      entryKind: input.entryKind,
      label: input.label,
      reading: input.reading
    }),
    requestedAt: new Date().toISOString()
  });

  return true;
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

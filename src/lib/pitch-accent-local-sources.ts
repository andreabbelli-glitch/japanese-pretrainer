import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { normalizePronunciationText } from "./pronunciation-shared.ts";

export type LocalPitchAccentSourceKey = "kanjium" | "shirabe";
export type PitchAccentMatchType = "exact" | "fuzzy";

export type LocalPitchAccentTarget = {
  aliases: string[];
  label: string;
  reading?: string;
};

export type LocalPitchAccentCandidate = {
  matchType: PitchAccentMatchType;
  pageUrl: string;
  pitchAccents: number[];
  query: string;
  reading: string;
  sourceKey: LocalPitchAccentSourceKey;
  sourceLabel: string;
  surface: string;
};

type LocalPitchAccentIndexEntry = {
  pitchAccents: number[];
  reading: string;
  surface: string;
};

type LocalPitchAccentIndex = {
  byExactKey: Map<string, LocalPitchAccentIndexEntry[]>;
  byReadingKey: Map<string, LocalPitchAccentIndexEntry[]>;
};

const KANJIUM_PAGE_URL =
  "https://github.com/mifunetoshiro/kanjium/blob/master/data/source_files/raw/accents.txt";
const SHIRABE_PAGE_URL = "https://shirabe.app/";
const DEFAULT_KANJIUM_DATA_PATH = path.resolve(
  process.cwd(),
  "data",
  "pitch-accents",
  "kanjium-accents.txt"
);
const DEFAULT_SHIRABE_APP_PATHS = [
  process.env.SHIRABE_JISHO_APP_PATH,
  "/Applications/Shirabe Jisho\nJapanese.app",
  "/Applications/Shirabe Jisho Japanese.app",
  "/Applications/Shirabe Jisho.app"
].filter((value): value is string => Boolean(value));

const kanjiumIndexCache = new Map<string, Promise<LocalPitchAccentIndex>>();
const shirabeIndexCache = new Map<string, Promise<LocalPitchAccentIndex>>();

export async function lookupKanjiumPitchAccents(input: {
  dataPath?: string;
  entry: LocalPitchAccentTarget;
}) {
  const dataPath = path.resolve(input.dataPath ?? DEFAULT_KANJIUM_DATA_PATH);
  const index = await loadKanjiumPitchAccentIndex(dataPath);

  return lookupLocalPitchAccentCandidates({
    entry: input.entry,
    index,
    pageUrl: KANJIUM_PAGE_URL,
    sourceKey: "kanjium",
    sourceLabel: "Kanjium"
  });
}

export async function lookupShirabePitchAccents(input: {
  appPath?: string;
  entry: LocalPitchAccentTarget;
}) {
  const dictPath = await resolveShirabeDictPath(input.appPath);

  if (!dictPath) {
    return [];
  }

  const index = await loadShirabePitchAccentIndex(dictPath);

  return lookupLocalPitchAccentCandidates({
    entry: input.entry,
    index,
    pageUrl: SHIRABE_PAGE_URL,
    sourceKey: "shirabe",
    sourceLabel: "Shirabe Jisho"
  });
}

async function loadKanjiumPitchAccentIndex(dataPath: string) {
  let cached = kanjiumIndexCache.get(dataPath);

  if (!cached) {
    cached = readFile(dataPath, "utf8").then(parseKanjiumPitchAccentIndex);
    kanjiumIndexCache.set(dataPath, cached);
  }

  return await cached;
}

async function loadShirabePitchAccentIndex(dictPath: string) {
  let cached = shirabeIndexCache.get(dictPath);

  if (!cached) {
    cached = readFile(dictPath).then(parseShirabePitchAccentIndex);
    shirabeIndexCache.set(dictPath, cached);
  }

  return await cached;
}

function parseKanjiumPitchAccentIndex(source: string): LocalPitchAccentIndex {
  const entries: LocalPitchAccentIndexEntry[] = [];

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const [surface, reading, accents] = trimmed
      .split("\t")
      .map((part) => part.trim());
    const pitchAccents = parsePitchAccentList(accents);

    if (!surface || !reading || pitchAccents.length === 0) {
      continue;
    }

    entries.push({
      pitchAccents,
      reading,
      surface
    });
  }

  return buildLocalPitchAccentIndex(entries);
}

function parseShirabePitchAccentIndex(data: Buffer): LocalPitchAccentIndex {
  const entries: LocalPitchAccentIndexEntry[] = [];

  for (let offset = 0; offset < data.length - 5; offset += 1) {
    if (data[offset] !== 0x07) {
      continue;
    }

    const record = parseShirabeRecord(data, offset + 5);

    if (!record) {
      continue;
    }

    for (const surface of record.surfaces) {
      for (const reading of record.readings) {
        if (reading.pitchAccents.length === 0) {
          continue;
        }

        entries.push({
          pitchAccents: reading.pitchAccents,
          reading: reading.text,
          surface
        });
      }
    }

    offset = Math.max(offset, record.endOffset - 1);
  }

  return buildLocalPitchAccentIndex(entries);
}

function parseShirabeRecord(data: Buffer, startOffset: number) {
  const surfaces: string[] = [];
  const readings: Array<{ pitchAccents: number[]; text: string }> = [];
  let cursor = startOffset;
  const maxOffset = Math.min(data.length, startOffset + 4096);

  while (cursor < maxOffset) {
    const tag = data[cursor];

    if (tag === 0x01 || tag === 0x02) {
      if (cursor + 4 > data.length) {
        return null;
      }

      const byteLength = data.readUInt16LE(cursor + 2);
      const textStart = cursor + 4;
      const textEnd = textStart + byteLength;

      if (
        byteLength <= 0 ||
        byteLength > 256 ||
        textEnd > data.length ||
        byteLength % 2 !== 0
      ) {
        return null;
      }

      const text = data.toString("utf16le", textStart, textEnd).trim();

      if (!isPlausibleShirabeText(text)) {
        return null;
      }

      if (tag === 0x01) {
        surfaces.push(text);
      } else {
        readings.push({
          pitchAccents: [],
          text
        });
      }

      cursor = textEnd;
      continue;
    }

    if (tag === 0x09) {
      if (cursor + 2 > data.length || readings.length === 0) {
        return null;
      }

      const pitchAccent = data[cursor + 1];

      if (Number.isInteger(pitchAccent) && pitchAccent >= 0) {
        const lastReading = readings[readings.length - 1]!;
        if (!lastReading.pitchAccents.includes(pitchAccent)) {
          lastReading.pitchAccents.push(pitchAccent);
        }
      }

      cursor += 2;
      continue;
    }

    if (tag === 0x05) {
      return surfaces.length > 0 && readings.length > 0
        ? {
            endOffset: cursor + 1,
            readings,
            surfaces
          }
        : null;
    }

    if (tag !== undefined && tag >= 0x80 && tag <= 0x8f) {
      if (cursor + 3 > data.length) {
        return null;
      }

      const byteLength = data.readUInt16LE(cursor + 1);
      const nextCursor = cursor + 3 + byteLength;

      if (byteLength < 0 || byteLength > 1024 || nextCursor > data.length) {
        return null;
      }

      cursor = nextCursor;
      continue;
    }

    return null;
  }

  return null;
}

function buildLocalPitchAccentIndex(
  entries: LocalPitchAccentIndexEntry[]
): LocalPitchAccentIndex {
  const byExactKey = new Map<string, LocalPitchAccentIndexEntry[]>();
  const byReadingKey = new Map<string, LocalPitchAccentIndexEntry[]>();

  for (const entry of entries) {
    addLocalPitchAccentIndexEntry(
      byExactKey,
      exactKey(entry.surface, entry.reading),
      entry
    );
    addLocalPitchAccentIndexEntry(byReadingKey, textKey(entry.reading), entry);
  }

  return {
    byExactKey,
    byReadingKey
  };
}

function lookupLocalPitchAccentCandidates(input: {
  entry: LocalPitchAccentTarget;
  index: LocalPitchAccentIndex;
  pageUrl: string;
  sourceKey: LocalPitchAccentSourceKey;
  sourceLabel: string;
}): LocalPitchAccentCandidate[] {
  const readings = splitLookupVariants(input.entry.reading);
  const surfaces = dedupeLookupValues([
    input.entry.label,
    ...input.entry.aliases
  ]);
  const exact: LocalPitchAccentCandidate[] = [];

  for (const surface of surfaces) {
    for (const reading of readings) {
      const matches =
        input.index.byExactKey.get(exactKey(surface, reading)) ?? [];

      for (const match of matches) {
        exact.push(
          mapLocalIndexEntryToCandidate({
            entry: match,
            matchType: "exact",
            pageUrl: input.pageUrl,
            sourceKey: input.sourceKey,
            sourceLabel: input.sourceLabel
          })
        );
      }
    }
  }

  if (exact.length > 0) {
    return dedupeLocalPitchAccentCandidates(exact);
  }

  const fuzzy: LocalPitchAccentCandidate[] = [];

  for (const reading of readings) {
    const matches = input.index.byReadingKey.get(textKey(reading)) ?? [];

    for (const match of matches) {
      if (
        surfaces.some((surface) =>
          isFuzzySurfaceCandidate(surface, match.surface)
        )
      ) {
        fuzzy.push(
          mapLocalIndexEntryToCandidate({
            entry: match,
            matchType: "fuzzy",
            pageUrl: input.pageUrl,
            sourceKey: input.sourceKey,
            sourceLabel: input.sourceLabel
          })
        );
      }
    }
  }

  return dedupeLocalPitchAccentCandidates(fuzzy).slice(0, 8);
}

function mapLocalIndexEntryToCandidate(input: {
  entry: LocalPitchAccentIndexEntry;
  matchType: PitchAccentMatchType;
  pageUrl: string;
  sourceKey: LocalPitchAccentSourceKey;
  sourceLabel: string;
}): LocalPitchAccentCandidate {
  return {
    matchType: input.matchType,
    pageUrl: input.pageUrl,
    pitchAccents: input.entry.pitchAccents,
    query: input.entry.surface,
    reading: input.entry.reading,
    sourceKey: input.sourceKey,
    sourceLabel: input.sourceLabel,
    surface: input.entry.surface
  };
}

function addLocalPitchAccentIndexEntry(
  index: Map<string, LocalPitchAccentIndexEntry[]>,
  key: string,
  entry: LocalPitchAccentIndexEntry
) {
  const entries = index.get(key) ?? [];
  const existing = entries.find(
    (candidate) =>
      textKey(candidate.surface) === textKey(entry.surface) &&
      textKey(candidate.reading) === textKey(entry.reading)
  );

  if (existing) {
    existing.pitchAccents = mergePitchAccentLists(
      existing.pitchAccents,
      entry.pitchAccents
    );
  } else {
    entries.push({
      ...entry,
      pitchAccents: [...entry.pitchAccents]
    });
  }

  index.set(key, entries);
}

function dedupeLocalPitchAccentCandidates(
  candidates: LocalPitchAccentCandidate[]
) {
  const seen = new Set<string>();
  const deduped: LocalPitchAccentCandidate[] = [];

  for (const candidate of candidates) {
    const key = [
      candidate.sourceKey,
      candidate.matchType,
      textKey(candidate.surface),
      textKey(candidate.reading),
      candidate.pitchAccents.join(",")
    ].join("\t");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function parsePitchAccentList(value: string | undefined) {
  if (!value) {
    return [];
  }

  const parsed = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((accent) => Number.isInteger(accent) && accent >= 0);

  return [...new Set(parsed)];
}

function mergePitchAccentLists(left: number[], right: number[]) {
  return [...new Set([...left, ...right])];
}

function splitLookupVariants(value: string | undefined) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\s*[\/／]\s*/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function dedupeLookupValues(values: Array<string | undefined>) {
  const deduped = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim().replace(/^[～〜~]+/u, "");

    if (normalized.length === 0 || !containsJapaneseScript(normalized)) {
      continue;
    }

    deduped.add(normalized);
  }

  return [...deduped];
}

function exactKey(surface: string, reading: string) {
  return `${textKey(surface)}\t${textKey(reading)}`;
}

function textKey(value: string) {
  return normalizePronunciationText(value);
}

function containsJapaneseScript(value: string) {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);
}

function isFuzzySurfaceCandidate(
  targetSurface: string,
  candidateSurface: string
) {
  const targetKey = textKey(targetSurface);
  const candidateKey = textKey(candidateSurface);

  if (targetKey.length === 0 || candidateKey.length === 0) {
    return false;
  }

  if (targetKey === candidateKey) {
    return false;
  }

  if (targetKey.includes(candidateKey) || candidateKey.includes(targetKey)) {
    return true;
  }

  const targetHan = new Set(targetSurface.match(/\p{Script=Han}/gu) ?? []);
  const candidateHan = new Set(
    candidateSurface.match(/\p{Script=Han}/gu) ?? []
  );

  return (
    targetHan.size > 0 &&
    [...targetHan].some((character) => candidateHan.has(character))
  );
}

function isPlausibleShirabeText(value: string) {
  return (
    value.length > 0 &&
    value.length <= 64 &&
    !/[\u0000-\u001f]/u.test(value) &&
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}々〆ヵヶ0-9０-９]/u.test(
      value
    )
  );
}

async function resolveShirabeDictPath(appPath: string | undefined) {
  const candidates = (appPath ? [appPath] : DEFAULT_SHIRABE_APP_PATHS).flatMap(
    (candidate) => buildShirabeDictPathCandidates(candidate)
  );

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next common app bundle layout.
    }
  }

  return null;
}

function buildShirabeDictPathCandidates(candidate: string) {
  return [
    ...(path.basename(candidate) === "dict" ? [candidate] : []),
    path.join(candidate, "Wrapper", "jisho.app", "dict"),
    path.join(candidate, "Contents", "Resources", "dict"),
    path.join(candidate, "dict")
  ];
}

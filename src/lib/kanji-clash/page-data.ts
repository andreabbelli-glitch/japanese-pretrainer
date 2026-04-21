import { db, type DatabaseClient } from "@/db";
import { listMediaCached } from "@/lib/data-cache";
import {
  getStudySettings,
  kanjiClashManualDefaultSizeOptions,
  resolveKanjiClashDefaultScope
} from "@/lib/settings";

import { loadKanjiClashManualContrastPageSnapshot } from "./manual-contrast.ts";
import { getKanjiClashCurrentRound } from "./queue.ts";
import { createKanjiClashQueueToken } from "./queue-token.ts";
import { loadKanjiClashQueueSnapshot } from "./session.ts";
import type {
  KanjiClashPageData,
  KanjiClashPageMediaOption,
  KanjiClashScope,
  KanjiClashSessionMode
} from "./types.ts";

type KanjiClashSearchParams = Record<string, string | string[] | undefined>;

const KANJI_CLASH_MANUAL_QUERY_SIZE_STEP = 10;

export async function getKanjiClashPageData(
  searchParams: KanjiClashSearchParams,
  database: DatabaseClient = db,
  now?: Date
): Promise<KanjiClashPageData> {
  const snapshotAt = now ?? new Date();
  const settingsPromise = getStudySettings(database);
  const mediaRowsPromise = listMediaCached(database);
  const [settings, mediaRows] = await Promise.all([
    settingsPromise,
    mediaRowsPromise
  ]);
  const availableMedia = mediaRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title
  })) satisfies KanjiClashPageMediaOption[];
  const mode = normalizeKanjiClashMode(searchParams.mode);
  const selectedMedia = resolveSelectedMediaOption(
    availableMedia,
    searchParams.media
  );
  const scope = resolvePageScope(
    settings.kanjiClashDefaultScope,
    selectedMedia
  );
  const requestedSize =
    mode === "manual"
      ? resolveManualSessionSize(
          searchParams.size,
          settings.kanjiClashManualDefaultSize
        )
      : null;
  const manualContrastSnapshotPromise = loadKanjiClashManualContrastPageSnapshot(
    {
      database,
      mediaIds: selectedMedia ? [selectedMedia.id] : undefined
    }
  );
  const queuePromise = loadKanjiClashQueueSnapshot({
    dailyNewLimit: settings.kanjiClashDailyNewLimit,
    database,
    mediaIds: selectedMedia ? [selectedMedia.id] : undefined,
    mode,
    now: snapshotAt,
    requestedSize,
    resolvedManualContrastSeed: manualContrastSnapshotPromise.then(
      ({ manualContrastSeed }) => manualContrastSeed
    ),
    scope
  });
  const [manualContrastSnapshot, queue] = await Promise.all([
    manualContrastSnapshotPromise,
    queuePromise
  ]);

  return {
    availableMedia,
    currentRound: getKanjiClashCurrentRound(queue),
    manualContrasts: manualContrastSnapshot.manualContrasts,
    mode,
    queue,
    queueToken: createKanjiClashQueueToken(queue),
    scope,
    selectedMedia: scope === "media" ? selectedMedia : null,
    settings: {
      dailyNewLimit: settings.kanjiClashDailyNewLimit,
      defaultScope: settings.kanjiClashDefaultScope,
      manualDefaultSize: settings.kanjiClashManualDefaultSize,
      manualSizeOptions: kanjiClashManualDefaultSizeOptions
    },
    snapshotAtIso: snapshotAt.toISOString()
  };
}

function normalizeKanjiClashMode(
  value: string | string[] | undefined
): KanjiClashSessionMode {
  return readMatchingSearchParam(
    value,
    (candidate): candidate is KanjiClashSessionMode =>
      candidate === "automatic" || candidate === "manual"
  ) === "manual"
    ? "manual"
    : "automatic";
}

function resolveManualSessionSize(
  value: string | string[] | undefined,
  fallback: number
) {
  const parsed = readMatchingSearchParam(value, (candidate) => {
    if (!/^\d+$/u.test(candidate)) {
      return false;
    }

    const normalized = Number.parseInt(candidate, 10);

    return (
      Number.isSafeInteger(normalized) &&
      normalized > 0 &&
      normalized % KANJI_CLASH_MANUAL_QUERY_SIZE_STEP === 0
    );
  });

  return parsed ? Number.parseInt(parsed, 10) : fallback;
}

function resolveSelectedMediaOption(
  mediaOptions: KanjiClashPageMediaOption[],
  mediaSlug: string | string[] | undefined
) {
  const candidates = Array.isArray(mediaSlug) ? mediaSlug : [mediaSlug];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    const matchingOption =
      mediaOptions.find((option) => option.slug === trimmed) ?? null;

    if (matchingOption) {
      return matchingOption;
    }
  }

  return null;
}

function resolvePageScope(
  defaultScope: "global" | "media",
  selectedMedia: KanjiClashPageMediaOption | null
): KanjiClashScope {
  if (selectedMedia) {
    return "media";
  }

  return resolveKanjiClashDefaultScope(defaultScope, null) === "media"
    ? "media"
    : "global";
}

function readMatchingSearchParam(
  value: string | string[] | undefined,
  matcher: (candidate: string) => boolean
) {
  const candidates = Array.isArray(value) ? value : [value];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    if (matcher(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

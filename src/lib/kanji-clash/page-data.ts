import {
  db,
  type DatabaseClient
} from "@/db";
import { listMediaCached } from "@/lib/data-cache";
import {
  getStudySettings,
  kanjiClashManualDefaultSizeOptions,
  normalizeKanjiClashManualDefaultSize,
  resolveKanjiClashDefaultScope
} from "@/lib/settings";

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

export async function getKanjiClashPageData(
  searchParams: KanjiClashSearchParams,
  database: DatabaseClient = db,
  now?: Date
): Promise<KanjiClashPageData> {
  const snapshotAt = now ?? new Date();
  const [settings, mediaRows] = await Promise.all([
    getStudySettings(database),
    listMediaCached(database)
  ]);
  const availableMedia = mediaRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title
  })) satisfies KanjiClashPageMediaOption[];
  const mode = normalizeKanjiClashMode(searchParams.mode);
  const selectedMedia = resolveSelectedMediaOption(
    availableMedia,
    readFirstSearchParam(searchParams.media)
  );
  const scope = resolvePageScope(settings.kanjiClashDefaultScope, selectedMedia);
  const requestedSize =
    mode === "manual"
      ? resolveManualSessionSize(
          searchParams.size,
          settings.kanjiClashManualDefaultSize
        )
      : null;
  const queue = await loadKanjiClashQueueSnapshot({
    dailyNewLimit: settings.kanjiClashDailyNewLimit,
    database,
    mediaIds: selectedMedia ? [selectedMedia.id] : undefined,
    mode,
    now: snapshotAt,
    requestedSize,
    scope
  });

  return {
    availableMedia,
    currentRound: getKanjiClashCurrentRound(queue),
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
  return readFirstSearchParam(value) === "manual" ? "manual" : "automatic";
}

function resolveManualSessionSize(
  value: string | string[] | undefined,
  fallback: number
) {
  const raw = readFirstSearchParam(value);

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const normalized = Math.round(parsed);

  return kanjiClashManualDefaultSizeOptions.includes(
    normalized as (typeof kanjiClashManualDefaultSizeOptions)[number]
  )
    ? normalizeKanjiClashManualDefaultSize(normalized)
    : fallback;
}

function resolveSelectedMediaOption(
  mediaOptions: KanjiClashPageMediaOption[],
  mediaSlug: string | null
) {
  if (!mediaSlug) {
    return null;
  }

  return mediaOptions.find((option) => option.slug === mediaSlug) ?? null;
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

function readFirstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

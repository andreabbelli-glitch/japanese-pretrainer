import * as nextCache from "next/cache";
import { cache } from "react";

import {
  db,
  getMediaBySlug,
  listMedia,
  type DatabaseClient
} from "@/db";

export const MEDIA_LIST_TAG = "media-list";
export const SETTINGS_TAG = "settings";
export const GLOSSARY_SUMMARY_TAG = "glossary-summary";
export const REVIEW_SUMMARY_TAG = "review-summary";
export const REVIEW_FIRST_CANDIDATE_TAG = "review-first-candidate";
export const TEXTBOOK_TOOLTIP_TAG = "textbook-tooltips";

type MediaListSnapshot = Awaited<ReturnType<typeof listMedia>>;

const inFlightMediaListSnapshots = new WeakMap<
  DatabaseClient,
  Promise<MediaListSnapshot>
>();

export function buildGlossarySummaryTags(mediaIds: string[] = []) {
  if (mediaIds.length === 0) {
    return [GLOSSARY_SUMMARY_TAG];
  }

  return dedupeTags(
    mediaIds.map((mediaId) => `${GLOSSARY_SUMMARY_TAG}:${mediaId}`)
  );
}

export function buildReviewSummaryTags(mediaIds: string[] = []) {
  return dedupeTags([
    REVIEW_SUMMARY_TAG,
    ...mediaIds.map((mediaId) => `${REVIEW_SUMMARY_TAG}:${mediaId}`)
  ]);
}

export function buildTextbookTooltipTags(input?: {
  lessonSlug?: string | null;
  mediaSlug?: string | null;
}) {
  const mediaSlug = input?.mediaSlug?.trim();
  const lessonSlug = input?.lessonSlug?.trim();

  return dedupeTags([
    TEXTBOOK_TOOLTIP_TAG,
    mediaSlug ? `${TEXTBOOK_TOOLTIP_TAG}:${mediaSlug}` : null,
    mediaSlug && lessonSlug
      ? `${TEXTBOOK_TOOLTIP_TAG}:${mediaSlug}:${lessonSlug}`
      : null
  ].filter((tag): tag is string => Boolean(tag)));
}

export function canUseDataCache(database: DatabaseClient) {
  return (
    database === db &&
    process.env.NODE_ENV !== "test" &&
    !Boolean(process.env.VITEST)
  );
}

export async function runWithTaggedCache<T>(input: {
  enabled: boolean;
  keyParts: string[];
  loader: () => Promise<T>;
  tags: string[];
}): Promise<T> {
  if (!input.enabled) {
    return input.loader();
  }

  return nextCache.unstable_cache(async () => input.loader(), input.keyParts, {
    revalidate: false,
    tags: dedupeTags(input.tags)
  })();
}

export const getMediaBySlugCached = cache(
  (database: DatabaseClient, slug: string) =>
    runWithTaggedCache({
      enabled: canUseDataCache(database),
      keyParts: ["media", "by-slug", slug],
      loader: () => getMediaBySlug(database, slug),
      tags: [MEDIA_LIST_TAG]
    })
);

export async function listMediaCached(database: DatabaseClient = db) {
  const inFlight = inFlightMediaListSnapshots.get(database);

  if (inFlight) {
    return inFlight;
  }

  const snapshotPromise = runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["media-list"],
    loader: () => listMedia(database),
    tags: [MEDIA_LIST_TAG]
  }).finally(() => {
    if (inFlightMediaListSnapshots.get(database) === snapshotPromise) {
      inFlightMediaListSnapshots.delete(database);
    }
  });

  inFlightMediaListSnapshots.set(database, snapshotPromise);

  return snapshotPromise;
}

export function revalidateMediaListCache() {
  safeRevalidateTag(MEDIA_LIST_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);
}

export function updateMediaListCache() {
  safeUpdateTag(MEDIA_LIST_TAG);
  safeUpdateTag(REVIEW_FIRST_CANDIDATE_TAG);
}

export function revalidateSettingsCache() {
  safeRevalidateTag(SETTINGS_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);
}

export function updateSettingsCache() {
  safeUpdateTag(SETTINGS_TAG);
  safeUpdateTag(REVIEW_FIRST_CANDIDATE_TAG);
}

export function revalidateGlossarySummaryCache(mediaId?: string | null) {
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);

  if (mediaId) {
    safeRevalidateTag(`${GLOSSARY_SUMMARY_TAG}:${mediaId}`);
    return;
  }

  safeRevalidateTag(GLOSSARY_SUMMARY_TAG);
}

export function updateGlossarySummaryCache(mediaId?: string | null) {
  safeUpdateTag(REVIEW_FIRST_CANDIDATE_TAG);

  if (mediaId) {
    safeUpdateTag(`${GLOSSARY_SUMMARY_TAG}:${mediaId}`);
    return;
  }

  safeUpdateTag(GLOSSARY_SUMMARY_TAG);
}

export function revalidateReviewSummaryCache(mediaId?: string | null) {
  safeRevalidateTag(REVIEW_SUMMARY_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);

  if (mediaId) {
    safeRevalidateTag(`${REVIEW_SUMMARY_TAG}:${mediaId}`);
  }
}

export function updateReviewSummaryCache(mediaId?: string | null) {
  safeUpdateTag(REVIEW_SUMMARY_TAG);
  safeUpdateTag(REVIEW_FIRST_CANDIDATE_TAG);

  if (mediaId) {
    safeUpdateTag(`${REVIEW_SUMMARY_TAG}:${mediaId}`);
  }
}

export function revalidateTextbookTooltipCache(input?: {
  lessonSlug?: string | null;
  mediaSlug?: string | null;
}) {
  for (const tag of buildTextbookTooltipTags(input)) {
    safeRevalidateTag(tag);
  }
}

function dedupeTags(tags: string[]) {
  return [...new Set(tags)];
}

function safeRevalidateTag(tag: string) {
  if (
    "revalidateTag" in nextCache &&
    typeof nextCache.revalidateTag === "function"
  ) {
    nextCache.revalidateTag(tag, "max");
  }
}

function safeUpdateTag(tag: string) {
  if ("updateTag" in nextCache && typeof nextCache.updateTag === "function") {
    nextCache.updateTag(tag);
    return;
  }

  safeRevalidateTag(tag);
}

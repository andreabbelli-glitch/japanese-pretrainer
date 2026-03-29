import * as nextCache from "next/cache";
import { cache } from "react";

import { db, getMediaBySlug, listMedia, type DatabaseClient } from "@/db";

export const MEDIA_LIST_TAG = "media-list";
export const SETTINGS_TAG = "settings";
export const GLOSSARY_SUMMARY_TAG = "glossary-summary";
export const REVIEW_SUMMARY_TAG = "review-summary";
export const REVIEW_FIRST_CANDIDATE_TAG = "review-first-candidate";

export function buildGlossarySummaryTags(mediaIds: string[] = []) {
  return dedupeTags([
    GLOSSARY_SUMMARY_TAG,
    ...mediaIds.map((mediaId) => `${GLOSSARY_SUMMARY_TAG}:${mediaId}`)
  ]);
}

export function buildReviewSummaryTags(mediaIds: string[] = []) {
  return dedupeTags([
    REVIEW_SUMMARY_TAG,
    ...mediaIds.map((mediaId) => `${REVIEW_SUMMARY_TAG}:${mediaId}`)
  ]);
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
  (database: DatabaseClient, slug: string) => getMediaBySlug(database, slug)
);

export async function listMediaCached(database: DatabaseClient = db) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["media-list"],
    loader: () => listMedia(database),
    tags: [MEDIA_LIST_TAG]
  });
}

export function revalidateMediaListCache() {
  safeRevalidateTag(MEDIA_LIST_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);
}

export function revalidateSettingsCache() {
  safeRevalidateTag(SETTINGS_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);
}

export function revalidateGlossarySummaryCache(mediaId?: string | null) {
  safeRevalidateTag(GLOSSARY_SUMMARY_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);

  if (mediaId) {
    safeRevalidateTag(`${GLOSSARY_SUMMARY_TAG}:${mediaId}`);
  }
}

export function revalidateReviewSummaryCache(mediaId?: string | null) {
  safeRevalidateTag(REVIEW_SUMMARY_TAG);
  safeRevalidateTag(REVIEW_FIRST_CANDIDATE_TAG);

  if (mediaId) {
    safeRevalidateTag(`${REVIEW_SUMMARY_TAG}:${mediaId}`);
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

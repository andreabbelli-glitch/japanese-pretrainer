import type { DatabaseClient } from "@/db";
import { listEligibleKanjiClashSubjects } from "@/db/queries";
import {
  MEDIA_LIST_TAG,
  buildReviewSummaryTags,
  canUseDataCache,
  runWithTaggedCache
} from "@/features/cache/server/data-cache";

export async function listEligibleKanjiClashSubjectsCached(
  database: DatabaseClient,
  options: {
    mediaIds?: string[];
  } = {}
) {
  const mediaIds = normalizeKanjiClashEligibilityMediaIds(options.mediaIds);

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "kanji-clash",
      "eligible-subjects",
      mediaIds.length > 0 ? `media:${mediaIds.join(",")}` : "media:all"
    ],
    loader: () =>
      listEligibleKanjiClashSubjects(database, {
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined
      }),
    tags: [MEDIA_LIST_TAG, ...buildReviewSummaryTags(mediaIds)]
  });
}

function normalizeKanjiClashEligibilityMediaIds(mediaIds?: string[]) {
  return [
    ...new Set(
      (mediaIds ?? []).map((mediaId) => mediaId.trim()).filter(Boolean)
    )
  ].sort((left, right) => left.localeCompare(right));
}

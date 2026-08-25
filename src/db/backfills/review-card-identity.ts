import { sql } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  buildComputedReviewSubjectIdentityCteSql,
  quoteSqlString
} from "../queries/review-query-helpers.ts";

type ReviewCardIdentityRefreshDatabase = Pick<
  DatabaseClient,
  "all" | "get" | "run"
>;

const REVIEW_CARD_IDENTITY_PROJECTION_VERSION = 2;

export type ReviewCardIdentityCacheCoverage = {
  cardCount: number;
  identityCount: number;
  missingCount: number;
  outdatedCount: number;
};

/**
 * Migration/startup guard. The expensive source projection is rebuilt only
 * when its algorithm version changes or coverage is incomplete; ordinary
 * deploys pay for one small indexed coverage query.
 */
export async function ensureReviewCardIdentityCache(
  database: ReviewCardIdentityRefreshDatabase
): Promise<ReviewCardIdentityCacheCoverage> {
  const coverage = await loadReviewCardIdentityCacheCoverage(database);

  if (coverage.missingCount === 0 && coverage.outdatedCount === 0) {
    return coverage;
  }

  return refreshReviewCardIdentityCache(database);
}

export async function refreshReviewCardIdentityCache(
  database: ReviewCardIdentityRefreshDatabase,
  input: { mediaIds?: string[] } = {}
) {
  const mediaIds = [...new Set(input.mediaIds ?? [])].sort();

  if (input.mediaIds && mediaIds.length === 0) {
    return {
      cardCount: 0,
      identityCount: 0,
      missingCount: 0,
      outdatedCount: 0
    };
  }

  const mediaFilter =
    mediaIds.length > 0 ? mediaIds.map(quoteSqlString).join(", ") : undefined;

  await database.run(
    sql.raw(`
      WITH ${buildComputedReviewSubjectIdentityCteSql({
        includeArchived: true,
        mediaFilter
      })}
      INSERT INTO review_card_identity (
        card_id,
        has_primary,
        driving_link_count,
        entry_type,
        entry_id,
        cross_media_group_id,
        canonical_subject_key,
        recall_task,
        memory_key,
        projection_version
      )
      SELECT
        card_id,
        has_primary,
        driving_link_count,
        entry_type,
        entry_id,
        cross_media_group_id,
        canonical_subject_key,
        recall_task,
        memory_key,
        ${REVIEW_CARD_IDENTITY_PROJECTION_VERSION}
      FROM subject_identity
      WHERE 1 = 1
      ON CONFLICT(card_id) DO UPDATE SET
        has_primary = excluded.has_primary,
        driving_link_count = excluded.driving_link_count,
        entry_type = excluded.entry_type,
        entry_id = excluded.entry_id,
        cross_media_group_id = excluded.cross_media_group_id,
        canonical_subject_key = excluded.canonical_subject_key,
        recall_task = excluded.recall_task,
        memory_key = excluded.memory_key,
        projection_version = excluded.projection_version
      WHERE review_card_identity.has_primary IS NOT excluded.has_primary
        OR review_card_identity.driving_link_count IS NOT excluded.driving_link_count
        OR review_card_identity.entry_type IS NOT excluded.entry_type
        OR review_card_identity.entry_id IS NOT excluded.entry_id
        OR review_card_identity.cross_media_group_id IS NOT excluded.cross_media_group_id
        OR review_card_identity.canonical_subject_key IS NOT excluded.canonical_subject_key
        OR review_card_identity.recall_task IS NOT excluded.recall_task
        OR review_card_identity.memory_key IS NOT excluded.memory_key
        OR review_card_identity.projection_version IS NOT excluded.projection_version
    `)
  );

  const coverage = await loadReviewCardIdentityCacheCoverage(
    database,
    mediaIds.length > 0 ? { mediaIds } : {}
  );

  if (coverage.missingCount > 0 || coverage.outdatedCount > 0) {
    throw new Error(
      `Review card identity cache refresh left ${coverage.missingCount} card(s) uncovered and ${coverage.outdatedCount} outdated.`
    );
  }

  return coverage;
}

export async function loadReviewCardIdentityCacheCoverage(
  database: Pick<DatabaseClient, "get">,
  input: { mediaIds?: string[] } = {}
): Promise<ReviewCardIdentityCacheCoverage> {
  const mediaIds = [...new Set(input.mediaIds ?? [])].sort();

  if (input.mediaIds && mediaIds.length === 0) {
    return {
      cardCount: 0,
      identityCount: 0,
      missingCount: 0,
      outdatedCount: 0
    };
  }

  const mediaClause =
    mediaIds.length > 0
      ? `\n      WHERE c.media_id IN (${mediaIds.map(quoteSqlString).join(", ")})`
      : "";
  const row = await database.get<{
    cardCount: number | string;
    identityCount: number | string;
    missingCount: number | string;
    outdatedCount: number | string;
  }>(
    sql.raw(`
      SELECT
        COUNT(*) AS cardCount,
        COUNT(rci.card_id) AS identityCount,
        SUM(CASE WHEN rci.card_id IS NULL THEN 1 ELSE 0 END) AS missingCount,
        SUM(
          CASE
            WHEN rci.card_id IS NOT NULL
             AND rci.projection_version != ${REVIEW_CARD_IDENTITY_PROJECTION_VERSION}
              THEN 1
            ELSE 0
          END
        ) AS outdatedCount
      FROM card c
      LEFT JOIN review_card_identity rci
        ON rci.card_id = c.id${mediaClause}
    `)
  );

  return {
    cardCount: Number(row?.cardCount ?? 0),
    identityCount: Number(row?.identityCount ?? 0),
    missingCount: Number(row?.missingCount ?? 0),
    outdatedCount: Number(row?.outdatedCount ?? 0)
  };
}

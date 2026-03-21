import { inArray } from "drizzle-orm";

import {
  db,
  userSetting,
  type DatabaseClient
} from "@/db";
import {
  SETTINGS_TAG,
  canUseDataCache,
  runWithTaggedCache
} from "@/lib/data-cache";

import { reviewSchedulerConfig } from "./review-scheduler";

export type FuriganaMode = "on" | "off" | "hover";
export type GlossaryDefaultSort = "lesson_order" | "alphabetical";

export type StudySettings = {
  furiganaMode: FuriganaMode;
  glossaryDefaultSort: GlossaryDefaultSort;
  reviewFrontFurigana: boolean;
  reviewDailyLimit: number;
};

export type StudySettingsInput = Partial<StudySettings>;

export const defaultStudySettings: StudySettings = {
  furiganaMode: "hover",
  glossaryDefaultSort: "lesson_order",
  reviewFrontFurigana: true,
  reviewDailyLimit: reviewSchedulerConfig.defaultDailyLimit
};

const studySettingKeys = [
  "furigana_mode",
  "glossary_default_sort",
  "review_front_furigana",
  "review_daily_limit"
] as const satisfies Array<(typeof userSetting.$inferSelect)["key"]>;

export async function getStudySettings(
  database: DatabaseClient = db
): Promise<StudySettings> {
  return loadStudySettingsSnapshot(database);
}

export async function getFuriganaModeSetting(
  database: DatabaseClient = db
): Promise<FuriganaMode> {
  return (await loadStudySettingsSnapshot(database)).furiganaMode;
}

export async function getReviewDailyLimit(
  database: DatabaseClient = db
): Promise<number> {
  return (await loadStudySettingsSnapshot(database)).reviewDailyLimit;
}

export async function getReviewFrontFuriganaSetting(
  database: DatabaseClient = db
): Promise<boolean> {
  return (await loadStudySettingsSnapshot(database)).reviewFrontFurigana;
}

export async function getGlossaryDefaultSort(
  database: DatabaseClient = db
): Promise<GlossaryDefaultSort> {
  return (await loadStudySettingsSnapshot(database)).glossaryDefaultSort;
}

async function loadStudySettingsSnapshot(
  database: DatabaseClient
): Promise<StudySettings> {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["settings", "snapshot"],
    loader: async () => {
      const rows = await database.query.userSetting.findMany({
        where: inArray(userSetting.key, studySettingKeys)
      });
      const valuesByKey = new Map(rows.map((row) => [row.key, row.valueJson]));

      return {
        furiganaMode: parseSettingValue(
          valuesByKey.get("furigana_mode"),
          normalizeFuriganaMode,
          defaultStudySettings.furiganaMode
        ),
        glossaryDefaultSort: parseSettingValue(
          valuesByKey.get("glossary_default_sort"),
          normalizeGlossaryDefaultSort,
          defaultStudySettings.glossaryDefaultSort
        ),
        reviewFrontFurigana: parseSettingValue(
          valuesByKey.get("review_front_furigana"),
          normalizeReviewFrontFurigana,
          defaultStudySettings.reviewFrontFurigana
        ),
        reviewDailyLimit: parseSettingValue(
          valuesByKey.get("review_daily_limit"),
          normalizeReviewDailyLimit,
          defaultStudySettings.reviewDailyLimit
        )
      };
    },
    tags: [SETTINGS_TAG]
  });
}

export async function updateStudySettings(
  input: StudySettingsInput,
  database: DatabaseClient = db
) {
  const current = await getStudySettings(database);
  const next: StudySettings = {
    furiganaMode:
      input.furiganaMode === undefined
        ? current.furiganaMode
        : normalizeFuriganaMode(input.furiganaMode),
    glossaryDefaultSort:
      input.glossaryDefaultSort === undefined
        ? current.glossaryDefaultSort
        : normalizeGlossaryDefaultSort(input.glossaryDefaultSort),
    reviewFrontFurigana:
      input.reviewFrontFurigana === undefined
        ? current.reviewFrontFurigana
        : normalizeReviewFrontFurigana(input.reviewFrontFurigana),
    reviewDailyLimit:
      input.reviewDailyLimit === undefined
        ? current.reviewDailyLimit
        : normalizeReviewDailyLimit(input.reviewDailyLimit)
  };
  const nowIso = new Date().toISOString();

  await Promise.all([
    upsertUserSetting({
      database,
      key: "furigana_mode",
      nowIso,
      valueJson: JSON.stringify(next.furiganaMode)
    }),
    upsertUserSetting({
      database,
      key: "glossary_default_sort",
      nowIso,
      valueJson: JSON.stringify(next.glossaryDefaultSort)
    }),
    upsertUserSetting({
      database,
      key: "review_front_furigana",
      nowIso,
      valueJson: JSON.stringify(next.reviewFrontFurigana)
    }),
    upsertUserSetting({
      database,
      key: "review_daily_limit",
      nowIso,
      valueJson: JSON.stringify(next.reviewDailyLimit)
    })
  ]);

  return next;
}

export function normalizeFuriganaMode(value: string): FuriganaMode {
  return value === "on" || value === "off" || value === "hover"
    ? value
    : defaultStudySettings.furiganaMode;
}

export function normalizeGlossaryDefaultSort(
  value: string
): GlossaryDefaultSort {
  return value === "alphabetical" || value === "lesson_order"
    ? value
    : defaultStudySettings.glossaryDefaultSort;
}

export function normalizeReviewFrontFurigana(value: boolean | string) {
  if (typeof value === "boolean") {
    return value;
  }

  return value === "false"
    ? false
    : value === "true"
      ? true
      : defaultStudySettings.reviewFrontFurigana;
}

export function normalizeReviewDailyLimit(value: number) {
  if (!Number.isFinite(value)) {
    return defaultStudySettings.reviewDailyLimit;
  }

  return Math.max(1, Math.min(200, Math.round(value)));
}

function parseSettingValue<TValue, TResult>(
  valueJson: string | undefined,
  normalize: (value: TValue) => TResult,
  fallback: TResult
) {
  if (!valueJson) {
    return fallback;
  }

  try {
    return normalize(JSON.parse(valueJson) as TValue);
  } catch {
    return fallback;
  }
}

async function upsertUserSetting(input: {
  database: DatabaseClient;
  key: (typeof userSetting.$inferInsert)["key"];
  nowIso: string;
  valueJson: string;
}) {
  await input.database
    .insert(userSetting)
    .values({
      key: input.key,
      valueJson: input.valueJson,
      updatedAt: input.nowIso
    })
    .onConflictDoUpdate({
      target: userSetting.key,
      set: {
        valueJson: input.valueJson,
        updatedAt: input.nowIso
      }
    });
}

import { db, getUserSettingValue, userSetting, type DatabaseClient } from "@/db";

import { reviewSchedulerConfig } from "./review-scheduler";

export type FuriganaMode = "on" | "off" | "hover";
export type GlossaryDefaultSort = "lesson_order" | "alphabetical";

export type StudySettings = {
  furiganaMode: FuriganaMode;
  glossaryDefaultSort: GlossaryDefaultSort;
  reviewDailyLimit: number;
};

export type StudySettingsInput = Partial<StudySettings>;

export const defaultStudySettings: StudySettings = {
  furiganaMode: "hover",
  glossaryDefaultSort: "lesson_order",
  reviewDailyLimit: reviewSchedulerConfig.defaultDailyLimit
};

export async function getStudySettings(
  database: DatabaseClient = db
): Promise<StudySettings> {
  const [furiganaMode, glossaryDefaultSort, reviewDailyLimit] = await Promise.all([
    getFuriganaModeSetting(database),
    getGlossaryDefaultSort(database),
    getReviewDailyLimit(database)
  ]);

  return {
    furiganaMode,
    glossaryDefaultSort,
    reviewDailyLimit
  };
}

export async function getFuriganaModeSetting(
  database: DatabaseClient = db
): Promise<FuriganaMode> {
  const row = await getUserSettingValue(database, "furigana_mode");

  return parseFuriganaMode(row?.valueJson);
}

export async function getReviewDailyLimit(
  database: DatabaseClient = db
): Promise<number> {
  const row = await getUserSettingValue(database, "review_daily_limit");

  return parseReviewDailyLimit(row?.valueJson);
}

export async function getGlossaryDefaultSort(
  database: DatabaseClient = db
): Promise<GlossaryDefaultSort> {
  const row = await getUserSettingValue(database, "glossary_default_sort");

  return parseGlossaryDefaultSort(row?.valueJson);
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

export function normalizeReviewDailyLimit(value: number) {
  if (!Number.isFinite(value)) {
    return defaultStudySettings.reviewDailyLimit;
  }

  return Math.max(1, Math.min(200, Math.round(value)));
}

function parseFuriganaMode(valueJson?: string) {
  if (!valueJson) {
    return defaultStudySettings.furiganaMode;
  }

  try {
    return normalizeFuriganaMode(JSON.parse(valueJson));
  } catch {
    return defaultStudySettings.furiganaMode;
  }
}

function parseGlossaryDefaultSort(valueJson?: string) {
  if (!valueJson) {
    return defaultStudySettings.glossaryDefaultSort;
  }

  try {
    return normalizeGlossaryDefaultSort(JSON.parse(valueJson));
  } catch {
    return defaultStudySettings.glossaryDefaultSort;
  }
}

function parseReviewDailyLimit(valueJson?: string) {
  if (!valueJson) {
    return defaultStudySettings.reviewDailyLimit;
  }

  try {
    return normalizeReviewDailyLimit(JSON.parse(valueJson));
  } catch {
    return defaultStudySettings.reviewDailyLimit;
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

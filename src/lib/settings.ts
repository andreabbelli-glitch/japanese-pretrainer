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
export type KanjiClashDefaultScope = "global" | "media";

export type StudySettings = {
  furiganaMode: FuriganaMode;
  glossaryDefaultSort: GlossaryDefaultSort;
  kanjiClashDailyNewLimit: number;
  kanjiClashDefaultScope: KanjiClashDefaultScope;
  kanjiClashManualDefaultSize: number;
  reviewFrontFurigana: boolean;
  reviewDailyLimit: number;
};

export type StudySettingsInput = Partial<StudySettings>;

export const kanjiClashManualDefaultSizeOptions = [10, 20, 40] as const;

export const defaultStudySettings: StudySettings = {
  furiganaMode: "hover",
  glossaryDefaultSort: "lesson_order",
  kanjiClashDailyNewLimit: 5,
  kanjiClashDefaultScope: "global",
  kanjiClashManualDefaultSize: 20,
  reviewFrontFurigana: true,
  reviewDailyLimit: reviewSchedulerConfig.defaultDailyLimit
};

const studySettingKeys = [
  "furigana_mode",
  "glossary_default_sort",
  "kanji_clash_daily_new_limit",
  "kanji_clash_default_scope",
  "kanji_clash_manual_default_size",
  "review_front_furigana",
  "review_daily_limit"
] as const satisfies Array<(typeof userSetting.$inferSelect)["key"]>;

type StudySettingKey = (typeof userSetting.$inferSelect)["key"];

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
        kanjiClashDailyNewLimit: parseSettingValue(
          valuesByKey.get("kanji_clash_daily_new_limit"),
          normalizeKanjiClashDailyNewLimit,
          defaultStudySettings.kanjiClashDailyNewLimit
        ),
        kanjiClashDefaultScope: parseSettingValue(
          valuesByKey.get("kanji_clash_default_scope"),
          normalizeKanjiClashDefaultScope,
          defaultStudySettings.kanjiClashDefaultScope
        ),
        kanjiClashManualDefaultSize: parseSettingValue(
          valuesByKey.get("kanji_clash_manual_default_size"),
          normalizeKanjiClashManualDefaultSize,
          defaultStudySettings.kanjiClashManualDefaultSize
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
    kanjiClashDailyNewLimit:
      input.kanjiClashDailyNewLimit === undefined
        ? current.kanjiClashDailyNewLimit
        : normalizeKanjiClashDailyNewLimit(input.kanjiClashDailyNewLimit),
    kanjiClashDefaultScope:
      input.kanjiClashDefaultScope === undefined
        ? current.kanjiClashDefaultScope
        : normalizeKanjiClashDefaultScope(input.kanjiClashDefaultScope),
    kanjiClashManualDefaultSize:
      input.kanjiClashManualDefaultSize === undefined
        ? current.kanjiClashManualDefaultSize
        : normalizeKanjiClashManualDefaultSize(input.kanjiClashManualDefaultSize),
    reviewFrontFurigana:
      input.reviewFrontFurigana === undefined
        ? current.reviewFrontFurigana
        : normalizeReviewFrontFurigana(input.reviewFrontFurigana),
    reviewDailyLimit:
      input.reviewDailyLimit === undefined
        ? current.reviewDailyLimit
        : normalizeReviewDailyLimit(input.reviewDailyLimit)
  };
  const changedSettings = [
    ["furigana_mode", current.furiganaMode, next.furiganaMode],
    [
      "glossary_default_sort",
      current.glossaryDefaultSort,
      next.glossaryDefaultSort
    ],
    [
      "kanji_clash_daily_new_limit",
      current.kanjiClashDailyNewLimit,
      next.kanjiClashDailyNewLimit
    ],
    [
      "kanji_clash_default_scope",
      current.kanjiClashDefaultScope,
      next.kanjiClashDefaultScope
    ],
    [
      "kanji_clash_manual_default_size",
      current.kanjiClashManualDefaultSize,
      next.kanjiClashManualDefaultSize
    ],
    [
      "review_front_furigana",
      current.reviewFrontFurigana,
      next.reviewFrontFurigana
    ],
    ["review_daily_limit", current.reviewDailyLimit, next.reviewDailyLimit]
  ].flatMap(([key, currentValue, nextValue]) =>
    currentValue === nextValue
      ? []
      : [
          {
            key: key as StudySettingKey,
            valueJson: JSON.stringify(nextValue)
          }
        ]
  );

  if (changedSettings.length === 0) {
    return next;
  }

  const nowIso = new Date().toISOString();

  await Promise.all(
    changedSettings.map((setting) =>
      upsertUserSetting({
        database,
        key: setting.key,
        nowIso,
        valueJson: setting.valueJson
      })
    )
  );

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

export function normalizeKanjiClashDailyNewLimit(value: number) {
  if (!Number.isFinite(value)) {
    return defaultStudySettings.kanjiClashDailyNewLimit;
  }

  return Math.max(0, Math.min(20, Math.round(value)));
}

export function normalizeKanjiClashDefaultScope(
  value: string
): KanjiClashDefaultScope {
  return value === "media" ? "media" : defaultStudySettings.kanjiClashDefaultScope;
}

export function normalizeKanjiClashManualDefaultSize(value: number) {
  if (!Number.isFinite(value)) {
    return defaultStudySettings.kanjiClashManualDefaultSize;
  }

  const normalizedValue = Math.round(value);

  return kanjiClashManualDefaultSizeOptions.includes(
    normalizedValue as (typeof kanjiClashManualDefaultSizeOptions)[number]
  )
    ? normalizedValue
    : defaultStudySettings.kanjiClashManualDefaultSize;
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

export function resolveKanjiClashDefaultScope(
  scope: KanjiClashDefaultScope,
  mediaSlug?: string | null
): KanjiClashDefaultScope {
  if (scope === "media" && !mediaSlug) {
    return "global";
  }

  return scope;
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

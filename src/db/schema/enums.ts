export {
  entryTypeValues,
  lessonStatusValues,
  mediaStatusValues
} from "../../domain/content.ts";
export type {
  EntryType,
  LessonStatus,
  MediaStatus
} from "../../domain/content.ts";

export const cardStatusValues = ["active", "suspended", "archived"] as const;
export const sourceTypeValues = ["lesson", "card"] as const;
export const entryLinkRoleValues = [
  "introduced",
  "explained",
  "mentioned",
  "reviewed"
] as const;
export const cardRelationshipTypeValues = [
  "primary",
  "secondary",
  "context"
] as const;
export const reviewStateValues = [
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
  "known_manual"
] as const;
export const reviewSubjectKindValues = ["group", "entry", "card"] as const;
export const reviewRatingValues = ["again", "hard", "good", "easy"] as const;
export const reviewSchedulerVersionValues = ["fsrs_v1"] as const;
export const lessonProgressStatusValues = [
  "not_started",
  "in_progress",
  "completed"
] as const;
export const contentImportStatusValues = [
  "running",
  "completed",
  "failed"
] as const;
export const userSettingKeys = [
  "furigana_mode",
  "review_front_furigana",
  "review_daily_limit",
  "glossary_default_sort",
  "kanji_clash_daily_new_limit",
  "kanji_clash_manual_default_size",
  "kanji_clash_default_scope",
  "fsrs_optimizer_config",
  "fsrs_optimizer_state",
  "fsrs_params_recognition",
  "fsrs_params_concept"
] as const;

export const mediaStatusValues = ["active", "archived"] as const;
export const lessonStatusValues = ["active", "archived"] as const;
export const cardStatusValues = ["active", "suspended", "archived"] as const;
export const entryTypeValues = ["term", "grammar"] as const;
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
export const entryStatusValues = [
  "unknown",
  "learning",
  "known_manual",
  "ignored"
] as const;
export const reviewStateValues = [
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
  "known_manual"
] as const;
export const reviewRatingValues = ["again", "hard", "good", "easy"] as const;
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
  "review_daily_limit",
  "glossary_default_sort"
] as const;

export type EntryType = (typeof entryTypeValues)[number];

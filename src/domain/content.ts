export const mediaStatusValues = ["active", "archived"] as const;
export type MediaStatus = (typeof mediaStatusValues)[number];

export const lessonStatusValues = ["active", "archived"] as const;
export type LessonStatus = (typeof lessonStatusValues)[number];

export const entryTypeValues = ["term", "grammar"] as const;
export type EntryType = (typeof entryTypeValues)[number];

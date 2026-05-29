import type { EntryType } from "@/domain/content";

export type ReviewCardEntryLink = {
  entryId: string;
  entryType: EntryType;
  relationshipType: string;
};

export type ReviewCardLessonProgressSource = {
  status: string | null;
};

export type ReviewCardLessonSource = {
  status?: string | null;
  progress?: ReviewCardLessonProgressSource | null;
};

export type ReviewCardSegmentSource = {
  title: string;
};

export type ReviewCardSource = {
  back: string;
  cardType: string;
  createdAt: string;
  entryLinks: ReviewCardEntryLink[];
  exampleIt: string | null;
  exampleJp: string | null;
  front: string;
  id: string;
  lesson?: ReviewCardLessonSource | null;
  lessonId: string | null;
  mediaId: string;
  notesIt: string | null;
  orderIndex: number | null;
  segment?: ReviewCardSegmentSource | null;
  segmentId: string | null;
  status: string;
  updatedAt: string;
};

export type ReviewLessonCompletionSource = Pick<
  ReviewCardSource,
  "lesson" | "lessonId"
>;

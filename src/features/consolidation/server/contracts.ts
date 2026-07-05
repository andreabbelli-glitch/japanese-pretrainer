import { preReviewConsolidationState, type EntryType } from "@/db/schema";
import type { DatabaseClient } from "@/db";
import type { AppHref } from "@/features/navigation";
import type { PitchAccentData } from "@/features/pitch-accent/model";
import type { PronunciationData } from "@/features/pronunciation/model/data";

export type PreReviewConsolidationStatus =
  (typeof preReviewConsolidationState.$inferSelect)["status"];

export type PreReviewConsolidationStep = "reading" | "meaning";

export type ConsolidationOptionKind = EntryType | "card";

export type ConsolidationHubLesson = {
  href: AppHref;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  pendingCount: number;
};

export type ConsolidationHubMediaGroup = {
  lessons: ConsolidationHubLesson[];
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  pendingCount: number;
};

export type ConsolidationHubRetrainingQueue = {
  href: AppHref;
  pendingCount: number;
  title: string;
};

export type ConsolidationHubData = {
  mediaGroups: ConsolidationHubMediaGroup[];
  retrainingQueue: ConsolidationHubRetrainingQueue | null;
  totalPending: number;
};

export type ConsolidationOption = {
  kind: ConsolidationOptionKind;
  label: string;
  pitchAccent?: PitchAccentData;
  subjectKey: string;
};

export type ConsolidationSessionStepData = {
  answerLabel: string;
  options: ConsolidationOption[];
  step: PreReviewConsolidationStep;
};

export type ConsolidationSessionSubject = {
  attemptCount: number;
  back: string;
  canMarkKnown: boolean;
  front: string;
  pronunciation?: PronunciationData;
  representativeCardId: string;
  steps: ConsolidationSessionStepData[];
  subjectKey: string;
};

export type ConsolidationSessionData = {
  hubHref: AppHref;
  lesson: {
    id: string;
    slug: string;
    title: string;
  };
  media: {
    id: string;
    slug: string;
    title: string;
  };
  reviewHref: AppHref;
  subjects: ConsolidationSessionSubject[];
  totalPending: number;
};

export type SubmitConsolidationAnswerInput = {
  database?: DatabaseClient;
  now?: Date;
  selectedSubjectKey: string;
  step: PreReviewConsolidationStep;
  subjectKey: string;
};

export type MarkConsolidationKnownInput = {
  database?: DatabaseClient;
  now?: Date;
  subjectKey: string;
};

export type ConsolidationAnswerResult = {
  attemptCount: number;
  completed: boolean;
  correct: boolean;
  lessonId: string;
  mediaId: string;
  nextStep: PreReviewConsolidationStep | null;
  reinsertionIndex: number | null;
  status: PreReviewConsolidationStatus;
  subjectKey: string;
};

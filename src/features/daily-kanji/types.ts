export type DailyKanjiEntryKind = "term" | "grammar";

export type DailyKanjiPriorityReason =
  | "recent-hard-again"
  | "learning"
  | "relearning"
  | "high-difficulty"
  | "low-stability"
  | "lapses";

export type DailyKanjiDataset = {
  version: 1;
  generatedAt: string;
  recentMistakeLookbackDays: number;
  cards: DailyKanjiExportCard[];
};

export type DailyKanjiModeScope = {
  lessonOrderIndex: number | null;
  lessonSlug: string;
  lessonTitle: string;
  order: number | null;
};

export type DailyKanjiStudyModes = {
  daily?: true;
  prestudy?: DailyKanjiModeScope;
  lastLessonsHardAgain?: DailyKanjiModeScope;
};

export type DailyKanjiExportCard = {
  cardId: string;
  subjectKey: string;
  cardOrderIndex?: number | null;
  media: {
    slug: string;
    title: string;
  };
  lesson: {
    orderIndex?: number | null;
    slug: string;
    title: string;
  };
  segment?: {
    title: string;
  };
  front: string;
  back: string;
  kanji: string[];
  entry: {
    audioSrc?: string;
    id: string;
    kind: DailyKanjiEntryKind;
    label: string;
    meaning: string;
    pitchAccent?: number;
    pitchAccentSource?: string;
    reading?: string;
  };
  exampleIt?: string;
  exampleJp?: string;
  notes?: string;
  studyModes?: DailyKanjiStudyModes;
  srs: {
    difficulty: number | null;
    dueAt: string | null;
    lapses: number;
    lastHardAgainAt: string | null;
    lastInteractionAt: string;
    lastReviewedAt: string | null;
    learningSteps: number;
    priorityReasons: DailyKanjiPriorityReason[];
    priorityScore: number;
    recentHardAgainCount: number;
    reps: number;
    scheduledDays: number;
    stability: number | null;
    state: "learning" | "review" | "relearning";
  };
};

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
  glossary?: DailyKanjiGlossarySnapshot;
};

export type DailyKanjiGlossaryAlias = {
  text: string;
  type?: string;
};

export type DailyKanjiGlossaryMediaRef = {
  entryId: string;
  mediaSlug: string;
  mediaTitle: string;
  segmentTitle?: string;
  sourceId: string;
};

export type DailyKanjiGlossaryEntry = {
  aliases: DailyKanjiGlossaryAlias[];
  id: string;
  kind: DailyKanjiEntryKind;
  label: string;
  meaning: string;
  media: DailyKanjiGlossaryMediaRef[];
  notes?: string;
  pitchAccent: number | null;
  pitchAccentSource: string | null;
  reading: string | null;
  romaji: string | null;
  searchText: string;
  title?: string;
};

export type DailyKanjiGlossarySnapshot = {
  version: 1;
  generatedAt: string;
  entryCount: number;
  entries: DailyKanjiGlossaryEntry[];
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

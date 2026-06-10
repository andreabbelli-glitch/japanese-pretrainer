export type DailyKanjiEntryKind = "term" | "grammar";

export type DailyKanjiPriorityReason =
  | "recent-hard-again"
  | "learning"
  | "relearning"
  | "low-stability"
  | "lapses";

export type DailyKanjiDataset = {
  version: 1;
  generatedAt: string;
  recentMistakeLookbackDays: number;
  cards: DailyKanjiExportCard[];
};

export type DailyKanjiExportCard = {
  cardId: string;
  subjectKey: string;
  media: {
    slug: string;
    title: string;
  };
  lesson: {
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

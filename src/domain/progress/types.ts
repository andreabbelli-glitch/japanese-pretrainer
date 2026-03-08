import type { ReviewState } from "@/src/domain/review";
import type { StudyCard, StudyDeck, StudyItem } from "@/src/domain/content";

export type ItemMastery = {
  itemId: string;
  score: number;
  state: ReviewState;
  dueAt: string | null;
  intervalDays: number;
  lapses: number;
  streak: number;
  lastReviewedAt: string | null;
};

export type CardCoverage = {
  card: StudyCard;
  coverage: number;
  weightedMasterySum: number;
  weightedMax: number;
  missingItems: Array<{ item: StudyItem; mastery: number; weight: number }>;
};

export type DeckCoverage = {
  deck: StudyDeck;
  coverage: number;
  cards: CardCoverage[];
  topBottlenecks: Array<{ item: StudyItem; gap: number; weight: number; cardCount: number }>;
  unlockSuggestions: Array<{ item: StudyItem; unlocks: StudyCard[]; impact: number }>;
};

export type DashboardMetrics = {
  dueToday: number;
  newToday: number;
  streakDays: number;
  retentionEstimate: number;
  countsByState: Record<ReviewState, number>;
  sd1Coverage: number;
  sd2Coverage: number;
  suggestedLessons: Array<{ lessonId: string; slug: string; title: string; reason: string }>;
  recentlyUnlockedCards: Array<{ card: StudyCard; coverage: number; status: "readable" | "almost" }>;
  studyNext: Array<{ item: StudyItem; unlocks: StudyCard[]; impact: number }>;
};

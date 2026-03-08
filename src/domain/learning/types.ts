import type { Game, LanguageItem, Product, SourceUnit } from '@/src/domain/content';

export type GoalTargetType = 'game' | 'product' | 'unit' | 'goal';

export type GoalTarget = {
  id: string;
  targetType: GoalTargetType;
  gameId?: string;
  productId?: string;
  unitId?: string;
  unitIds?: string[];
  itemIds?: string[];
  title?: string;
};

export type CoverageItem = {
  item: LanguageItem;
  mastery: number;
  weight: number;
  weightedMastery: number;
};

export type CoverageResult = {
  target: GoalTarget;
  coverageScore: number;
  requiredItems: LanguageItem[];
  weightedMasterySum: number;
  weightedMax: number;
  items: CoverageItem[];
};

export type UnlockRecommendation = {
  item: LanguageItem;
  impactScore: number;
  unlocks: SourceUnit[];
};

export type GapAnalysisResult = {
  target: GoalTarget;
  requiredItems: LanguageItem[];
  knownItems: LanguageItem[];
  weakItems: LanguageItem[];
  missingItems: LanguageItem[];
  coverageScore: number;
  unlockNextRecommendations: UnlockRecommendation[];
};

export type LearningTargetContext = {
  gamesById: Map<string, Game>;
  productsById: Map<string, Product>;
  unitsById: Map<string, SourceUnit>;
};

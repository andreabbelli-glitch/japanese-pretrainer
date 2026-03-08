export type LanguageItemKind =
  | 'kanji'
  | 'vocab'
  | 'verb'
  | 'adjective'
  | 'pattern'
  | 'keyword'
  | 'counter'
  | 'phrase'
  | 'function-word';

export type ItemPriority = 'core' | 'important' | 'nice';

export type LanguageItem = {
  id: string;
  legacyId?: string;
  kind: LanguageItemKind;
  surface: string;
  reading: string;
  meaning_it: string;
  explanation_eli5: string;
  scope: 'general' | 'tcg' | 'game-specific';
  priority: ItemPriority;
  senses: string[];
  relatedItemIds: string[];
  prerequisiteItemIds: string[];
  exampleIds: string[];
  sourceRefs: Array<{ kind: string; value: string }>;
};

export type Example = {
  id: string;
  legacyId?: string;
  jp: string;
  reading: string;
  translation_it: string;
  breakdown: string[];
  itemIds: string[];
  sourceUnitId: string;
  gameId: string;
  productId: string;
  lessonIds: string[];
};

export type Lesson = {
  id: string;
  layer: 'core' | 'game' | 'product';
  slug: string;
  title: string;
  summary: string;
  itemIds: string[];
  unitIds: string[];
  gameId?: string;
  productId?: string;
  body: string;
  filePath: string;
};

export type Game = {
  id: string;
  slug: string;
  name: string;
  language: 'ja';
  description_it: string;
  status: 'active' | 'draft' | 'archived';
};

export type Product = {
  id: string;
  gameId: string;
  slug: string;
  name: string;
  productType: string;
  summary_it: string;
  unitIds: string[];
  lessonIds: string[];
};

export type SourceUnit = {
  id: string;
  legacyId?: string;
  gameId: string;
  productId: string;
  unitType: 'card';
  slug: string;
  name: string;
  nameReading: string;
  jpText: string;
  reading?: string;
  paraphrase_it: string;
  requiredItemIds: string[];
  keyItemIds: string[];
  keyPatternIds: string[];
  recommendedLessonIds: string[];
  priorityWeight: number;
  sourceUrl: string;
};

// Transitional compatibility types (UI/review still expects Study* names)
export type StudyItemType = 'kanji' | 'vocab' | 'keyword' | 'pattern';

export type StudyItem = {
  id: string;
  legacyId: string;
  type: StudyItemType;
  term: string;
  reading: string;
  meaning: string;
  corpusCompounds: string[];
  exampleText: string;
  sourceCardName: string;
  sourceUrl: string;
  relatedExampleIds: string[];
  relatedCardIds: string[];
  lessonIds: string[];
  priority: ItemPriority;
};

export type StudyCard = {
  id: string;
  deckId: 'DECK-SD1' | 'DECK-SD2';
  slug: string;
  nameJa: string;
  nameReading: string;
  quickSenseIt: string;
  keySentenceJa: string;
  keyItemIds: string[];
  keyPatternIds: string[];
  itemIds: string[];
  lessonIds: string[];
  sourceUrl: string;
};

export type StudyExample = {
  id: string;
  textJa: string;
  glossIt: string;
  sourceType: 'item' | 'card-guide';
  sourceRefId: string;
  cardId: string;
  lessonIds: string[];
  itemIds: string[];
};

export type StudyDeck = {
  id: 'DECK-SD1' | 'DECK-SD2';
  slug: string;
  name: string;
  totalCards: number;
  uniqueCards: string[];
  cardCopies: Array<{ cardId: string; quantity: number | null }>;
  notes: string;
};

export type LessonDocument = StudyLesson;

export type StudyLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  itemIds: string[];
  cardIds: string[];
  body: string;
  filePath: string;
};

export type ContentGraph = {
  languageItems: LanguageItem[];
  examplesCanonical: Example[];
  lessonsCanonical: Lesson[];
  games: Game[];
  products: Product[];
  units: SourceUnit[];
  items: StudyItem[];
  cards: StudyCard[];
  examples: StudyExample[];
  decks: StudyDeck[];
  lessons: StudyLesson[];
};

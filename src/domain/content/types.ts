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
  priority: 'core' | 'important' | 'nice';
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

export type LessonDocument = {
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
  items: StudyItem[];
  cards: StudyCard[];
  examples: StudyExample[];
  decks: StudyDeck[];
  lessons: LessonDocument[];
};

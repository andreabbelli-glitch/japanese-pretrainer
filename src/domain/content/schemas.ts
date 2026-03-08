import type { ContentGraph, LessonDocument, StudyCard, StudyDeck, StudyExample, StudyItem } from './types';

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string');

export const parseStudyItem = (value: unknown): StudyItem => {
  const item = value as StudyItem;
  assertCondition(typeof item?.id === 'string', 'item.id mancante');
  assertCondition(typeof item.legacyId === 'string', `${item.id}: legacyId mancante`);
  assertCondition(['kanji', 'vocab', 'keyword', 'pattern'].includes(item.type), `${item.id}: type non valido`);
  assertCondition(typeof item.term === 'string', `${item.id}: term mancante`);
  assertCondition(typeof item.reading === 'string', `${item.id}: reading mancante`);
  assertCondition(typeof item.meaning === 'string', `${item.id}: meaning mancante`);
  assertCondition(isStringArray(item.corpusCompounds), `${item.id}: corpusCompounds non valido`);
  assertCondition(typeof item.exampleText === 'string', `${item.id}: exampleText mancante`);
  assertCondition(typeof item.sourceCardName === 'string', `${item.id}: sourceCardName mancante`);
  assertCondition(typeof item.sourceUrl === 'string', `${item.id}: sourceUrl mancante`);
  assertCondition(isStringArray(item.relatedExampleIds), `${item.id}: relatedExampleIds non valido`);
  assertCondition(isStringArray(item.relatedCardIds), `${item.id}: relatedCardIds non valido`);
  assertCondition(isStringArray(item.lessonIds), `${item.id}: lessonIds non valido`);
  assertCondition(['core', 'important', 'nice'].includes(item.priority), `${item.id}: priority non valida`);
  return item;
};

export const parseStudyCard = (value: unknown): StudyCard => {
  const card = value as StudyCard;
  assertCondition(typeof card?.id === 'string', 'card.id mancante');
  assertCondition(card.deckId === 'DECK-SD1' || card.deckId === 'DECK-SD2', `${card.id}: deckId non valido`);
  assertCondition(typeof card.slug === 'string', `${card.id}: slug mancante`);
  assertCondition(typeof card.nameJa === 'string', `${card.id}: nameJa mancante`);
  assertCondition(typeof card.nameReading === 'string', `${card.id}: nameReading mancante`);
  assertCondition(typeof card.quickSenseIt === 'string', `${card.id}: quickSenseIt mancante`);
  assertCondition(typeof card.keySentenceJa === 'string', `${card.id}: keySentenceJa mancante`);
  assertCondition(isStringArray(card.keyItemIds), `${card.id}: keyItemIds non valido`);
  assertCondition(isStringArray(card.keyPatternIds), `${card.id}: keyPatternIds non valido`);
  assertCondition(isStringArray(card.itemIds), `${card.id}: itemIds non valido`);
  assertCondition(isStringArray(card.lessonIds), `${card.id}: lessonIds non valido`);
  assertCondition(typeof card.sourceUrl === 'string', `${card.id}: sourceUrl mancante`);
  return card;
};

export const parseStudyExample = (value: unknown): StudyExample => {
  const example = value as StudyExample;
  assertCondition(typeof example?.id === 'string', 'example.id mancante');
  assertCondition(typeof example.textJa === 'string', `${example.id}: textJa mancante`);
  assertCondition(typeof example.glossIt === 'string', `${example.id}: glossIt mancante`);
  assertCondition(example.sourceType === 'item' || example.sourceType === 'card-guide', `${example.id}: sourceType non valido`);
  assertCondition(typeof example.sourceRefId === 'string', `${example.id}: sourceRefId mancante`);
  assertCondition(typeof example.cardId === 'string', `${example.id}: cardId mancante`);
  assertCondition(isStringArray(example.lessonIds), `${example.id}: lessonIds non valido`);
  assertCondition(isStringArray(example.itemIds), `${example.id}: itemIds non valido`);
  return example;
};

export const parseStudyDeck = (value: unknown): StudyDeck => {
  const deck = value as StudyDeck;
  assertCondition(deck.id === 'DECK-SD1' || deck.id === 'DECK-SD2', 'deck.id non valido');
  assertCondition(typeof deck.slug === 'string', `${deck.id}: slug mancante`);
  assertCondition(typeof deck.name === 'string', `${deck.id}: name mancante`);
  assertCondition(typeof deck.totalCards === 'number', `${deck.id}: totalCards mancante`);
  assertCondition(isStringArray(deck.uniqueCards), `${deck.id}: uniqueCards non valido`);
  assertCondition(Array.isArray(deck.cardCopies), `${deck.id}: cardCopies non valido`);
  assertCondition(typeof deck.notes === 'string', `${deck.id}: notes mancante`);
  return deck;
};

export const parseLessonDocument = (lesson: LessonDocument): LessonDocument => {
  assertCondition(/^L-\d{2}$/.test(lesson.id), `${lesson.filePath}: lesson id non valido`);
  assertCondition(typeof lesson.slug === 'string' && lesson.slug.length > 0, `${lesson.filePath}: slug mancante`);
  assertCondition(typeof lesson.title === 'string' && lesson.title.length > 0, `${lesson.filePath}: title mancante`);
  assertCondition(typeof lesson.summary === 'string' && lesson.summary.length > 0, `${lesson.filePath}: summary mancante`);
  assertCondition(isStringArray(lesson.itemIds) && lesson.itemIds.length > 0, `${lesson.filePath}: itemIds mancanti`);
  assertCondition(isStringArray(lesson.cardIds) && lesson.cardIds.length > 0, `${lesson.filePath}: cardIds mancanti`);
  return lesson;
};

export const parseContentGraph = (graph: ContentGraph): ContentGraph => {
  graph.items.forEach(parseStudyItem);
  graph.cards.forEach(parseStudyCard);
  graph.examples.forEach(parseStudyExample);
  graph.decks.forEach(parseStudyDeck);
  graph.lessons.forEach(parseLessonDocument);
  return graph;
};

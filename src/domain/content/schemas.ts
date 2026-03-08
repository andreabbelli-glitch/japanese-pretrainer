import type {
  ContentGraph,
  Example,
  Game,
  LanguageItem,
  Lesson,
  Product,
  SourceUnit,
  StudyCard,
  StudyDeck,
  StudyExample,
  StudyItem,
  StudyLesson,
} from './types';

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string');

export const parseLanguageItem = (value: unknown): LanguageItem => {
  const item = value as LanguageItem;
  assertCondition(typeof item?.id === 'string', 'language item.id mancante');
  assertCondition(typeof item.kind === 'string', `${item.id}: kind mancante`);
  assertCondition(typeof item.surface === 'string', `${item.id}: surface mancante`);
  assertCondition(typeof item.reading === 'string', `${item.id}: reading mancante`);
  assertCondition(typeof item.meaning_it === 'string', `${item.id}: meaning_it mancante`);
  assertCondition(typeof item.explanation_eli5 === 'string', `${item.id}: explanation_eli5 mancante`);
  assertCondition(['general', 'tcg', 'game-specific'].includes(item.scope), `${item.id}: scope non valido`);
  assertCondition(['core', 'important', 'nice'].includes(item.priority), `${item.id}: priority non valida`);
  assertCondition(isStringArray(item.senses), `${item.id}: senses non valido`);
  assertCondition(isStringArray(item.relatedItemIds), `${item.id}: relatedItemIds non valido`);
  assertCondition(isStringArray(item.prerequisiteItemIds), `${item.id}: prerequisiteItemIds non valido`);
  assertCondition(isStringArray(item.exampleIds), `${item.id}: exampleIds non valido`);
  assertCondition(Array.isArray(item.sourceRefs), `${item.id}: sourceRefs non valido`);
  return item;
};

export const parseExample = (value: unknown): Example => {
  const example = value as Example;
  assertCondition(typeof example?.id === 'string', 'example.id mancante');
  assertCondition(typeof example.jp === 'string', `${example.id}: jp mancante`);
  assertCondition(typeof example.translation_it === 'string', `${example.id}: translation_it mancante`);
  assertCondition(isStringArray(example.itemIds), `${example.id}: itemIds non valido`);
  assertCondition(typeof example.sourceUnitId === 'string', `${example.id}: sourceUnitId mancante`);
  assertCondition(typeof example.gameId === 'string', `${example.id}: gameId mancante`);
  assertCondition(typeof example.productId === 'string', `${example.id}: productId mancante`);
  assertCondition(isStringArray(example.lessonIds), `${example.id}: lessonIds non valido`);
  return example;
};

export const parseLesson = (value: unknown): Lesson => {
  const lesson = value as Lesson;
  assertCondition(typeof lesson?.id === 'string', 'lesson.id mancante');
  assertCondition(['core', 'game', 'product'].includes(lesson.layer), `${lesson.id}: layer non valido`);
  assertCondition(typeof lesson.slug === 'string', `${lesson.id}: slug mancante`);
  assertCondition(typeof lesson.title === 'string', `${lesson.id}: title mancante`);
  assertCondition(typeof lesson.summary === 'string', `${lesson.id}: summary mancante`);
  assertCondition(isStringArray(lesson.itemIds), `${lesson.id}: itemIds non valido`);
  assertCondition(isStringArray(lesson.unitIds), `${lesson.id}: unitIds non valido`);
  assertCondition(typeof lesson.body === 'string', `${lesson.id}: body mancante`);
  assertCondition(typeof lesson.filePath === 'string', `${lesson.id}: filePath mancante`);
  return lesson;
};

export const parseGame = (value: unknown): Game => {
  const game = value as Game;
  assertCondition(typeof game?.id === 'string', 'game.id mancante');
  assertCondition(typeof game.slug === 'string', `${game.id}: slug mancante`);
  assertCondition(typeof game.name === 'string', `${game.id}: name mancante`);
  assertCondition(game.language === 'ja', `${game.id}: language non valida`);
  assertCondition(typeof game.description_it === 'string', `${game.id}: description_it mancante`);
  assertCondition(['active', 'draft', 'archived'].includes(game.status), `${game.id}: status non valido`);
  return game;
};

export const parseProduct = (value: unknown): Product => {
  const product = value as Product;
  assertCondition(typeof product?.id === 'string', 'product.id mancante');
  assertCondition(typeof product.gameId === 'string', `${product.id}: gameId mancante`);
  assertCondition(typeof product.slug === 'string', `${product.id}: slug mancante`);
  assertCondition(typeof product.name === 'string', `${product.id}: name mancante`);
  assertCondition(typeof product.productType === 'string', `${product.id}: productType mancante`);
  assertCondition(typeof product.summary_it === 'string', `${product.id}: summary_it mancante`);
  assertCondition(isStringArray(product.unitIds), `${product.id}: unitIds non valido`);
  assertCondition(isStringArray(product.lessonIds), `${product.id}: lessonIds non valido`);
  return product;
};

export const parseSourceUnit = (value: unknown): SourceUnit => {
  const unit = value as SourceUnit;
  assertCondition(typeof unit?.id === 'string', 'unit.id mancante');
  assertCondition(typeof unit.gameId === 'string', `${unit.id}: gameId mancante`);
  assertCondition(typeof unit.productId === 'string', `${unit.id}: productId mancante`);
  assertCondition(unit.unitType === 'card', `${unit.id}: unitType non valido`);
  assertCondition(typeof unit.slug === 'string', `${unit.id}: slug mancante`);
  assertCondition(typeof unit.name === 'string', `${unit.id}: name mancante`);
  assertCondition(typeof unit.jpText === 'string', `${unit.id}: jpText mancante`);
  assertCondition(typeof unit.paraphrase_it === 'string', `${unit.id}: paraphrase_it mancante`);
  assertCondition(isStringArray(unit.requiredItemIds), `${unit.id}: requiredItemIds non valido`);
  assertCondition(isStringArray(unit.keyItemIds), `${unit.id}: keyItemIds non valido`);
  assertCondition(isStringArray(unit.keyPatternIds), `${unit.id}: keyPatternIds non valido`);
  assertCondition(isStringArray(unit.recommendedLessonIds), `${unit.id}: recommendedLessonIds non valido`);
  assertCondition(typeof unit.priorityWeight === 'number', `${unit.id}: priorityWeight mancante`);
  assertCondition(typeof unit.sourceUrl === 'string', `${unit.id}: sourceUrl mancante`);
  return unit;
};

export const parseContentGraph = (value: unknown): ContentGraph => {
  const graph = value as ContentGraph;
  assertCondition(Array.isArray(graph.languageItems), 'graph.languageItems non valido');
  assertCondition(Array.isArray(graph.examplesCanonical), 'graph.examplesCanonical non valido');
  assertCondition(Array.isArray(graph.lessonsCanonical), 'graph.lessonsCanonical non valido');
  assertCondition(Array.isArray(graph.games), 'graph.games non valido');
  assertCondition(Array.isArray(graph.products), 'graph.products non valido');
  assertCondition(Array.isArray(graph.units), 'graph.units non valido');

  assertCondition(Array.isArray(graph.items), 'graph.items non valido');
  assertCondition(Array.isArray(graph.examples), 'graph.examples non valido');
  assertCondition(Array.isArray(graph.cards), 'graph.cards non valido');
  assertCondition(Array.isArray(graph.decks), 'graph.decks non valido');
  assertCondition(Array.isArray(graph.lessons), 'graph.lessons non valido');

  return graph;
};

export const parseStudyItem = (value: unknown): StudyItem => value as StudyItem;
export const parseStudyExample = (value: unknown): StudyExample => value as StudyExample;
export const parseStudyCard = (value: unknown): StudyCard => value as StudyCard;
export const parseStudyDeck = (value: unknown): StudyDeck => value as StudyDeck;
export const parseLessonDocument = (value: unknown): StudyLesson => value as StudyLesson;

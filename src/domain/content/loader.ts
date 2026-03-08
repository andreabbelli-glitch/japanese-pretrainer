import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseContentGraph,
  parseExample,
  parseGame,
  parseLanguageItem,
  parseLesson,
  parseProduct,
  parseSourceUnit,
} from './schemas';
import type { ContentGraph, Example, LanguageItem, Lesson, Product, SourceUnit, StudyDeck } from './types';

const CONTENT_ROOT = join(process.cwd(), 'content');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const parseFrontmatter = (source: string) => {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Frontmatter non trovato');
  const [, fm, body] = match;
  const fields = new Map<string, string>();

  for (const line of fm.split('\n')) {
    const [key, ...valueParts] = line.split(':');
    if (!key || valueParts.length === 0) continue;
    fields.set(key.trim(), valueParts.join(':').trim());
  }

  const parseArray = (raw: string | undefined) => {
    if (!raw) return [];
    return raw
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((v) => v.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  };

  return {
    id: (fields.get('id') ?? '').replace(/^"|"$/g, ''),
    layer: (fields.get('layer') ?? '').replace(/^"|"$/g, ''),
    slug: (fields.get('slug') ?? '').replace(/^"|"$/g, ''),
    title: (fields.get('title') ?? '').replace(/^"|"$/g, ''),
    summary: (fields.get('summary') ?? '').replace(/^"|"$/g, ''),
    itemIds: parseArray(fields.get('itemIds')),
    unitIds: parseArray(fields.get('unitIds')),
    gameId: (fields.get('gameId') ?? '').replace(/^"|"$/g, ''),
    productId: (fields.get('productId') ?? '').replace(/^"|"$/g, ''),
    body: body.trim(),
  };
};

const loadLessonFolder = (relativeDir: string): Lesson[] => {
  const dir = join(CONTENT_ROOT, relativeDir);
  const files = readdirSync(dir).filter((file) => file.endsWith('.mdx')).sort();

  return files.map((file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    const parsed = parseFrontmatter(source);
    return parseLesson({
      ...parsed,
      gameId: parsed.gameId || undefined,
      productId: parsed.productId || undefined,
      filePath: `${relativeDir}/${file}`,
    });
  });
};

const toStudyType = (kind: LanguageItem['kind']) => {
  if (kind === 'kanji') return 'kanji';
  if (kind === 'pattern') return 'pattern';
  if (kind === 'keyword') return 'keyword';
  return 'vocab';
};

export const loadContentGraph = (): ContentGraph => {
  const languageItems = readJson<{ items: LanguageItem[] }>(join(CONTENT_ROOT, 'language', 'items', 'items.json')).items.map(parseLanguageItem);
  const examplesCanonical = readJson<{ examples: Example[] }>(join(CONTENT_ROOT, 'language', 'examples', 'examples.json')).examples.map(parseExample);
  const games = [readJson<{ game: unknown }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'meta', 'game.json')).game].map(parseGame);

  const products = [
    readJson<{ product: Product }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd1', 'meta', 'product.json')).product,
    readJson<{ product: Product }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd2', 'meta', 'product.json')).product,
  ].map(parseProduct);

  const units = [
    ...readJson<{ units: SourceUnit[] }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd1', 'units', 'units.json')).units,
    ...readJson<{ units: SourceUnit[] }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd2', 'units', 'units.json')).units,
  ].map(parseSourceUnit);

  const lessonsCanonical = [
    ...loadLessonFolder('language/lessons/core'),
    ...loadLessonFolder('games/duel-masters/lessons'),
    ...loadLessonFolder('games/duel-masters/products/dm25-sd1/lessons'),
    ...loadLessonFolder('games/duel-masters/products/dm25-sd2/lessons'),
  ].sort((a, b) => a.id.localeCompare(b.id));

  const deckByProduct: Record<string, StudyDeck['id']> = {
    'product.dm25-sd1': 'DECK-SD1',
    'product.dm25-sd2': 'DECK-SD2',
  };

  const cards = units.map((unit) => ({
    id: unit.id,
    deckId: deckByProduct[unit.productId],
    slug: unit.slug,
    nameJa: unit.name,
    nameReading: unit.nameReading,
    quickSenseIt: unit.paraphrase_it,
    keySentenceJa: unit.jpText,
    keyItemIds: unit.keyItemIds,
    keyPatternIds: unit.keyPatternIds,
    itemIds: unit.requiredItemIds,
    lessonIds: unit.recommendedLessonIds,
    sourceUrl: unit.sourceUrl,
  }));

  const lessons = lessonsCanonical.map((lesson) => ({
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    itemIds: lesson.itemIds,
    cardIds: lesson.unitIds,
    body: lesson.body,
    filePath: lesson.filePath,
  }));

  const items = languageItems.map((item) => {
    const relatedCardIds = cards.filter((card) => card.itemIds.includes(item.id)).map((card) => card.id);
    const lessonIds = lessons.filter((lesson) => lesson.itemIds.includes(item.id)).map((lesson) => lesson.id);
    const sourceCardName = cards.find((card) => card.id === relatedCardIds[0])?.nameJa ?? '';
    const sourceUrl = cards.find((card) => card.id === relatedCardIds[0])?.sourceUrl ?? '';

    return {
      id: item.id,
      legacyId: item.legacyId ?? item.id,
      type: toStudyType(item.kind),
      term: item.surface,
      reading: item.reading,
      meaning: item.meaning_it,
      corpusCompounds: item.senses,
      exampleText: item.explanation_eli5,
      sourceCardName,
      sourceUrl,
      relatedExampleIds: item.exampleIds,
      relatedCardIds,
      lessonIds,
      priority: item.priority,
    };
  });

  const examples = examplesCanonical.map((example) => ({
    id: example.id,
    textJa: example.jp,
    glossIt: example.translation_it,
    sourceType: 'card-guide' as const,
    sourceRefId: example.sourceUnitId,
    cardId: example.sourceUnitId,
    lessonIds: example.lessonIds,
    itemIds: example.itemIds,
  }));

  const decks: StudyDeck[] = products.map((product) => {
    const cardsInDeck = cards.filter((card) => card.deckId === (product.id === 'product.dm25-sd1' ? 'DECK-SD1' : 'DECK-SD2'));
    return {
      id: product.id === 'product.dm25-sd1' ? 'DECK-SD1' : 'DECK-SD2',
      slug: product.slug,
      name: product.name,
      totalCards: 40,
      uniqueCards: cardsInDeck.map((card) => card.id),
      cardCopies: cardsInDeck.map((card) => ({ cardId: card.id, quantity: null })),
      notes: product.summary_it,
    };
  });

  return parseContentGraph({
    languageItems,
    examplesCanonical,
    lessonsCanonical,
    games,
    products,
    units,
    items,
    cards,
    examples,
    decks,
    lessons,
  });
};

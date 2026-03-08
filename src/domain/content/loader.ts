import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
  if (!existsSync(dir)) return [];
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const listDirectories = (path: string) =>
  readdirSync(path).filter((entry) => statSync(join(path, entry)).isDirectory());

export const loadContentGraph = (): ContentGraph => {
  const languageItems = readJson<{ items: LanguageItem[] }>(join(CONTENT_ROOT, 'language', 'items', 'items.json')).items.map(parseLanguageItem);
  const examplesCanonical = readJson<{ examples: Example[] }>(join(CONTENT_ROOT, 'language', 'examples', 'examples.json')).examples.map(parseExample);

  const gamesRoot = join(CONTENT_ROOT, 'games');
  const gameDirs = listDirectories(gamesRoot);

  const games = gameDirs
    .map((gameDir) => readJson<{ game: unknown }>(join(gamesRoot, gameDir, 'meta', 'game.json')).game)
    .map(parseGame);

  const products: Product[] = [];
  const units: SourceUnit[] = [];
  const lessonsCanonical: Lesson[] = [...loadLessonFolder('language/lessons/core')];

  for (const gameDir of gameDirs) {
    const gameProductsRoot = join(gamesRoot, gameDir, 'products');
    const productDirs = existsSync(gameProductsRoot) && statSync(gameProductsRoot).isDirectory() ? listDirectories(gameProductsRoot) : [];

    lessonsCanonical.push(...loadLessonFolder(`games/${gameDir}/lessons`));

    for (const productDir of productDirs) {
      const product = readJson<{ product: Product }>(join(gameProductsRoot, productDir, 'meta', 'product.json')).product;
      products.push(parseProduct(product));

      const unitsInProduct = readJson<{ units: SourceUnit[] }>(join(gameProductsRoot, productDir, 'units', 'units.json')).units;
      units.push(...unitsInProduct.map(parseSourceUnit));

      lessonsCanonical.push(...loadLessonFolder(`games/${gameDir}/products/${productDir}/lessons`));
    }
  }

  lessonsCanonical.sort((a, b) => a.id.localeCompare(b.id));

  const deckByProductId = new Map(products.map((product) => [product.id, `DECK-${slugify(product.slug || product.id).toUpperCase()}`]));

  const cards = units.map((unit) => ({
    id: unit.id,
    deckId: (deckByProductId.get(unit.productId) ?? `DECK-${slugify(unit.productId).toUpperCase()}`) as StudyDeck['id'],
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
    const deckId = (deckByProductId.get(product.id) ?? `DECK-${slugify(product.slug || product.id).toUpperCase()}`) as StudyDeck['id'];
    const cardsInDeck = cards.filter((card) => card.deckId === deckId);
    return {
      id: deckId,
      slug: product.slug,
      name: product.name,
      totalCards: cardsInDeck.length,
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

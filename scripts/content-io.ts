import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_ROOT = join(process.cwd(), 'content');

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const parseFrontmatter = (source: string) => {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Frontmatter non trovato');
  const [, fm, body] = match;
  const map = new Map<string, string>();

  for (const line of fm.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    map.set(key.trim(), rest.join(':').trim());
  }

  const parseArray = (raw: string | undefined) =>
    (raw ?? '')
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((v) => v.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

  return {
    id: (map.get('id') ?? '').replace(/^"|"$/g, ''),
    layer: (map.get('layer') ?? '').replace(/^"|"$/g, ''),
    slug: (map.get('slug') ?? '').replace(/^"|"$/g, ''),
    title: (map.get('title') ?? '').replace(/^"|"$/g, ''),
    summary: (map.get('summary') ?? '').replace(/^"|"$/g, ''),
    itemIds: parseArray(map.get('itemIds')),
    unitIds: parseArray(map.get('unitIds')),
    gameId: (map.get('gameId') ?? '').replace(/^"|"$/g, ''),
    productId: (map.get('productId') ?? '').replace(/^"|"$/g, ''),
    body: body.trim(),
  };
};

const loadLessons = (relativeDir: string) => {
  const dir = join(CONTENT_ROOT, relativeDir);
  const files = readdirSync(dir).filter((file) => file.endsWith('.mdx')).sort();
  return files.map((file) => ({ ...parseFrontmatter(readFileSync(join(dir, file), 'utf8')), filePath: `content/${relativeDir}/${file}` }));
};

export const loadContent = () => {
  const languageItems = readJson<{ items: unknown[] }>(join(CONTENT_ROOT, 'language', 'items', 'items.json')).items;
  const examples = readJson<{ examples: unknown[] }>(join(CONTENT_ROOT, 'language', 'examples', 'examples.json')).examples;
  const game = readJson<{ game: unknown }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'meta', 'game.json')).game;
  const products = [
    readJson<{ product: unknown }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd1', 'meta', 'product.json')).product,
    readJson<{ product: unknown }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd2', 'meta', 'product.json')).product,
  ];
  const units = [
    ...readJson<{ units: unknown[] }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd1', 'units', 'units.json')).units,
    ...readJson<{ units: unknown[] }>(join(CONTENT_ROOT, 'games', 'duel-masters', 'products', 'dm25-sd2', 'units', 'units.json')).units,
  ];
  const lessons = [
    ...loadLessons('language/lessons/core'),
    ...loadLessons('games/duel-masters/lessons'),
    ...loadLessons('games/duel-masters/products/dm25-sd1/lessons'),
    ...loadLessons('games/duel-masters/products/dm25-sd2/lessons'),
  ];

  return { languageItems, examples, game, products, units, lessons };
};

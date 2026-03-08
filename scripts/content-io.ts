import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((file) => file.endsWith('.mdx')).sort();
  return files.map((file) => ({ ...parseFrontmatter(readFileSync(join(dir, file), 'utf8')), filePath: `content/${relativeDir}/${file}` }));
};

const listDirectories = (path: string) => readdirSync(path).filter((entry) => statSync(join(path, entry)).isDirectory());

export const loadContent = () => {
  const languageItems = readJson<{ items: unknown[] }>(join(CONTENT_ROOT, 'language', 'items', 'items.json')).items;
  const examples = readJson<{ examples: unknown[] }>(join(CONTENT_ROOT, 'language', 'examples', 'examples.json')).examples;

  const gamesRoot = join(CONTENT_ROOT, 'games');
  const gameDirs = listDirectories(gamesRoot);

  const games = gameDirs.map((gameDir) => readJson<{ game: unknown }>(join(gamesRoot, gameDir, 'meta', 'game.json')).game);
  const products: unknown[] = [];
  const units: unknown[] = [];
  const lessons = [...loadLessons('language/lessons/core')];

  for (const gameDir of gameDirs) {
    const gameProductsRoot = join(gamesRoot, gameDir, 'products');
    const productDirs = existsSync(gameProductsRoot) && statSync(gameProductsRoot).isDirectory() ? listDirectories(gameProductsRoot) : [];

    lessons.push(...loadLessons(`games/${gameDir}/lessons`));

    for (const productDir of productDirs) {
      products.push(readJson<{ product: unknown }>(join(gameProductsRoot, productDir, 'meta', 'product.json')).product);
      units.push(...readJson<{ units: unknown[] }>(join(gameProductsRoot, productDir, 'units', 'units.json')).units);
      lessons.push(...loadLessons(`games/${gameDir}/products/${productDir}/lessons`));
    }
  }

  return { languageItems, examples, game: games[0], games, products, units, lessons };
};

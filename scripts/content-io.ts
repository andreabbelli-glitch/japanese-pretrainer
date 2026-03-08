import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CONTENT_ROOT = join(ROOT, 'content');

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
    id: map.get('id') ?? '',
    slug: map.get('slug') ?? '',
    title: (map.get('title') ?? '').replace(/^"|"$/g, ''),
    summary: (map.get('summary') ?? '').replace(/^"|"$/g, ''),
    itemIds: parseArray(map.get('itemIds')),
    cardIds: parseArray(map.get('cardIds')),
    body: body.trim(),
  };
};

export const loadContent = (): any => {
  const items = [
    ...readJson<{ items: unknown[] }>(join(CONTENT_ROOT, 'items', 'kanji.json')).items,
    ...readJson<{ items: unknown[] }>(join(CONTENT_ROOT, 'items', 'vocab.json')).items,
    ...readJson<{ items: unknown[] }>(join(CONTENT_ROOT, 'items', 'keyword.json')).items,
    ...readJson<{ items: unknown[] }>(join(CONTENT_ROOT, 'items', 'pattern.json')).items,
  ];
  const cards = readJson<{ cards: unknown[] }>(join(CONTENT_ROOT, 'cards', 'cards.json')).cards;
  const examples = readJson<{ examples: unknown[] }>(join(CONTENT_ROOT, 'examples', 'examples.json')).examples;
  const decks = readJson<{ decks: unknown[] }>(join(CONTENT_ROOT, 'meta', 'decks.json')).decks;

  const lessons = readdirSync(join(CONTENT_ROOT, 'lessons'))
    .filter((file) => file.endsWith('.mdx'))
    .sort()
    .map((file) => {
      const parsed = parseFrontmatter(readFileSync(join(CONTENT_ROOT, 'lessons', file), 'utf8'));
      return { ...parsed, filePath: `content/lessons/${file}` };
    });

  return { items, cards, examples, decks, lessons };
};

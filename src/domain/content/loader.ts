import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseContentGraph, parseLessonDocument } from './schemas';
import type { ContentGraph, LessonDocument, StudyCard, StudyDeck, StudyExample, StudyItem } from './types';

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
    id: fields.get('id') ?? '',
    slug: fields.get('slug') ?? '',
    title: (fields.get('title') ?? '').replace(/^"|"$/g, ''),
    summary: (fields.get('summary') ?? '').replace(/^"|"$/g, ''),
    itemIds: parseArray(fields.get('itemIds')),
    cardIds: parseArray(fields.get('cardIds')),
    body: body.trim(),
  };
};

const loadLessons = (): LessonDocument[] => {
  const dir = join(CONTENT_ROOT, 'lessons');
  const files = readdirSync(dir).filter((file) => file.endsWith('.mdx')).sort();

  return files.map((file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    const parsed = parseFrontmatter(source);
    const lesson: LessonDocument = {
      ...parsed,
      filePath: `content/lessons/${file}`,
    };
    return parseLessonDocument(lesson);
  });
};

export const loadContentGraph = (): ContentGraph => {
  const kanji = readJson<{ items: StudyItem[] }>(join(CONTENT_ROOT, 'items', 'kanji.json')).items;
  const vocab = readJson<{ items: StudyItem[] }>(join(CONTENT_ROOT, 'items', 'vocab.json')).items;
  const keyword = readJson<{ items: StudyItem[] }>(join(CONTENT_ROOT, 'items', 'keyword.json')).items;
  const pattern = readJson<{ items: StudyItem[] }>(join(CONTENT_ROOT, 'items', 'pattern.json')).items;
  const cards = readJson<{ cards: StudyCard[] }>(join(CONTENT_ROOT, 'cards', 'cards.json')).cards;
  const examples = readJson<{ examples: StudyExample[] }>(join(CONTENT_ROOT, 'examples', 'examples.json')).examples;
  const decks = readJson<{ decks: StudyDeck[] }>(join(CONTENT_ROOT, 'meta', 'decks.json')).decks;
  const lessons = loadLessons();

  return parseContentGraph({
    items: [...kanji, ...vocab, ...keyword, ...pattern],
    cards,
    examples,
    decks,
    lessons,
  });
};

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type LegacyType = 'K' | 'V' | 'P';

type Item = {
  id: string;
  legacyId: string;
  type: 'kanji' | 'vocab' | 'keyword' | 'pattern';
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

type Card = {
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

type Example = {
  id: string;
  textJa: string;
  glossIt: string;
  sourceType: 'item' | 'card-guide';
  sourceRefId: string;
  cardId: string;
  lessonIds: string[];
  itemIds: string[];
};

const ROOT = process.cwd();
const STUDY_GUIDE = join(ROOT, 'duel-masters-jp-study-guide-sd1-sd2-v1.md');
const CONTENT_DIR = join(ROOT, 'content');

const decodeEntities = (value: string) =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .trim();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s\/]+/g, '-')
    .replace(/[^a-z0-9\-]+/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');

const normalizeLegacyId = (legacy: string) => {
  const match = legacy.match(/^([KVP])(\d{2})$/);
  if (!match) {
    throw new Error(`Legacy ID non valido: ${legacy}`);
  }
  const prefix = match[1];
  const num = Number(match[2]);
  if (prefix === 'K') return `K-${String(num).padStart(3, '0')}`;
  if (prefix === 'V') return `V-${String(num).padStart(3, '0')}`;
  return `P-${String(num).padStart(3, '0')}`;
};

const parseTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((part) => decodeEntities(part));

const markdown = readFileSync(STUDY_GUIDE, 'utf8');
const lines = markdown.split('\n');

const itemRows = lines.filter((line) => /^\|\s*[KVP]\d{2}\s*\|/.test(line));
const cardGuideRows = lines.filter((line) => /^\|\s*SD[12]\s*\|/.test(line));

const cardSources = new Map<string, string>();
let inCardSources = false;
for (const line of lines) {
  if (line.startsWith('### Card database — DM25-SD1') || line.startsWith('### Card database — DM25-SD2')) {
    inCardSources = true;
    continue;
  }
  if (inCardSources && line.startsWith('## ')) {
    inCardSources = false;
  }
  if (!inCardSources) continue;
  const match = line.match(/^- \[(.+)\]\((https?:\/\/[^)]+)\)/);
  if (!match) continue;
  cardSources.set(decodeEntities(match[1]), match[2]);
}

const cardCounter = { SD1: 0, SD2: 0 };
const cardIdByName = new Map<string, string>();
for (const row of cardGuideRows) {
  const cols = parseTableRow(row);
  const deckShort = cols[0] as 'SD1' | 'SD2';
  const nameJa = cols[1];
  if (!cardIdByName.has(nameJa)) {
    cardCounter[deckShort] += 1;
    cardIdByName.set(nameJa, `CARD-${deckShort}-${String(cardCounter[deckShort]).padStart(3, '0')}`);
  }
}

const items: Item[] = [];
const examples: Example[] = [];
const cardLinksByItem = new Map<string, Set<string>>();
const exampleLinksByItem = new Map<string, Set<string>>();

for (const row of itemRows) {
  const cols = parseTableRow(row);
  const legacyId = cols[0];
  const stableId = normalizeLegacyId(legacyId);
  const term = cols[1];
  const reading = cols[2];
  const meaning = cols[3];
  const typePrefix = legacyId[0] as LegacyType;
  const compounds =
    typePrefix === 'P'
      ? []
      : (cols[4] ?? '')
          .split('/')
          .map((v) => v.trim())
          .filter(Boolean);
  const exampleText = typePrefix === 'P' ? cols[4] : cols[5];
  const sourceCell = typePrefix === 'P' ? cols[5] : cols[6];
  const sourceLink = sourceCell?.match(/\[(.+)\]\((https?:\/\/[^)]+)\)/);
  const sourceCardName = sourceLink ? decodeEntities(sourceLink[1]) : sourceCell;
  const sourceUrl = sourceLink ? sourceLink[2] : '';
  const cardId = cardIdByName.get(sourceCardName) ?? '';

  const idx = Number(legacyId.slice(1));
  const type: Item['type'] =
    typePrefix === 'K' ? 'kanji' : typePrefix === 'P' ? 'pattern' : idx <= 38 ? 'vocab' : 'keyword';

  const lessonIds =
    typePrefix === 'K'
      ? idx <= 20
        ? ['L-01']
        : ['L-02']
      : typePrefix === 'V'
        ? idx <= 20
          ? ['L-01']
          : idx <= 38
            ? ['L-02']
            : idx <= 57
              ? ['L-05', 'L-06']
              : ['L-03']
        : idx <= 10
          ? ['L-03']
          : idx <= 18
            ? ['L-04']
            : ['L-07', 'L-08'];

  const exampleId = `EX-${String(examples.length + 1).padStart(4, '0')}`;
  examples.push({
    id: exampleId,
    textJa: exampleText,
    glossIt: `Esempio nel corpus per ${stableId}`,
    sourceType: 'item',
    sourceRefId: stableId,
    cardId,
    lessonIds,
    itemIds: [stableId],
  });

  if (!cardLinksByItem.has(stableId)) cardLinksByItem.set(stableId, new Set());
  if (cardId) cardLinksByItem.get(stableId)?.add(cardId);
  if (!exampleLinksByItem.has(stableId)) exampleLinksByItem.set(stableId, new Set());
  exampleLinksByItem.get(stableId)?.add(exampleId);

  items.push({
    id: stableId,
    legacyId,
    type,
    term,
    reading,
    meaning,
    corpusCompounds: compounds,
    exampleText,
    sourceCardName,
    sourceUrl,
    relatedExampleIds: [exampleId],
    relatedCardIds: cardId ? [cardId] : [],
    lessonIds,
    priority: idx <= 36 || (typePrefix === 'V' && idx <= 38) || (typePrefix === 'P' && idx <= 24) ? 'core' : 'important',
  });
}

const cards: Card[] = cardGuideRows.map((row) => {
  const cols = parseTableRow(row);
  const deckShort = cols[0] as 'SD1' | 'SD2';
  const deckId = deckShort === 'SD1' ? 'DECK-SD1' : 'DECK-SD2';
  const nameJa = cols[1];
  const nameReading = cols[2];
  const quickSenseIt = cols[3];
  const keySentenceJa = cols[4];
  const vocabIds = (cols[5].match(/V\d{2}/g) ?? []).map(normalizeLegacyId);
  const patternIds = (cols[6].match(/P\d{2}/g) ?? []).map(normalizeLegacyId);
  const sourceLink = cols[7].match(/\[(.+)\]\((https?:\/\/[^)]+)\)/);

  const cardId = cardIdByName.get(nameJa)!;
  const lessonIds = deckShort === 'SD1' ? ['L-05', 'L-07'] : ['L-06', 'L-08'];

  const exId = `EX-${String(examples.length + 1).padStart(4, '0')}`;
  examples.push({
    id: exId,
    textJa: keySentenceJa,
    glossIt: `Frase guida carta ${nameJa}`,
    sourceType: 'card-guide',
    sourceRefId: cardId,
    cardId,
    lessonIds,
    itemIds: [...vocabIds, ...patternIds],
  });

  for (const itemId of [...vocabIds, ...patternIds]) {
    if (!cardLinksByItem.has(itemId)) cardLinksByItem.set(itemId, new Set());
    cardLinksByItem.get(itemId)?.add(cardId);
    if (!exampleLinksByItem.has(itemId)) exampleLinksByItem.set(itemId, new Set());
    exampleLinksByItem.get(itemId)?.add(exId);
  }

  return {
    id: cardId,
    deckId,
    slug: slugify(`${cardId}-${nameJa}`),
    nameJa,
    nameReading,
    quickSenseIt,
    keySentenceJa,
    keyItemIds: vocabIds,
    keyPatternIds: patternIds,
    itemIds: [...new Set([...vocabIds, ...patternIds])],
    lessonIds,
    sourceUrl: sourceLink ? sourceLink[2] : cardSources.get(nameJa) ?? '',
  };
});

const patchedItems = items.map((item) => ({
  ...item,
  relatedCardIds: [...(cardLinksByItem.get(item.id) ?? [])],
  relatedExampleIds: [...(exampleLinksByItem.get(item.id) ?? [])],
}));

const lessonMeta = [
  {
    id: 'L-01', slug: 'fondamenta-del-testo-carta', title: 'L1 — Fondamenta del giapponese carta',
    summary: 'Kanji e lessico base per iniziare a leggere trigger, zone e azioni principali.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-01')).map((i) => i.id),
    cardIds: cards.filter((c) => c.deckId === 'DECK-SD1').slice(0, 4).map((c) => c.id),
  },
  {
    id: 'L-02', slug: 'zone-e-movimento', title: 'L2 — Zone e movimento',
    summary: 'Come leggere spostamenti tra mano, mazzo, cimitero e battle zone.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-02')).map((i) => i.id),
    cardIds: cards.filter((c) => c.deckId === 'DECK-SD1').slice(4, 8).map((c) => c.id),
  },
  {
    id: 'L-03', slug: 'timing-e-trigger', title: 'L3 — Timing e trigger',
    summary: 'Pattern temporali e condizioni: quando un effetto si attiva davvero.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-03')).map((i) => i.id),
    cardIds: cards.slice(0, 2).map((c) => c.id),
  },
  {
    id: 'L-04', slug: 'numeri-e-limiti', title: 'L4 — Numeri e limiti',
    summary: 'Soglie, confronti e targeting numerico nel testo delle carte.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-04')).map((i) => i.id),
    cardIds: cards.slice(2, 5).map((c) => c.id),
  },
  {
    id: 'L-05', slug: 'vocabolario-sd1', title: 'L5 — Vocabolario SD1',
    summary: 'Parole e keyword più frequenti nel deck DM25-SD1.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-05')).map((i) => i.id),
    cardIds: cards.filter((c) => c.deckId === 'DECK-SD1').map((c) => c.id),
  },
  {
    id: 'L-06', slug: 'vocabolario-sd2', title: 'L6 — Vocabolario SD2',
    summary: 'Parole e keyword più frequenti nel deck DM25-SD2.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-06')).map((i) => i.id),
    cardIds: cards.filter((c) => c.deckId === 'DECK-SD2').map((c) => c.id),
  },
  {
    id: 'L-07', slug: 'lettura-completa-sd1', title: 'L7 — Lettura completa di una carta SD1',
    summary: 'Metodo pratico per decodificare una carta SD1 passo per passo.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-07')).map((i) => i.id),
    cardIds: cards.filter((c) => c.deckId === 'DECK-SD1').map((c) => c.id),
  },
  {
    id: 'L-08', slug: 'lettura-completa-sd2', title: 'L8 — Lettura completa di una carta SD2',
    summary: 'Metodo pratico per decodificare una carta SD2 passo per passo.',
    itemIds: patchedItems.filter((i) => i.lessonIds.includes('L-08')).map((i) => i.id),
    cardIds: cards.filter((c) => c.deckId === 'DECK-SD2').map((c) => c.id),
  },
];

const decks = {
  decks: [
    {
      id: 'DECK-SD1',
      slug: 'dm25-sd1',
      name: 'DM25-SD1 いきなりつよいデッキ 技の王道',
      totalCards: 40,
      uniqueCards: cards.filter((card) => card.deckId === 'DECK-SD1').map((card) => card.id),
      cardCopies: cards
        .filter((card) => card.deckId === 'DECK-SD1')
        .map((card) => ({ cardId: card.id, quantity: null })),
      notes: 'Quantità per singola carta non presenti nel file sorgente; mappatura completa per carte uniche supportate nel corpus.',
    },
    {
      id: 'DECK-SD2',
      slug: 'dm25-sd2',
      name: 'DM25-SD2 いきなりつよいデッキ 力の王道',
      totalCards: 40,
      uniqueCards: cards.filter((card) => card.deckId === 'DECK-SD2').map((card) => card.id),
      cardCopies: cards
        .filter((card) => card.deckId === 'DECK-SD2')
        .map((card) => ({ cardId: card.id, quantity: null })),
      notes: 'Quantità per singola carta non presenti nel file sorgente; mappatura completa per carte uniche supportate nel corpus.',
    },
  ],
};

for (const dir of ['items', 'cards', 'examples', 'lessons', 'meta']) {
  mkdirSync(join(CONTENT_DIR, dir), { recursive: true });
}

writeFileSync(join(CONTENT_DIR, 'items', 'kanji.json'), JSON.stringify({ items: patchedItems.filter((i) => i.type === 'kanji') }, null, 2));
writeFileSync(join(CONTENT_DIR, 'items', 'vocab.json'), JSON.stringify({ items: patchedItems.filter((i) => i.type === 'vocab') }, null, 2));
writeFileSync(join(CONTENT_DIR, 'items', 'keyword.json'), JSON.stringify({ items: patchedItems.filter((i) => i.type === 'keyword') }, null, 2));
writeFileSync(join(CONTENT_DIR, 'items', 'pattern.json'), JSON.stringify({ items: patchedItems.filter((i) => i.type === 'pattern') }, null, 2));
writeFileSync(join(CONTENT_DIR, 'cards', 'cards.json'), JSON.stringify({ cards }, null, 2));
writeFileSync(join(CONTENT_DIR, 'examples', 'examples.json'), JSON.stringify({ examples }, null, 2));
writeFileSync(join(CONTENT_DIR, 'meta', 'decks.json'), JSON.stringify(decks, null, 2));
writeFileSync(
  join(CONTENT_DIR, 'meta', 'source-map.json'),
  JSON.stringify(
    {
      sourceStudyGuide: 'duel-masters-jp-study-guide-sd1-sd2-v1.md',
      migratedAt: new Date().toISOString(),
      itemCount: patchedItems.length,
      cardCount: cards.length,
      exampleCount: examples.length,
    },
    null,
    2,
  ),
);

for (const lesson of lessonMeta) {
  const body = `---
id: ${lesson.id}
slug: ${lesson.slug}
title: "${lesson.title}"
summary: "${lesson.summary}"
itemIds: [${lesson.itemIds.map((id) => `"${id}"`).join(', ')}]
cardIds: [${lesson.cardIds.map((id) => `"${id}"`).join(', ')}]
---

## Cosa impari

Questa lezione prepara la lettura reale del testo carta con un approccio ELI5, legato al corpus SD1/SD2.

## Spiegazione ELI5

Contenuto scaffold pronto: completare le spiegazioni dettagliate mantenendo esempi reali dalle carte collegate.

## Come riconoscerlo su una carta

Usa i riferimenti in ` + '`itemIds`' + ` e ` + '`cardIds`' + ` per collegare subito teoria e casi reali.
`;

  writeFileSync(join(CONTENT_DIR, 'lessons', `${lesson.id.toLowerCase()}-${lesson.slug}.mdx`), body);
}

console.log(`Migrazione completata: ${patchedItems.length} item, ${cards.length} carte, ${examples.length} esempi, ${lessonMeta.length} lezioni.`);

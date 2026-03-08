import { loadContent } from './content-io.ts';

const duplicateIds = (ids: string[]) => {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
};

const fail = (errors: string[]) => {
  if (errors.length === 0) return;
  console.error('Validazione content fallita:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
};

const graph = loadContent();
const errors: string[] = [];

const itemIds = graph.items.map((i) => i.id);
const cardIds = graph.cards.map((c) => c.id);
const lessonIds = graph.lessons.map((l) => l.id);
const exampleIds = graph.examples.map((e) => e.id);

for (const id of duplicateIds([...itemIds, ...cardIds, ...lessonIds, ...exampleIds])) {
  errors.push(`ID duplicato: ${id}`);
}

const itemSet = new Set(itemIds);
const cardSet = new Set(cardIds);
const lessonSet = new Set(lessonIds);
const exampleSet = new Set(exampleIds);

for (const item of graph.items) {
  for (const id of item.relatedCardIds) {
    if (!cardSet.has(id)) errors.push(`${item.id}: relatedCardId rotto (${id})`);
  }
  for (const id of item.relatedExampleIds) {
    if (!exampleSet.has(id)) errors.push(`${item.id}: relatedExampleId rotto (${id})`);
  }
  for (const id of item.lessonIds) {
    if (!lessonSet.has(id)) errors.push(`${item.id}: lessonId rotto (${id})`);
  }
  if (item.relatedCardIds.length + item.relatedExampleIds.length + item.lessonIds.length === 0) {
    errors.push(`${item.id}: item senza collegamenti utili`);
  }
}

for (const card of graph.cards) {
  if (card.itemIds.length === 0) {
    errors.push(`${card.id}: card senza itemIds`);
  }
  for (const id of card.itemIds) {
    if (!itemSet.has(id)) errors.push(`${card.id}: itemId rotto (${id})`);
  }
  for (const id of card.lessonIds) {
    if (!lessonSet.has(id)) errors.push(`${card.id}: lessonId rotto (${id})`);
  }
}

for (const lesson of graph.lessons) {
  if (!lesson.id || !lesson.slug || !lesson.summary || lesson.itemIds.length === 0 || lesson.cardIds.length === 0) {
    errors.push(`${lesson.filePath}: lesson senza metadati minimi`);
  }
  for (const id of lesson.itemIds) {
    if (!itemSet.has(id)) errors.push(`${lesson.id}: itemId rotto (${id})`);
  }
  for (const id of lesson.cardIds) {
    if (!cardSet.has(id)) errors.push(`${lesson.id}: cardId rotto (${id})`);
  }
}

for (const example of graph.examples) {
  if (example.cardId && !cardSet.has(example.cardId)) errors.push(`${example.id}: cardId rotto (${example.cardId})`);
  for (const id of example.itemIds) {
    if (!itemSet.has(id)) errors.push(`${example.id}: itemId rotto (${id})`);
  }
  for (const id of example.lessonIds) {
    if (!lessonSet.has(id)) errors.push(`${example.id}: lessonId rotto (${id})`);
  }
}

for (const deck of graph.decks) {
  for (const cardId of deck.uniqueCards) {
    if (!cardSet.has(cardId)) errors.push(`${deck.id}: uniqueCards rotto (${cardId})`);
  }
}

fail(errors);
console.log(`Validazione OK: ${graph.items.length} item, ${graph.examples.length} esempi, ${graph.cards.length} carte, ${graph.lessons.length} lezioni.`);

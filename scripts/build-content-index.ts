import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from './content-io.ts';

const graph = loadContent();

const index = {
  generatedAt: new Date().toISOString(),
  totals: {
    items: graph.items.length,
    kanji: graph.items.filter((i) => i.type === 'kanji').length,
    vocab: graph.items.filter((i) => i.type === 'vocab').length,
    keyword: graph.items.filter((i) => i.type === 'keyword').length,
    pattern: graph.items.filter((i) => i.type === 'pattern').length,
    examples: graph.examples.length,
    cards: graph.cards.length,
    lessons: graph.lessons.length,
    decks: graph.decks.length,
  },
  deckCoverageMap: graph.decks.map((deck) => ({
    deckId: deck.id,
    uniqueCardCount: deck.uniqueCards.length,
    totalCards: deck.totalCards,
    lessonIds: [...new Set(graph.cards.filter((c) => c.deckId === deck.id).flatMap((c) => c.lessonIds))],
  })),
  lessonMap: graph.lessons.map((lesson) => ({
    lessonId: lesson.id,
    slug: lesson.slug,
    itemCount: lesson.itemIds.length,
    cardCount: lesson.cardIds.length,
  })),
};

const outputPath = join(process.cwd(), 'content', 'meta', 'content-index.json');
writeFileSync(outputPath, JSON.stringify(index, null, 2));

console.log(`Indice contenuto scritto in ${outputPath}`);

import { cache } from 'react';
import { loadContentGraph } from '@/src/domain/content/loader';
import type { Example, Game, LanguageItem, Lesson, Product, SourceUnit, StudyCard, StudyDeck, StudyExample, StudyItem } from '@/src/domain/content/types';

export const getContentGraph = cache(loadContentGraph);

export function getLanguageItems(): LanguageItem[] {
  return getContentGraph().languageItems;
}

export function getLanguageItemById(id: string): LanguageItem | undefined {
  return getLanguageItems().find((item) => item.id === id);
}

export function getCanonicalExamples(): Example[] {
  return getContentGraph().examplesCanonical;
}

export function getCanonicalLessons(): Lesson[] {
  return getContentGraph().lessonsCanonical;
}

export function getCoreLessons(): Lesson[] {
  return getCanonicalLessons().filter((lesson) => lesson.layer === 'core');
}

export function getGameLessons(gameId: string): Lesson[] {
  return getCanonicalLessons().filter((lesson) => lesson.layer === 'game' && lesson.gameId === gameId);
}

export function getProductLessons(gameId: string, productId: string): Lesson[] {
  return getCanonicalLessons().filter(
    (lesson) => lesson.layer === 'product' && lesson.gameId === gameId && lesson.productId === productId,
  );
}

export function getCanonicalLessonBySlug(layer: 'core' | 'game' | 'product', slug: string, gameId?: string, productId?: string): Lesson | undefined {
  return getCanonicalLessons().find(
    (lesson) => lesson.layer === layer && lesson.slug === slug && (!gameId || lesson.gameId === gameId) && (!productId || lesson.productId === productId),
  );
}

export function getGames(): Game[] {
  return getContentGraph().games;
}

export function getGameById(gameId: string): Game | undefined {
  return getGames().find((game) => game.id === gameId || game.slug === gameId);
}

export function getProducts(): Product[] {
  return getContentGraph().products;
}

export function getProductsByGame(gameId: string): Product[] {
  return getProducts().filter((product) => product.gameId === gameId);
}

export function getProductById(gameId: string, productId: string): Product | undefined {
  return getProductsByGame(gameId).find((product) => product.id === productId || product.slug === productId);
}

export function getSourceUnits(): SourceUnit[] {
  return getContentGraph().units;
}

export function getUnitsByProduct(gameId: string, productId: string): SourceUnit[] {
  return getSourceUnits().filter((unit) => unit.gameId === gameId && unit.productId === productId);
}

export function getUnitById(gameId: string, productId: string, unitId: string): SourceUnit | undefined {
  return getUnitsByProduct(gameId, productId).find((unit) => unit.id === unitId || unit.slug === unitId);
}

// Transitional compatibility selectors used by existing UI/routes
export function getLessons() {
  return getContentGraph().lessons;
}

export function getLessonBySlug(slug: string) {
  return getLessons().find((lesson) => lesson.slug === slug);
}

export function getItems(): StudyItem[] {
  return getContentGraph().items;
}

export function getItemById(id: string): StudyItem | undefined {
  return getItems().find((item) => item.id === id);
}

export function getCards(): StudyCard[] {
  return getContentGraph().cards;
}

export function getCardById(id: string): StudyCard | undefined {
  return getCards().find((card) => card.id === id);
}

export function getCardBySlug(slug: string): StudyCard | undefined {
  return getCards().find((card) => card.slug === slug);
}

export function getExamples(): StudyExample[] {
  return getContentGraph().examples;
}

export function getExamplesForItem(itemId: string): StudyExample[] {
  return getExamples().filter((example) => example.itemIds.includes(itemId));
}

export function getExamplesForCard(cardId: string): StudyExample[] {
  return getExamples().filter((example) => example.cardId === cardId);
}

export function getDecks(): StudyDeck[] {
  return getContentGraph().decks;
}

export function getDeckBySlug(slug: string): StudyDeck | undefined {
  return getDecks().find((deck) => deck.slug === slug);
}

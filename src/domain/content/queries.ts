import { cache } from 'react';
import { loadContentGraph } from '@/src/domain/content/loader';
import type { Example, Game, LanguageItem, Lesson, Product, SourceUnit, StudyCard, StudyDeck, StudyExample, StudyItem } from '@/src/domain/content/types';

export const getContentGraph = cache(loadContentGraph);

export function getLanguageItems(): LanguageItem[] {
  return getContentGraph().languageItems;
}

export function getCanonicalExamples(): Example[] {
  return getContentGraph().examplesCanonical;
}

export function getCanonicalLessons(): Lesson[] {
  return getContentGraph().lessonsCanonical;
}

export function getGames(): Game[] {
  return getContentGraph().games;
}

export function getProducts(): Product[] {
  return getContentGraph().products;
}

export function getSourceUnits(): SourceUnit[] {
  return getContentGraph().units;
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

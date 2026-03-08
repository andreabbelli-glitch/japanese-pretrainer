import { cache } from "react";
import { loadContentGraph } from "@/src/domain/content/loader";
import type { LessonDocument, StudyCard, StudyDeck, StudyExample, StudyItem } from "@/src/domain/content/types";

export const getContentGraph = cache(loadContentGraph);

export function getLessons() {
  return getContentGraph().lessons;
}

export function getLessonBySlug(slug: string): LessonDocument | undefined {
  return getLessons().find((lesson) => lesson.slug === slug);
}

export function getItems() {
  return getContentGraph().items;
}

export function getItemById(id: string): StudyItem | undefined {
  return getItems().find((item) => item.id === id);
}

export function getCards() {
  return getContentGraph().cards;
}

export function getCardById(id: string): StudyCard | undefined {
  return getCards().find((card) => card.id === id);
}

export function getCardBySlug(slug: string): StudyCard | undefined {
  return getCards().find((card) => card.slug === slug);
}

export function getExamples() {
  return getContentGraph().examples;
}

export function getExamplesForItem(itemId: string): StudyExample[] {
  return getExamples().filter((example) => example.itemIds.includes(itemId));
}

export function getExamplesForCard(cardId: string): StudyExample[] {
  return getExamples().filter((example) => example.cardId === cardId);
}

export function getDecks() {
  return getContentGraph().decks;
}

export function getDeckBySlug(slug: string): StudyDeck | undefined {
  return getDecks().find((deck) => deck.slug === slug);
}

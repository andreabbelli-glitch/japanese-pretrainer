import {
  getCanonicalLessonBySlug,
  getCoreLessons,
  getGameById,
  getGameLessons,
  getGames,
  getProductById,
  getProductLessons,
  getProductsByGame,
  getUnitById,
  getUnitsByProduct,
} from '@/src/domain/content';

export function loadGamesIndex() {
  return getGames();
}

export function loadGamePage(gameId: string) {
  const game = getGameById(gameId);
  if (!game) return null;

  return {
    game,
    products: getProductsByGame(game.id),
    lessons: getGameLessons(game.id),
  };
}

export function loadProductPage(gameId: string, productId: string) {
  const game = getGameById(gameId);
  if (!game) return null;

  const product = getProductById(game.id, productId);
  if (!product) return null;

  return {
    game,
    product,
    units: getUnitsByProduct(game.id, product.id),
    lessons: getProductLessons(game.id, product.id),
  };
}

export function loadUnitPage(gameId: string, productId: string, unitId: string) {
  const data = loadProductPage(gameId, productId);
  if (!data) return null;

  const unit = getUnitById(data.game.id, data.product.id, unitId);
  if (!unit) return null;

  return {
    ...data,
    unit,
  };
}

export function loadCoreLesson(slug: string) {
  return getCanonicalLessonBySlug('core', slug);
}

export function loadGameLesson(gameId: string, slug: string) {
  const game = getGameById(gameId);
  if (!game) return null;
  return getCanonicalLessonBySlug('game', slug, game.id);
}

export function loadProductLesson(gameId: string, productId: string, slug: string) {
  const data = loadProductPage(gameId, productId);
  if (!data) return null;
  return getCanonicalLessonBySlug('product', slug, data.game.id, data.product.id);
}

export function loadCoreLessonsIndex() {
  return getCoreLessons();
}

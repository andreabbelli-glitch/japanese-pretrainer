import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from './content-io.ts';

const graph = loadContent();

const index = {
  generatedAt: new Date().toISOString(),
  totals: {
    languageItems: graph.languageItems.length,
    examples: graph.examples.length,
    units: graph.units.length,
    lessons: graph.lessons.length,
    products: graph.products.length,
  },
  byLayer: {
    core: graph.lessons.filter((lesson: any) => lesson.layer === 'core').length,
    game: graph.lessons.filter((lesson: any) => lesson.layer === 'game').length,
    product: graph.lessons.filter((lesson: any) => lesson.layer === 'product').length,
  },
  products: graph.products.map((product: any) => ({
    productId: product.id,
    slug: product.slug,
    unitCount: product.unitIds.length,
    lessonCount: product.lessonIds.length,
  })),
};

const outputPath = join(process.cwd(), 'content', 'language', 'meta', 'content-index.json');
writeFileSync(outputPath, JSON.stringify(index, null, 2));
console.log(`Indice contenuto scritto in ${outputPath}`);

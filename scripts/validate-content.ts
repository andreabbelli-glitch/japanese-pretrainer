import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
};

const fail = (errors: string[]) => {
  if (errors.length === 0) return;
  console.error('Validazione content fallita:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
};

const graph = loadContent();
const errors: string[] = [];

const itemIds = graph.languageItems.map((i: any) => i.id);
const exampleIds = graph.examples.map((e: any) => e.id);
const lessonIds = graph.lessons.map((l: any) => l.id);
const productIds = graph.products.map((p: any) => p.id);
const unitIds = graph.units.map((u: any) => u.id);
const gameId = (graph.game as any).id;

for (const id of duplicateIds([...itemIds, ...exampleIds, ...lessonIds, ...productIds, ...unitIds, gameId])) {
  errors.push(`ID duplicato: ${id}`);
}

const itemSet = new Set(itemIds);
const unitSet = new Set(unitIds);
const lessonSet = new Set(lessonIds);
const productSet = new Set(productIds);

for (const item of graph.languageItems as any[]) {
  for (const id of [...item.relatedItemIds, ...item.prerequisiteItemIds]) {
    if (!itemSet.has(id)) errors.push(`${item.id}: reference item rotto (${id})`);
  }
  for (const exId of item.exampleIds) {
    if (!exampleIds.includes(exId)) errors.push(`${item.id}: exampleId rotto (${exId})`);
  }
}

for (const unit of graph.units as any[]) {
  if (!Array.isArray(unit.requiredItemIds) || unit.requiredItemIds.length === 0) {
    errors.push(`${unit.id}: unit senza requiredItemIds`);
  }
  for (const id of [...unit.requiredItemIds, ...unit.keyItemIds, ...unit.keyPatternIds]) {
    if (!itemSet.has(id)) errors.push(`${unit.id}: itemId rotto (${id})`);
  }
  for (const lessonId of unit.recommendedLessonIds) {
    if (!lessonSet.has(lessonId)) errors.push(`${unit.id}: recommendedLessonId rotto (${lessonId})`);
  }
  if (!productSet.has(unit.productId)) errors.push(`${unit.id}: productId rotto (${unit.productId})`);
}

for (const lesson of graph.lessons as any[]) {
  if (!lesson.id || !lesson.slug || !lesson.title || !lesson.summary || !lesson.layer || lesson.itemIds.length === 0 || lesson.unitIds.length === 0) {
    errors.push(`${lesson.filePath}: lesson senza metadati minimi`);
  }
  for (const id of lesson.itemIds) {
    if (!itemSet.has(id)) errors.push(`${lesson.id}: itemId rotto (${id})`);
  }
  for (const id of lesson.unitIds) {
    if (!unitSet.has(id)) errors.push(`${lesson.id}: unitId rotto (${id})`);
  }
}

for (const example of graph.examples as any[]) {
  for (const id of example.itemIds) {
    if (!itemSet.has(id)) errors.push(`${example.id}: itemId rotto (${id})`);
  }
  if (!unitSet.has(example.sourceUnitId)) errors.push(`${example.id}: sourceUnitId rotto (${example.sourceUnitId})`);
  if (!productSet.has(example.productId)) errors.push(`${example.id}: productId rotto (${example.productId})`);
  for (const lessonId of example.lessonIds) {
    if (!lessonSet.has(lessonId)) errors.push(`${example.id}: lessonId rotto (${lessonId})`);
  }
}

const duplicatedLanguageItemsOutsideCanonical = walk(join(process.cwd(), 'content', 'games')).filter((path) => /\/items\//.test(path) || /items\.json$/.test(path));
if (duplicatedLanguageItemsOutsideCanonical.length > 0) {
  errors.push(`Language item duplicati in folders game-specific: ${duplicatedLanguageItemsOutsideCanonical.join(', ')}`);
}

fail(errors);
console.log(`Validazione OK: ${itemIds.length} language item, ${graph.examples.length} esempi, ${graph.units.length} unità, ${graph.lessons.length} lezioni.`);

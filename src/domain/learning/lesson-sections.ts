import type { Lesson } from '@/src/domain/content';

const SECTION_KEYS = [
  'cosa impari',
  'spiegazione eli5',
  'come lo riconosci sulla carta',
  'esempi reali',
  'errori comuni / falsi amici',
  'micro-drill',
  'item collegati da mettere in review',
  'carte dei deck dove appare',
] as const;

export type LessonSectionKey = (typeof SECTION_KEYS)[number];

export function parseLessonSections(body: Lesson['body']): Record<LessonSectionKey, string> {
  const sections: Record<LessonSectionKey, string> = {
    'cosa impari': '',
    'spiegazione eli5': '',
    'come lo riconosci sulla carta': '',
    'esempi reali': '',
    'errori comuni / falsi amici': '',
    'micro-drill': '',
    'item collegati da mettere in review': '',
    'carte dei deck dove appare': '',
  };

  const chunks = body.split(/^##\s+/m).map((chunk) => chunk.trim()).filter(Boolean);

  for (const chunk of chunks) {
    const [rawHeading, ...rest] = chunk.split('\n');
    const heading = rawHeading.toLowerCase().trim();
    const content = rest.join('\n').trim();
    const key = SECTION_KEYS.find((candidate) => heading.startsWith(candidate));
    if (key) {
      sections[key] = content;
    }
  }

  return sections;
}

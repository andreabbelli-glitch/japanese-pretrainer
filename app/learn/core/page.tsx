import Link from 'next/link';
import { PageShell } from '@/src/components/page-shell';
import { loadCoreLessonsIndex } from '@/src/domain/learning';

export default function CoreLearnPage() {
  const lessons = loadCoreLessonsIndex();

  return (
    <PageShell
      title="Core Japanese Layer"
      description="Base linguistica canonica: impari una volta e riusi su giochi/prodotti diversi."
    >
      <ul className="space-y-2">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <Link href={`/learn/core/${lesson.slug}`} className="font-semibold text-slate-900 hover:underline">
              {lesson.title}
            </Link>
            <p className="text-sm text-slate-700">{lesson.summary}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

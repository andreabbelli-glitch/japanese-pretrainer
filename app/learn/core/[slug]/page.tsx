import { notFound } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { loadCoreLesson } from '@/src/domain/learning';

export default async function CoreLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = loadCoreLesson(slug);

  if (!lesson) {
    notFound();
  }

  return (
    <PageShell title={lesson.title} description={lesson.summary}>
      <article className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <pre className="whitespace-pre-wrap font-sans">{lesson.body}</pre>
      </article>
    </PageShell>
  );
}

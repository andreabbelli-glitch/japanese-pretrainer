import { notFound } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { loadGameLesson } from '@/src/domain/learning';

export default async function GameLessonPage({ params }: { params: Promise<{ gameId: string; slug: string }> }) {
  const { gameId, slug } = await params;
  const lesson = loadGameLesson(gameId, slug);

  if (!lesson) {
    notFound();
  }

  return (
    <PageShell title={lesson.title} description={lesson.summary}>
      <article className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <pre className="whitespace-pre-wrap font-sans">{lesson.body}</pre>
      </article>
    </PageShell>
  );
}

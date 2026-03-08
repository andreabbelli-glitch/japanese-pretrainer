import { notFound } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { loadProductLesson } from '@/src/domain/learning';

export default async function ProductLessonPage({ params }: { params: Promise<{ gameId: string; productId: string; slug: string }> }) {
  const { gameId, productId, slug } = await params;
  const lesson = loadProductLesson(gameId, productId, slug);

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

import type { Route } from "next";
import Link from "next/link";
import { PageShell } from "@/src/components/page-shell";
import { getLessons } from "@/src/domain/content";
import { createClient } from "@/src/lib/supabase/server";

type LessonStatus = "not_started" | "in_progress" | "completed";

async function getLessonProgressMap(lessonIds: string[]) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { isAuthenticated: false, map: new Map<string, LessonStatus>() };

    const { data } = (await supabase
      .from("lesson_progress")
      .select("lesson_id, status")
      .eq("user_id", user.id)
      .in("lesson_id", lessonIds)) as { data: Array<{ lesson_id: string; status: LessonStatus }> | null };

    const map = new Map<string, LessonStatus>();
    (data ?? []).forEach((row) => map.set(row.lesson_id, row.status));

    return { isAuthenticated: true, map };
  } catch {
    return { isAuthenticated: false, map: new Map<string, LessonStatus>() };
  }
}

export default async function LessonsPage() {
  const lessons = getLessons();
  const { isAuthenticated, map } = await getLessonProgressMap(lessons.map((lesson) => lesson.id));

  const completed = lessons.filter((lesson) => map.get(lesson.id) === "completed").length;
  const progressPct = lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0;

  return (
    <PageShell title="Textbook — Lezioni" description="Percorso guidato per leggere il giapponese delle carte SD1/SD2.">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-700">
          Progresso textbook: <span className="font-semibold text-slate-900">{completed}/{lessons.length}</span> lezioni completate ({progressPct}%).
        </p>
        <div className="h-2 w-full rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progressPct}%` }} />
        </div>
        {!isAuthenticated ? (
          <p className="text-xs text-slate-600">Fai login per salvare progresso reale (not_started / in_progress / completed).</p>
        ) : null}
      </section>

      <ul className="space-y-3">
        {lessons.map((lesson) => {
          const status = map.get(lesson.id) ?? "not_started";
          return (
            <li key={lesson.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lesson.id}</p>
                  <Link href={`/lessons/${lesson.slug}` as Route} className="text-lg font-semibold text-slate-900 hover:underline">
                    {lesson.title}
                  </Link>
                  <p className="text-sm text-slate-700">{lesson.summary}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{status.replace("_", " ")}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}

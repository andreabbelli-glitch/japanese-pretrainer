import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { computeDashboardMetrics, computeDeckCoverage, buildMasteryMap } from "@/src/domain/progress";
import { createClient } from "@/src/lib/supabase/server";
import {
  getAuthenticatedUserId,
  listRecentReviewEvents,
  listRecentReviewSessions,
  listUserItemProgress,
} from "@/src/features/user-data/repository";

export default async function DashboardPage() {
  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect("/login");
  }

  const [progressRows, events, sessions] = await Promise.all([
    listUserItemProgress(supabase, userId),
    listRecentReviewEvents(supabase, userId, 120),
    listRecentReviewSessions(supabase, userId, 45),
  ]);

  const metrics = computeDashboardMetrics({ progressRows, events, sessions });
  const masteryMap = buildMasteryMap(progressRows);
  const sd1 = computeDeckCoverage("dm25-sd1", masteryMap);
  const sd2 = computeDeckCoverage("dm25-sd2", masteryMap);

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard studio</h1>
        <p className="text-sm text-slate-700">Progresso reale: review, mastery e copertura deck SD1/SD2.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Metric label="In scadenza oggi" value={String(metrics.dueToday)} />
        <Metric label="Nuovi oggi" value={String(metrics.newToday)} />
        <Metric label="Serie" value={`${metrics.streakDays} giorni`} />
        <Metric label="Ritenzione stimata" value={`${metrics.retentionEstimate}%`} />
      </section>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-900">Conteggio item per stato</p>
        <div className="mt-2 grid gap-2 md:grid-cols-5">
          {Object.entries(metrics.countsByState).map(([state, count]) => (
            <p key={state} className="rounded bg-white px-2 py-1">
              {state}: <span className="font-semibold">{count}</span>
            </p>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <CoverageTile title="Copertura SD1" value={metrics.sd1Coverage} href={"/decks/dm25-sd1" as Route} />
        <CoverageTile title="Copertura SD2" value={metrics.sd2Coverage} href={"/decks/dm25-sd2" as Route} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Lezioni suggerite</p>
          {metrics.suggestedLessons.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {metrics.suggestedLessons.map((lesson) => (
                <li key={lesson.lessonId}>
                  <Link href={`/lessons/${lesson.slug}`} className="font-medium text-slate-900 underline">
                    {lesson.title}
                  </Link>
                  <p className="text-slate-700">{lesson.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-slate-700">Nessuna lezione suggerita ora.</p>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Ultime carte leggibili o quasi</p>
          {metrics.recentlyUnlockedCards.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {metrics.recentlyUnlockedCards.map((entry) => (
                <li key={entry.card.id}>
                  <Link href={`/cards/${entry.card.slug}`} className="font-medium text-slate-900 underline">
                    {entry.card.nameJa}
                  </Link>
                  <p>
                    {entry.coverage}% · {entry.status === "readable" ? "leggibile" : "quasi leggibile"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-slate-700">Nessuna carta in fascia ≥75% ancora.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <DeckInsight title="Top gap SD1" gaps={sd1?.topBottlenecks.map((gap) => `${gap.item.id} ${gap.item.term} · ${gap.cardCount} carte`) ?? []} />
        <DeckInsight title="Top gap SD2" gaps={sd2?.topBottlenecks.map((gap) => `${gap.item.id} ${gap.item.term} · ${gap.cardCount} carte`) ?? []} />
      </section>


      <section className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-900">Study next (impatto reale)</p>
        {metrics.studyNext.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {metrics.studyNext.map((entry) => (
              <li key={entry.item.id} className="rounded bg-white p-3">
                <p className="font-medium text-slate-900">
                  {entry.item.id} — {entry.item.term}
                </p>
                <p className="text-slate-700">
                  Se lo consolidi, aiuti: {entry.unlocks.slice(0, 3).map((card) => card.nameJa).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-slate-700">Nessuna priorità netta: continua con review giornaliera.</p>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/review" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Vai alla review
        </Link>
        <form action={logout}>
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Logout
          </button>
        </form>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-900">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function CoverageTile({ title, value, href }: { title: string; value: number; href: Route }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-900">{title}</p>
      <p>{value}%</p>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${value}%` }} />
      </div>
      <Link href={href} className="mt-2 inline-block underline">
        Apri deck
      </Link>
    </div>
  );
}

function DeckInsight({ title, gaps }: { title: string; gaps: string[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-900">{title}</p>
      {gaps.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {gaps.slice(0, 4).map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-slate-700">Nessun gap prioritario.</p>
      )}
    </div>
  );
}

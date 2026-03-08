import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/login/actions";
import { getDueQueueEntries, getReviewSettings } from "@/src/domain/review";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId } from "@/src/features/user-data/repository";

export default async function DashboardPage() {
  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect("/login");
  }

  const settings = await getReviewSettings(supabase, userId);
  const dueNow = await getDueQueueEntries(supabase, userId, settings.dailyReviewGoal);

  const { data: lastSession } = (await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data:
      | {
          status: string;
          reviewed_count: number;
          item_count: number;
        }
      | null;
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-700">Panoramica stato review e memoria.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Item dovuti ora</p>
          <p>{dueNow.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Obiettivo review giornaliero</p>
          <p>{settings.dailyReviewGoal}</p>
        </div>
      </section>

      {lastSession ? (
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Ultima sessione</p>
          <p>Status: {lastSession.status}</p>
          <p>
            Review completate: {lastSession.reviewed_count}/{lastSession.item_count}
          </p>
        </section>
      ) : (
        <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-700">Nessuna sessione review registrata finora.</p>
      )}

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

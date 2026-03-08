import { redirect } from "next/navigation";
import { updateDailyGoals } from "@/app/settings/actions";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId, getUserSettings } from "@/src/features/user-data/repository";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;

  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect("/login");
  }

  const settings = await getUserSettings(supabase, userId);

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Impostazioni</h1>
        <p className="text-sm text-slate-700">Configura i limiti della review giornaliera.</p>
      </header>

      {params.saved === "1" ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Impostazioni salvate.</p> : null}

      <form action={updateDailyGoals} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-900">Nuovi item al giorno</span>
          <input
            type="number"
            name="dailyNewLimit"
            min={0}
            max={200}
            defaultValue={settings?.daily_new_limit ?? 10}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-900">Obiettivo review giornaliero</span>
          <input
            type="number"
            name="dailyReviewGoal"
            min={0}
            max={500}
            defaultValue={settings?.daily_review_goal ?? 50}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>

        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Salva preferenze
        </button>
      </form>
    </section>
  );
}

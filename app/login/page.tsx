import { PageShell } from "@/src/components/page-shell";
import { loginWithMagicLink } from "./actions";

export default function LoginPage() {
  return (
    <PageShell
      title="Login"
      description="Autenticazione Supabase via magic link (wiring pronto, richiede variabili env valide)."
    >
      <form action={loginWithMagicLink} className="flex flex-col gap-3 sm:max-w-sm">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="tuo@email.com"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-white">
          Invia magic link
        </button>
      </form>
    </PageShell>
  );
}

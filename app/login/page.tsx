import { PageShell } from "@/src/components/page-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <PageShell
      title="Login"
      description="Autenticazione Supabase via magic link (wiring pronto, richiede variabili env valide)."
    >
      <LoginForm />
    </PageShell>
  );
}

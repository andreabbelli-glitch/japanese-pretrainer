import { redirect } from "next/navigation";

import { loginAction } from "@/actions/auth";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getAuthConfig } from "@/lib/auth";
import { readInternalHref } from "@/lib/site";

type LoginRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const config = getAuthConfig();

  if (!config.enabled) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const nextHref = readInternalHref(resolvedSearchParams.next);
  const showCredentialsError = resolvedSearchParams.error === "credentials";
  const showLoggedOutNotice = resolvedSearchParams.loggedOut === "1";

  return (
    <div className="auth-page">
      <SurfaceCard className="auth-card" variant="hero">
        <div className="auth-card__header">
          <p className="eyebrow">Area privata</p>
          <h1 className="auth-card__title">Login</h1>
          <p className="auth-card__summary">
            Inserisci username e password per entrare nell&apos;app.
          </p>
        </div>

        <form action={loginAction} className="auth-form">
          {nextHref ? (
            <input name="next" type="hidden" value={nextHref} />
          ) : null}

          {showCredentialsError ? (
            <p className="auth-notice auth-notice--error" role="alert">
              Credenziali non valide.
            </p>
          ) : null}

          {showLoggedOutNotice ? (
            <p className="auth-notice" role="status">
              Sessione chiusa.
            </p>
          ) : null}

          <label className="auth-field">
            <span className="auth-field__label">Username</span>
            <input
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              className="auth-field__control"
              name="username"
              placeholder="Username"
              required
              type="text"
            />
          </label>

          <label className="auth-field">
            <span className="auth-field__label">Password</span>
            <input
              autoComplete="current-password"
              className="auth-field__control"
              name="password"
              placeholder="Password"
              required
              type="password"
            />
          </label>

          <div className="auth-form__footer">
            <button className="button button--primary" type="submit">
              Entra
            </button>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
}

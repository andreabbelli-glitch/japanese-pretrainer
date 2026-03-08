"use client";

import { useActionState } from "react";
import { loginWithMagicLink, type LoginActionState } from "./actions";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginActionState, FormData>(
    loginWithMagicLink,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:max-w-sm">
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
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Invio in corso..." : "Invia magic link"}
      </button>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  );
}

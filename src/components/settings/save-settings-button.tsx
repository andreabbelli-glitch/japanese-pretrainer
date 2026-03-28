"use client";

import { useFormStatus } from "react-dom";

export function SaveSettingsButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className="button button--primary"
      disabled={pending}
      type="submit"
    >
      {pending ? "Salvataggio..." : "Salva preferenze"}
    </button>
  );
}

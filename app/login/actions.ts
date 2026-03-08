"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export type LoginActionState = {
  error?: string;
  success?: string;
};

export async function loginWithMagicLink(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Inserisci una email valida." };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/dashboard`,
    },
  });

  if (error) {
    return { error: "Invio link fallito. Controlla la configurazione Supabase." };
  }

  return { success: "Ti abbiamo inviato un link magico via email." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

import { LoadingShell } from "@/components/ui/loading-shell";

export default function SettingsLoading() {
  return (
    <LoadingShell
      summary="Sto caricando le preferenze persistenti di studio."
      title="Caricamento di Settings"
    />
  );
}

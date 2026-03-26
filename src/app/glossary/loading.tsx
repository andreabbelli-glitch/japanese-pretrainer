import { LoadingShell } from "@/components/ui/loading-shell";

export default function GlossaryLoading() {
  return (
    <LoadingShell
      summary="Sto caricando il glossary globale."
      title="Caricamento glossary"
    />
  );
}

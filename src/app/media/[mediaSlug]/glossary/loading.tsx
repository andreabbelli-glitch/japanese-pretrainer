import { LoadingShell } from "@/components/ui/loading-shell";

export default function MediaGlossaryLoading() {
  return (
    <LoadingShell
      summary="Sto preparando ricerca, filtri e anteprima del Glossary."
      title="Caricamento del Glossary"
    />
  );
}

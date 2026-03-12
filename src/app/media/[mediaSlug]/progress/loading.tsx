import { LoadingShell } from "@/components/ui/loading-shell";

export default function MediaProgressLoading() {
  return (
    <LoadingShell
      summary="Sto raccogliendo dati di Textbook, Glossary e Review per questo media."
      title="Caricamento di Progress"
    />
  );
}

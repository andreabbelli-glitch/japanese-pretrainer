import { LoadingShell } from "@/components/ui/loading-shell";

export default function MediaTextbookLoading() {
  return (
    <LoadingShell
      summary="Sto preparando il percorso lesson e il punto di ripresa."
      title="Caricamento textbook"
    />
  );
}

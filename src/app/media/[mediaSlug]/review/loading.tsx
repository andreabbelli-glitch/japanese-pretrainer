import { LoadingShell } from "@/components/ui/loading-shell";

export default function MediaReviewLoading() {
  return (
    <LoadingShell
      summary="Sto preparando la coda review e il contesto delle entry collegate."
      title="Caricamento review"
    />
  );
}

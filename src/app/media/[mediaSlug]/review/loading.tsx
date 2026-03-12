import { LoadingShell } from "@/components/ui/loading-shell";

export default function MediaReviewLoading() {
  return (
    <LoadingShell
      summary="Sto preparando la coda di Review e il contesto delle voci collegate."
      title="Caricamento di Review"
    />
  );
}

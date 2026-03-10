import { LoadingShell } from "@/components/ui/loading-shell";

export default function LessonReaderLoading() {
  return (
    <LoadingShell
      summary="Sto caricando la lesson con furigana, riferimenti e controlli di studio."
      title="Apertura lesson"
    />
  );
}

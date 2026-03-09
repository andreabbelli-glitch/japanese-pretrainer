import { PlaceholderPage } from "@/components/placeholder-page";

export default function ReviewPage() {
  return (
    <PlaceholderPage
      kicker="Sessioni quotidiane"
      sections={[
        {
          title: "Quadro della coda",
          body: "Questa pagina raccoglie il peso attuale della review e mantiene l'ingresso vicino al resto dello studio."
        },
        {
          title: "Dati reali",
          body: "Le card e gli stati review arrivano gia dal DB operativo, senza numeri inventati o coda simulata."
        }
      ]}
      summary="Questa area resta intenzionalmente leggera: mostra la review come parte del percorso, con un tono calmo e leggibile."
      title="Review"
    />
  );
}

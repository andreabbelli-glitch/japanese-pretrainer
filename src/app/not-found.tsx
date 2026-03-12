import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <EmptyState
        eyebrow="Percorso non trovato"
        title="Questa pagina non è disponibile nel workspace attuale."
        description="Controlla l'indirizzo del media o torna alla libreria per riprendere da un pacchetto esistente."
        action={
          <Link className="button button--primary" href="/media">
            Torna ai media
          </Link>
        }
      />
    </div>
  );
}

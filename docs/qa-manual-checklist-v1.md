# Checklist Manuale QA v1

## Setup locale

- Eseguire `./scripts/with-node.sh pnpm db:migrate`
- Eseguire `./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25`
- Eseguire `./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25`
- Avviare l'app con `./scripts/with-node.sh pnpm dev`

## Flussi principali

- Dashboard: compare `Duel Masters`, con CTA per riprendere studio e review.
- Libreria media: il media Duel Masters e visibile con metriche sintetiche coerenti.
- Media detail: le entry point `Textbook`, `Glossary`, `Review`, `Progress` sono tutte operative.
- Root review `/review`: reindirizza direttamente alla review del media di focus, senza placeholder.
- Textbook index: mostra le 4 lesson con stato coerente.
- Reader lesson: il toggle furigana aggiorna davvero il rendering.
- Reader lesson desktop: clic su un termine apre tooltip con `Apri entry`.
- Reader lesson mobile: tap su un termine apre sheet; `Lezioni` apre la rail mobile.
- Glossary: ricerca per kanji, kana e romaji (`bochi`, `yamafuda`, `侵略`) restituisce risultati sensati.
- Glossary detail: lesson e card collegate sono navigabili.
- Review: `Mostra risposta` funziona; grading `Again/Hard/Good/Easy` avanza la sessione.
- Progress: mostra textbook, coverage, review e setting persistiti.
- Settings: salvare furigana e ordine glossary aggiorna le viste collegate.

## Stati e resilienza

- Loading states: glossary, review, progress, settings e textbook mostrano messaggi contestuali, non generici.
- Empty states: nessuna pagina primaria espone placeholder incoerenti o “stati finti”.
- Content validate fallito: gli errori indicano file, categoria e messaggio leggibile.
- Content import su DB non migrato: il comando suggerisce esplicitamente `pnpm db:migrate`.

## Responsive e polish

- Desktop: reader con rail sticky e tooltip leggibile.
- Mobile: reader e glossary restano leggibili senza zoom orizzontale.
- Bottom navigation mobile non copre CTA o contenuto critico.
- I messaggi principali sono coerenti con il tono editoriale del prodotto.

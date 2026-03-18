# Checklist Manuale QA

## Setup locale

- Eseguire `./scripts/with-node.sh pnpm db:migrate`
- Eseguire `./scripts/with-node.sh pnpm content:validate`
- Eseguire `./scripts/with-node.sh pnpm content:import -- --content-root ./content`
- Avviare l'app con `./scripts/with-node.sh pnpm dev`

## Gate Finale

- Eseguire `./scripts/with-node.sh pnpm release:check`
- Il comando canonico copre lint, typecheck, test unit/integration, build, validazione contenuti sul bundle reale ed E2E

## Flussi principali

- Dashboard: compare `Duel Masters`, con CTA per riprendere studio e review.
- Libreria media: `Duel Masters` e `Mobile Suit Gundam Arsenal Base` sono entrambi visibili con metriche sintetiche coerenti.
- Ogni media attivo in `content/media` apre senza errori almeno `detail`, `textbook`, `glossary`, `review` e il redirect `progress`.
- Glossary globale `/glossary`: ricerca cross-media navigabile e coerente con
  le viste locali.
- Media detail: le entry point `Textbook`, `Glossary`, `Review`, `Progress` sono tutte operative.
- Root review `/review`: reindirizza direttamente alla review del media di focus.
- Textbook index: mostra tutte le lesson del bundle attivo con stato coerente.
- Textbook resume: la CTA `Continua il percorso` punta al primo step non
  completato del percorso, anche se esiste una lesson diversa gia `in_progress`.
- Reader lesson: il toggle furigana aggiorna davvero il rendering.
- Reader lesson desktop: clic su un termine apre tooltip con `Apri entry`.
- Reader lesson mobile: tap su un termine apre sheet; `Lezioni` apre la rail mobile.
- Glossary: ricerca per kanji, kana e romaji (`bochi`, `yamafuda`, `侵略`) restituisce risultati sensati.
- Glossary detail: lesson e card collegate sono navigabili.
- Review: il toggle `Furigana sul fronte` rispetta sia la modalita immediata sia quella solo dopo risposta.
- Review: `Mostra risposta` funziona; grading `Again/Hard/Good/Easy` avanza la sessione.
- Progress: mostra textbook, coverage, review e setting persistiti.
- Settings: salvare furigana reader, furigana review e ordine glossary aggiorna le viste collegate.
- Media secondario: aprendo `Mobile Suit Gundam Arsenal Base`, textbook, glossary e progress risultano navigabili senza errori o stati vuoti incoerenti.

## Stati e resilienza

- Loading states: glossary, review, progress, settings e textbook mostrano messaggi contestuali, non generici.
- Empty states: nessuna pagina primaria comunica schermate finte o deviazioni dal flusso reale.
- Content validate fallito: gli errori indicano file, categoria e messaggio leggibile.
- Content import su DB non migrato: il comando suggerisce esplicitamente `pnpm db:migrate`.

## Responsive e polish

- Desktop: reader con rail sticky e tooltip leggibile.
- Mobile: reader e glossary restano leggibili senza zoom orizzontale.
- Bottom navigation mobile non copre CTA o contenuto critico.
- I messaggi principali sono coerenti con il tono editoriale del prodotto.

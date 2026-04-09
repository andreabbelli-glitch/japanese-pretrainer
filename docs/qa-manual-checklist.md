# Checklist Manuale QA

## Setup locale

- Se la verifica parte da un worktree Codex locale in sandbox, eseguire prima
  `.codex/scripts/setup-worktree.sh`
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
- Root review `/review`: apre la queue globale reale su tutti i subject e, se
  non esistono ancora media o card disponibili, mostra un empty state dedicato
  al primo avvio.
- `Kanji Clash` `/kanji-clash`: apre un workspace separato dalla review, con
  modalita `FSRS` e `Drill`, e senza confondere la UI con la
  coda FSRS standard.
- `Kanji Clash`: con `media=<slug>` valido il workspace filtra il pool al media
  scelto; senza slug esplicito il runtime resta globale anche se il default in
  settings e` `media`.
- `Kanji Clash`: il drill manuale accetta solo size `10`, `20`, `40` e il
  fallback usa il default persistito in `Settings`.
- `Kanji Clash`: il drill manuale costruisce una frontiera deterministica
  legata alla size richiesta, preserva le coppie `due` gia tracciate e non
  promette una scansione esaustiva del corpus.
- `Kanji Clash`: il pool mostra solo pair di `term` gia consolidati nella
  review standard; non devono comparire `grammar`, card troppo nuove o
  superfici duplicate/quasi-clone.
- `Kanji Clash`: il pool scarta same-entry, same-group, same-surface ed
  editorial-clone prima di costruire una sessione.
- `Kanji Clash`: il pool scarta anche i `qualified-contained-clone`, cioe`
  pair in cui una surface corta e` gia il nucleo dell'altra e la parte extra,
  davanti o dietro, e` solo un qualificatore breve come `山札の`, `カード`,
  `タップ`, `無色`, `開始` o `受け取り`.
- `/media/[mediaSlug]/review`: resta il filtro verticale locale sul singolo
  media e non deve diventare un launcher verso un altro media.
- Textbook index: mostra tutte le lesson del bundle attivo con stato coerente.
- Textbook resume: la CTA `Continua il percorso` punta al primo step non
  completato del percorso, anche se esiste una lesson diversa gia `in_progress`.
- Reader lesson: il toggle furigana aggiorna davvero il rendering.
- Reader lesson desktop: clic su un termine apre tooltip con `Apri entry`.
- Reader lesson desktop: clic su un'immagine del textbook apre sempre il
  lightbox, anche se il contenuto legacy aveva `card_id`.
- Reader lesson mobile: tap su un termine apre sheet; `Lezioni` apre la rail mobile.
- Reader lesson mobile: tap su un'immagine del textbook apre il lightbox.
- Glossary: ricerca per kanji, kana e romaji (`bochi`, `yamafuda`, `侵略`) restituisce risultati sensati.
- Glossary detail: lesson e card collegate sono navigabili.
- Review: il toggle `Furigana sul fronte` rispetta sia la modalita immediata sia quella solo dopo risposta.
- Review: `Mostra risposta` funziona; grading `Again/Hard/Good/Easy` avanza la sessione subito, senza flash di pagina completa, e in caso di errore ripristina la card precedente con messaggio chiaro.
- Review: il daily limit dei nuovi è globale e la coda mostra contenuti fusi
  quando la stessa entry o pattern compare in più media.
- Kanji Clash: una risposta corretta auto-avanza rapidamente senza pannello
  feedback inline, senza timer artificiale e senza micro-scroll del viewport.
- Kanji Clash: una risposta errata mostra feedback esplicito, non avanza da
  sola e richiede il pulsante `Continua`.
- Kanji Clash: click/tap diretto sulle opzioni e tasti `ArrowLeft` /
  `ArrowRight` selezionano il lato corretto.
- Kanji Clash mobile: lo swipe a sinistra seleziona l'opzione sinistra e lo
  swipe a destra seleziona l'opzione destra.
- Kanji Clash: la stessa pair non ricompare nella stessa sessione ne nello
  stesso ordine ne invertita.
- Kanji Clash: le voci simili restano separate solo quando la differenza e`
  reale e documentata, non come quasi-cloni creati artificialmente.
- Kanji Clash: una sessione completata o parziale non deve alterare numeri,
  log o coda di `/review`; il workspace resta separato.
- Review: le card già introdotte restano contabilizzate anche dopo l'upgrade
  da DB esistenti; la migrazione non deve azzerare il conteggio giornaliero.
- Review import/sync: dopo `pnpm content:import` i subject necessari esistono
  gia in `review_subject_state` senza lanciare backfill separati; se serve un
  recovery manuale, `pnpm db:backfill-review-subject-state` non deve permettere
  a una sibling `suspended` o `known_manual` di mascherare una sibling attiva.
- Progress e media detail: i numeri marcati come review globale coincidono con
  `/review`; i numeri del media restano chiaramente etichettati come locali.
- Progress: mostra textbook, coverage, review e setting persistiti.
- Settings: salvare furigana reader, furigana review e ordine glossary aggiorna le viste collegate.
- Settings: la sezione `FSRS optimizer` mostra stato read-only coerente con i
  dati salvati in `user_setting`, senza esporre pulsanti manuali di retrain.
- Media secondario: aprendo `Mobile Suit Gundam Arsenal Base`, textbook, glossary e progress risultano navigabili senza errori o stati vuoti incoerenti.
- Media `Web giapponese`: detail, textbook, glossary e review aprono senza
  errori; il textbook espone le lesson reali generate dal workflow web.

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

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
- Se una automazione Codex in sandbox `workspace-write` non riesce a lanciare
  Chromium, usare come fallback `./scripts/with-node.sh pnpm test:e2e:webkit`
  e segnalarlo esplicitamente nel riepilogo finale come verifica alternativa,
  non come sostituzione del gate canonico

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
- `Kanji Clash`: il drill manuale parte dai preset `10`, `20`, `40`; a
  sessione finita puo` estendere la frontiera corrente di `+10` per volta e il
  fallback usa comunque il default persistito in `Settings` quando `size` non e`
  valido.
- `Kanji Clash`: il drill manuale costruisce una frontiera deterministica
  legata alla size richiesta, preserva le coppie `due` gia tracciate e non
  promette una scansione esaustiva del corpus.
- `Kanji Clash`: il pool mostra solo pair di `term` gia consolidati nella
  review standard; non devono comparire `grammar`, card troppo nuove o
  superfici duplicate/quasi-clone.
- `Kanji Clash`: il pool puo` includere sia pair con kanji condivisi sia pair
  con un solo swap di kanji simili; il workspace deve mostrare il motivo in
  modo compatto (`chip` kanji condivisi oppure `Kanji simili: A / B`).
- `Kanji Clash`: il pool non deve promuovere front non lessicali come
  katakana/hiragana puri, frammenti frasali con particelle o punteggiatura e
  compound con prefisso leggero in kana/katakana o coda katakana.
- `Kanji Clash`: il pool scarta same-entry, same-group, same-surface ed
  editorial-clone prima di costruire una sessione.
- `Kanji Clash`: il pool scarta anche i `qualified-contained-clone`, cioe`
  pair in cui una surface corta e` gia il nucleo dell'altra e la parte extra,
  davanti o dietro, e` solo un qualificatore breve come `山札の`, `カード`,
  `タップ`, `無色`, `開始` o `受け取り`.
- `Kanji Clash`: il pool scarta anche i `shared-lexical-core`, cioe` pair che
  riusano la stessa testa lessicale o la stessa derivazione mista kanji+kana
  con soli modificatori brevi, come `おすすめ編成` vs `パーティー編成`,
  `受け取る` vs `受け取り期限` o `未受け取り` vs `一括受け取り`.
- `Kanji Clash`: coppie contrastive reali che condividono solo una cornice
  iniziale, come `一番上` vs `一番下`, devono restare valide.
- `Kanji Clash`: il pool scarta anche i `shared-contextual-prefix`, cioe`
  superfici frasali che condividono lo stesso contesto iniziale ma divergono
  poi in due code sostanziali, come `山札の上から1枚目` vs `山札の一番下`.
- `Kanji Clash`: il pool scarta anche i `contextualized-head-family`, cioe`
  pair che confrontano una forma contestualizzata `XのY` con una forma piu`
  nuda della stessa famiglia come `山札の一番下` vs `一番上`.
- `Kanji Clash`: il pool scarta anche i `cross-edge-mixed-stem`, cioe` pair
  dove lo stesso stem misto kanji+kana cade all'inizio di una forma e alla
  fine dell'altra, come `受け取る` vs `一括受け取り` o `未受け取り` vs
  `受け取り期限`.
- `Kanji Clash`: il pool scarta anche i `same-kanji-core-reading`, cioe` pair
  che riusano lo stesso blocco kanji sullo stesso bordo con soli kana diversi
  intorno e senza cambiare la lettura del blocco, come `ランク戦` vs
  `ストラテジー戦` o `行く` vs `行こう`, ma mantiene casi come `行う` vs `行く`
  e `出す` vs `出る`.
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
- Kanji Clash: una pair che passa sia la route `shared-kanji` sia la route
  `similar-kanji` compare una sola volta nella sessione.
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

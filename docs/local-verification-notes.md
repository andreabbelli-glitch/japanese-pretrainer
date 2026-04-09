# Note Di Verifica Locale

Questo documento riassume i controlli locali e i limiti noti ancora utili come
promemoria operativo. Non rappresenta un sign-off di completezza del prodotto e
non sostituisce un audit completo e aggiornato del codice.

## Copertura Attuale Dei Controlli

- Suite E2E minima con Playwright su DB dedicato e import reale dell'intero workspace `content/`.
- Copertura dei flussi chiave: dashboard, media detail, textbook reader, tooltip, lightbox immagini, glossary, review, progress, settings.
- Copertura dedicata di `Kanji Clash` su `/kanji-clash` con filtro media,
  sessione manuale e interazioni click/tastiera/touch.
- Smoke parametrica sulle route chiave di ogni media attivo presente in `content/media`.
- Verifica mobile del reader con sheet touch per termini e rail lesson.
- Le immagini del textbook restano plain media: click/tap apre il lightbox
  anche in presenza di `card_id` legacy nei bundle storici.
- `/review` come workspace globale; `/media/[mediaSlug]/review` come filtro
  verticale sullo stesso sistema.
- Root `/review` deve avere uno stato vuoto dedicato per il primo avvio, non un
  redirect verso una review locale o un copy che parli di un singolo media.
- Loading state contestuali per glossary, textbook, lesson, review, progress e settings.
- `Kanji Clash` resta un workspace separato da `/review`, con pair state e log
  dedicati e senza mutazioni laterali sulla review standard.
- Messaggio di errore comprensibile in `content:import` quando il DB target non è migrato.

## Comportamenti Da Verificare

- La nav review globale e la CTA review della dashboard portano al workspace
  review globale, mentre dal media detail resta disponibile il filtro verticale.
- `Kanji Clash` apre da navbar e CTA dedicate, ma non rimpiazza la queue di
  `/review`; gli ingressi devono restare espliciti e distinti.
- `Kanji Clash` in scope media deve attivarsi solo con `media=<slug>` valido;
  se manca uno slug esplicito, il runtime deve restare su scope globale anche
  quando il default setting e` `media`.
- La sessione `Kanji Clash` non deve ripresentare la stessa pair key nella
  stessa run, anche con lati invertiti o target invertito.
- In caso di errore in `Kanji Clash`, la UI deve mostrare la soluzione corretta
  e fermarsi finche l'utente non conferma `Continua`.
- Il daily limit della review è globale e la coda mostra fusioni cross-media
  quando la stessa entry o pattern è condivisa tra più media.
- Su DB già esistenti, il comportamento della review deve restare compatibile
  con lo storico legacy: la migrazione deve preservare i soggetti già introdotti
  e non deve far ricomparire card già contate nel limite giornaliero.
- La migrazione SQL `0011_global_review_subjects.sql` non fa backfill da sola:
  il percorso normale e` `pnpm content:import`, che crea e riallinea
  `review_subject_state` durante il sync. `pnpm db:backfill-review-subject-state`
  resta solo una rete di sicurezza manuale per DB parzialmente migrati o
  subject-level state mancanti.
- Nel fallback legacy, una sibling `suspended` o `known_manual` non deve mai
  diventare representative subject se esiste una sibling attiva.
- Dashboard e CTA globali devono usare numeri globali reali; progress e media
  detail possono mostrare anche numeri locali, ma devono etichettarli come
  `Review del media` o equivalente, senza presentarli come globali.
- Le schermate di studio secondarie non ereditano più il loading generico “Caricamento media”, ma comunicano cosa si sta preparando.
- `content:import` non esplode più con stacktrace SQL opaco quando manca lo schema: ora indica di eseguire `db:migrate`.
- Settings mostra anche lo stato read-only dell'optimizer FSRS, inclusi ultimo
  training riuscito, review nuove accumulate e stato dei preset `recognition` /
  `concept`.
- Il media `web-giapponese` resta navigabile nelle route principali con lesson
  reali e senza contenuti bootstrap residui.

## Comando E2E

`./scripts/with-node.sh pnpm test:e2e`

Il comando costruisce l'app, prepara un DB E2E temporaneo, importa tutti i
bundle reali presenti in `content/` e avvia un server locale su porta `3100`
per la suite.

Quando il comando gira da un worktree Codex locale in sandbox, il setup del
worktree deve avere gia eseguito `.codex/scripts/setup-worktree.sh` e il profilo
di sandbox deve poter usare `nvm` e la cache browser Playwright fuori dal repo.

## Gate Canonico Di Verifica

Per eseguire il controllo locale piu completo:

`./scripts/with-node.sh pnpm release:check`

Il gate canonico copre nell'ordine:

- `pnpm check` per lint, typecheck e test unit/integration;
- `pnpm build`;
- `pnpm content:validate`;
- runner E2E Playwright sul setup locale dedicato.

## Limiti Residui

- La suite E2E è intenzionalmente piccola: copre i flussi ad alto valore, non ogni variante di filtro o ogni card.
- I flussi E2E restano concentrati sul media di focus per textbook; per review
  conviene coprire sia il workspace globale sia il filtro verticale sul media.
- `Kanji Clash` ha una suite E2E mirata, ma resta focalizzata sul round flow
  principale: filtro media, click, tastiera, swipe, errore con stop e dedupe.
- Il primo avvio di `/review` va controllato anche senza media importati, per
  verificare che l'empty state dedicato non sembri una review locale vuota.
- Le performance sono verificate solo a livello locale/percepito, non con budget automatizzati.
- Il prodotto resta single-user e locale-first; non include hardening per esposizione remota.
- Il training automatico FSRS dipende da una schedulazione esterna del comando
  `./scripts/with-node.sh pnpm fsrs:optimize:if-needed`; il repo non avvia job
  periodici in autonomia.

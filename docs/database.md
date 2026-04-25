# Persistence Layer

## Stack e percorso file

- ORM: `Drizzle ORM`
- Driver runtime: `@libsql/client`
- Database: `SQLite` locale-first
- Path di default: `./data/japanese-custom-study.db`
- Config Drizzle: `drizzle.config.ts`
- Migrazioni versionate: cartella `drizzle/`

Il path del DB arriva da `DATABASE_URL`. Se non e impostato, il progetto usa il
default locale sopra.

Se invece `DATABASE_URL` usa uno schema remoto `libsql://...`, il runtime usa
direttamente il client remoto standard. Il progetto non usa piu embedded
replica locali ne sync automatiche al bootstrap, per evitare consumi inattesi
della quota `Syncs` di Turso nei deploy serverless. Build, runtime e CLI
restano quindi allineati sullo stesso percorso di connessione remota.

## Comandi

Installa dipendenze:

```sh
./scripts/with-node.sh pnpm install
```

Genera una nuova migrazione a partire dallo schema Drizzle:

```sh
./scripts/with-node.sh pnpm db:generate
```

Applica le migrazioni al DB locale:

```sh
./scripts/with-node.sh pnpm db:migrate
```

Importa il contenuto reale disponibile in `./content`:

```sh
./scripts/with-node.sh pnpm db:seed
```

Se l'app gira dietro cache server-side su Vercel/Next, `pnpm content:import`
può invalidare automaticamente le cache dei tooltip/glossary/review dopo un
import riuscito chiamando un endpoint protetto del deploy. Configura le
variabili `CONTENT_CACHE_REVALIDATE_URL` e `CONTENT_CACHE_REVALIDATE_SECRET`
sia dove lanci il comando sia nel runtime dell'app deployata.

Se usi anche il workflow GitHub [`Sync Turso On Main`](../.github/workflows/sync-turso-on-main.yml),
esponi le stesse due variabili anche come GitHub Actions secrets, altrimenti
il DB remoto si aggiorna ma le cache server-side del deploy restano stale.

Setup completo del DB locale:

```sh
./scripts/with-node.sh pnpm db:setup
```

Apri Drizzle Studio:

```sh
./scripts/with-node.sh pnpm db:studio
```

## Struttura implementata

- `src/db/schema/*`: schema tipizzato per i domini content, glossary, review,
  Kanji Clash e progress
- `src/db/client.ts`: client Drizzle condiviso e factory per DB custom
- `src/db/migrate.ts`: wrapper applicativo per eseguire le migrazioni versionate
- `src/db/seed.ts`: fixture tecnica minima usata dai test unitari
- `src/db/queries/*`: helper tipizzati per media, lessons, glossary,
  cards/review e sessioni Kanji Clash
- `src/instrumentation.ts`: warm-up best-effort e non bloccante delle cache
  dati piu pesanti dopo l'avvio del runtime
- Per confrontare cold vs warm in pratica, avvia `pnpm start`, misura la
  prima navigazione dopo un riavvio e confrontala con la stessa rotta a cache
  calda; il warm-up in background non deve allungare il tempo di readiness del
  server.
- `scripts/db-migrate.ts`: entrypoint CLI per applicare le migrazioni
- `scripts/db-seed.ts`: entrypoint CLI per importare il contenuto reale nel DB locale

## Schema coperto in v1

Tabelle incluse nel perimetro del task:

- `media`
- `segment`
- `cross_media_group`
- `lesson`
- `lesson_content`
- `term`
- `term_alias`
- `grammar_pattern`
- `grammar_alias`
- `entry_link`
- `card`
- `card_entry_link`
- `entry_status`
- `review_subject_state`
- `review_subject_log`
- `kanji_clash_pair_state`
- `kanji_clash_pair_log`
- `kanji_clash_manual_contrast`
- `kanji_clash_manual_contrast_round_state`
- `kanji_clash_manual_contrast_round_log`
- `lesson_progress`
- `user_setting`
- `content_import`

## Decisioni implementative

- Gli ID sono stringhe stabili e non autoincrementali.
- `term` e `grammar_pattern` usano una PK tecnica persistente interna (`id`) e
  conservano l'ID editoriale importato dal Markdown in `source_id`.
- Per `term` e `grammar_pattern`, l'unicita editoriale e `(media_id, source_id)`
  e non piu `source_id` globale al workspace.
- `cross_media_group` e il layer esplicito di collegamento cross-media.
  L'authoring usa un campo opzionale `cross_media_group` nei blocchi `:::term`
  e `:::grammar`; il DB lo materializza nella tabella dedicata e nelle FK
  nullable `term.cross_media_group_id` / `grammar_pattern.cross_media_group_id`.
- `cross_media_group` non sostituisce le entry locali: serve solo a recuperare
  sibling secondarie in altri media, mantenendo `meaning_it` e `notes_it`
  locali come fonte primaria.
- `entry_status` e il modello review restano separati per tenere distinti
  override manuali di entita e stato SRS.
- I riferimenti polimorfici (`entry_type + entry_id`, `source_type + source_id`)
  non usano false foreign key; per `entry_id` il valore persistito e la chiave
  tecnica interna della entry, mentre il routing pubblico continua a usare
  l'ID editoriale locale al media.
- In fase 2, textbook popup resta locale; glossary detail e review detail
  possono mostrare sibling cross-media solo quando esiste un
  `cross_media_group` esplicito.
- Gli indici minimi richiesti da glossary, ordering e review queue sono gia
  inclusi nella migrazione iniziale.
- Le grammar persistono anche `search_romaji_norm`, cosi le query romaji del
  Glossary restano SQL-first senza fallback applicativo sul corpus completo.
- `review_subject_state` e lo stato canonico della review globale a livello
  subject. Tiene il memory state FSRS condiviso tra sibling cross-media, con
  `stability`, `difficulty`, `due_at`, `last_reviewed_at`,
  `last_interaction_at`, `lapses`, `reps`, `scheduled_days`,
  `learning_steps` e `scheduler_version`.
- L'identita del subject resta entry-level o cross-media solo per card il cui
  `front` coincide con la forma canonica della entry collegata. Se una card usa
  la stessa entry come ancora editoriale ma mostra un chunk piu lungo o
  operativo, viene trattata come subject card-level autonomo per non fondere
  review e scheduling con la recognition card base.
- `review_subject_log` e la cronologia canonica delle risposte a livello
  subject. Ogni voto salva stato precedente e successivo, `scheduled_due_at` e
  tempo di risposta quando disponibile.
- La migrazione SQL `drizzle/0011_global_review_subjects.sql` crea
  `review_subject_state` e `review_subject_log`; il contenuto sincronizzato via
  importer crea e riallinea direttamente `review_subject_state`, quindi
  `pnpm db:migrate` non esegue piu un backfill automatico dedicato. La cleanup migration
  `drizzle/0014_oval_expediter.sql` elimina poi le vecchie tabelle card-level
  `review_state` e `review_log`, ormai non piu usate dal runtime. Un recovery
  manuale resta disponibile con `pnpm db:backfill-review-subject-state`, ma non
  dovrebbe servire in condizioni normali.
- A livello UI e query: `/review` usa la queue globale reale sui subject, mentre
  `/media/[mediaSlug]/review` resta una vista filtrata locale. I numeri
  etichettati come globali devono arrivare dal modello subject-level globale;
  i numeri per-media restano locali e vanno etichettati come tali.
- Kanji Clash ha stato SRS separato dalla review standard. Le pair automatiche
  persistono in `kanji_clash_pair_state` e `kanji_clash_pair_log`; i contrasti
  forzati dalla Review o selezionati manualmente usano
  `kanji_clash_manual_contrast`, due round direzionali in
  `kanji_clash_manual_contrast_round_state` e log dedicati in
  `kanji_clash_manual_contrast_round_log`. L'archiviazione di un contrasto
  manuale agisce anche come kill-switch rispetto alla pair automatica
  equivalente.

## Seed locale

`pnpm db:seed` esegue un import completo del contenuto reale presente in
`./content`, dopo aver rimosso eventuali dati legacy rimasti da seed
precedenti.

La fixture tecnica in `src/db/seed.ts` resta disponibile solo per i test
unitari, dove serve un dataset minimo e controllato.

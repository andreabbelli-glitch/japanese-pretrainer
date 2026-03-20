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

Setup completo del DB locale:

```sh
./scripts/with-node.sh pnpm db:setup
```

Apri Drizzle Studio:

```sh
./scripts/with-node.sh pnpm db:studio
```

## Struttura implementata

- `src/db/schema/*`: schema tipizzato per i domini content, glossary, review e progress
- `src/db/client.ts`: client Drizzle condiviso e factory per DB custom
- `src/db/migrate.ts`: wrapper applicativo per eseguire le migrazioni versionate
- `src/db/seed.ts`: fixture tecnica minima usata dai test unitari
- `src/db/queries/*`: helper tipizzati per media, lessons, glossary e cards/review
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
- `review_state`
- `review_log`
- `review_subject_state`
- `review_subject_log`
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
- `review_state` e `review_log` restano tabelle card-level residuali per
  compatibilita, mirror e upgrade dei DB esistenti. Il runtime continua a
  leggerle quando manca il corrispondente state subject-level.
- La migrazione SQL `drizzle/0011_global_review_subjects.sql` crea
  `review_subject_state` e `review_subject_log`; il comando `pnpm db:migrate`
  esegue poi un backfill applicativo idempotente di `review_subject_state`
  sugli upgrade legacy. Gli entrypoint di import/seed eseguono lo stesso
  backfill dopo aver sincronizzato il contenuto, cosi il DB locale arriva alla
  review con la tabella canonica gia completa. Il fallback runtime resta come
  rete di sicurezza se manca ancora il corrispondente state subject-level o se
  il DB e stato migrato solo parzialmente. Lo stesso pass e rieseguibile
  manualmente con `pnpm db:backfill-review-subject-state`.
- A livello UI e query: `/review` usa la queue globale reale sui subject, mentre
  `/media/[mediaSlug]/review` resta una vista filtrata locale. I numeri
  etichettati come globali devono arrivare dal modello subject-level globale;
  i numeri per-media restano locali e vanno etichettati come tali.

## Seed locale

`pnpm db:seed` esegue un import completo del contenuto reale presente in
`./content`, dopo aver rimosso eventuali dati legacy rimasti da seed
precedenti.

La fixture tecnica in `src/db/seed.ts` resta disponibile solo per i test
unitari, dove serve un dataset minimo e controllato.

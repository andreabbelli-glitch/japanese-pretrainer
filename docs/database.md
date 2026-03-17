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
- `lesson_progress`
- `media_progress`
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
- `entry_status` e `review_state` restano separati per tenere distinti override
  manuali di entita e stato SRS delle card.
- I riferimenti polimorfici (`entry_type + entry_id`, `source_type + source_id`)
  non usano false foreign key; per `entry_id` il valore persistito e la chiave
  tecnica interna della entry, mentre il routing pubblico continua a usare
  l'ID editoriale locale al media.
- In fase 2, textbook popup resta locale; glossary detail e review detail
  possono mostrare sibling cross-media solo quando esiste un
  `cross_media_group` esplicito.
- Gli indici minimi richiesti da glossary, ordering e review queue sono gia
  inclusi nella migrazione iniziale.
- `review_state` materializza lo stato FSRS della card. Dopo la migrazione il
  layer review conserva il memory state con `stability`, `difficulty`,
  `due_at`, `last_reviewed_at`, `lapses`, `reps`, `scheduled_days`,
  `learning_steps` e un `scheduler_version` esplicito per distinguere i record
  legacy da quelli calcolati con FSRS.
- `review_log` continua a registrare ogni voto con lo stato precedente e
  successivo, il `scheduled_due_at` derivato dal motore, e il tempo di risposta
  quando disponibile, cosi la cronologia resta ricostruibile anche dopo
  l'adozione di FSRS.

## Seed locale

`pnpm db:seed` esegue un import completo del contenuto reale presente in
`./content`, dopo aver rimosso eventuali dati legacy rimasti da seed
precedenti.

La fixture tecnica in `src/db/seed.ts` resta disponibile solo per i test
unitari, dove serve un dataset minimo e controllato.

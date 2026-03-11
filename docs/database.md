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
- `entry_status` e `review_state` restano separati per tenere distinti override
  manuali di entita e stato SRS delle card.
- I riferimenti polimorfici (`entry_type + entry_id`, `source_type + source_id`)
  non usano false foreign key; la validazione resta demandata a importer e layer
  applicativo futuri.
- Gli indici minimi richiesti da glossary, ordering e review queue sono gia
  inclusi nella migrazione iniziale.

## Seed locale

`pnpm db:seed` esegue un import completo del contenuto reale presente in
`./content`, dopo aver rimosso eventuali dati legacy rimasti da seed
precedenti.

La fixture tecnica in `src/db/seed.ts` resta disponibile solo per i test
unitari, dove serve un dataset minimo e controllato.

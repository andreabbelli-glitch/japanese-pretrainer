# Japanese Custom Study

Webapp privata single-user per studiare giapponese a partire da media specifici
(anime, videogiochi, TCG, visual novel, siti web, ecc.) prima di consumarli davvero.

## Obiettivo

Per ogni media, l'app deve offrire:

- un textbook progressivo organizzato per difficolta e per segmenti del media;
- un glossary ricercabile per kanji, kana e romaji;
- un sistema di review FSRS-based con grading tipo Anki per vocaboli, frasi e pattern grammaticali;
- tracking dei progressi di studio e della review;
- supporto nativo a furigana e tooltip contestuali.

## Stato Del Repository

Il repository include attualmente:

- app `Next.js` con App Router e TypeScript;
- shell desktop/mobile coerente con la direzione UX/UI approvata;
- dashboard `/`, media library `/media` e media detail `/media/[mediaSlug]`;
- entry point dedicati per `/textbook`, `/glossary`, `/review` e `/progress`,
  con `/review` come workspace globale reale, `/media/[mediaSlug]/review` come
  filtro verticale locale e un empty state dedicato al primo avvio quando non
  ci sono ancora media o card da ripassare;
- limite dei nuovi globale sulla review, non per media;
- font self-hosted, cosi `build` non dipende da fetch esterni;
- tooling locale per lint, format, typecheck, test unit/integration ed E2E;
- struttura cartelle coerente con importer, persistence e UI gia in uso.

## Semantica Del Resume Textbook

Le CTA come `Continua il percorso` nel Textbook e nei punti di ingresso del
media seguono intenzionalmente il primo step non ancora completato del percorso.
Non puntano automaticamente all'ultima lesson `in_progress` aperta di recente:
la scelta privilegia l'avanzamento lineare del curriculum rispetto al semplice
"ultimo punto visitato".

## Modello Review Globale

La review usa un modello canonico a livello subject:

- `review_subject_state` contiene lo stato FSRS globale del subject condiviso;
- `review_subject_log` registra la cronologia delle risposte a livello subject.

La migrazione SQL [`drizzle/0011_global_review_subjects.sql`](./drizzle/0011_global_review_subjects.sql)
crea le tabelle subject-level. Il flusso normale materializza e riallinea
`review_subject_state` direttamente durante `pnpm content:import` e
`pnpm db:seed`, senza un backfill automatico separato dopo migrate/startup. La
cleanup migration
[`drizzle/0014_oval_expediter.sql`](./drizzle/0014_oval_expediter.sql) rimuove
poi le vecchie tabelle card-level `review_state` e `review_log`, ormai non piu
usate dal runtime. Per rieseguire il pass manualmente esiste anche
`pnpm db:backfill-review-subject-state`, da usare solo per recovery di DB
inconsistenti o upgrade legacy parziali.

A livello di prodotto:

- `/review` e la review globale reale, con dedup cross-media e daily limit globale;
- `/media/[mediaSlug]/review` resta una vista filtrata locale sul singolo media;
- dashboard e CTA globali devono mostrare numeri globali reali, mentre le
  superfici del media devono etichettare chiaramente i numeri locali del media.

Nel flusso sessione, la UI prova a mantenere il grading percepito come
istantaneo: il client prefetcha la card successiva quando possibile e, al click
su `Again/Hard/Good/Easy`, avanza in modo ottimistico mentre il server conferma
la mutazione in background. Se il submit fallisce, il client ripristina la card
precedente e mostra l'errore senza perdere il contesto della sessione.

Lo scheduler FSRS supporta anche parametri ottimizzati sui log reali. Il
training e volutamente esterno al runtime Next.js: il comando canonico e
`pnpm fsrs:optimize:if-needed`, pensato per essere eseguito da `cron`,
`launchd`, `systemd` o da un'automazione Codex. Il gate interno allena al
massimo una volta ogni `30` giorni e solo dopo almeno `500` review eleggibili
nuove, segmentando i parametri in due preset per `cardType`:
`recognition` e `concept`. La pagina `/settings` mostra in sola lettura lo
stato corrente dell'optimizer e dei preset salvati in `user_setting`.

## Bootstrap locale

Runtime previsto:

- Node `22.22.1`
- pnpm `10.30.3`

Verifica rapida toolchain:

```sh
./scripts/tooling-doctor.sh
```

Installazione dipendenze:

```sh
./scripts/with-node.sh pnpm install
```

Avvio sviluppo:

```sh
./scripts/with-node.sh pnpm dev
```

Se preferisci usare `pnpm` direttamente, prima carica la versione Node del
repository con `nvm use`.

Lo script `./scripts/with-node.sh` prova a usare `nvm` da `$NVM_DIR`,
`/opt/homebrew/opt/nvm/nvm.sh` o `/usr/local/opt/nvm/nvm.sh`. Se la versione
corretta di Node e gia attiva, esegue direttamente il comando senza dipendere
da `nvm`.

## Gate Di Verifica Locale

Per verificare il repository in modo completo, esegui il gate canonico:

```sh
./scripts/with-node.sh pnpm release:check
```

Il comando `release:check` copre l'intero set di controlli locali:

- lint
- typecheck
- test unit/integration
- build di produzione
- validazione contenuti su tutti i bundle reali presenti in `content/media`
- E2E

## Script disponibili

```sh
pnpm dev
pnpm build
pnpm perf:benchmark
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm check
pnpm content:validate
pnpm release:check
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm content:import
pnpm db:setup
pnpm db:studio
pnpm auth:hash-password
pnpm fsrs:optimize
pnpm fsrs:optimize:if-needed
```

## Database locale

Il layer persistence iniziale usa `Drizzle ORM` su `SQLite` locale-first.

Comandi principali:

```sh
./scripts/with-node.sh pnpm db:generate
./scripts/with-node.sh pnpm db:migrate
./scripts/with-node.sh pnpm db:seed
./scripts/with-node.sh pnpm content:import
./scripts/with-node.sh pnpm db:setup
```

Di default il DB viene creato in `./data/japanese-custom-study.db`, ma puoi
sovrascrivere il path con `DATABASE_URL`.

Se `DATABASE_URL` punta a un database remoto `libsql://...`, il runtime usa il
client remoto standard direttamente. Non usiamo piu embedded replica locali ne
sync automatiche al bootstrap, cosi il comportamento resta coerente tra locale,
CLI e deploy serverless e non consuma quota `Syncs` extra su Turso.

`pnpm db:seed` importa il contenuto reale presente in `./content`, riallinea il
DB ai media correnti e rimuove eventuali residui legacy non piu presenti nel
workspace. L'importer esegue parser + validazione prima di sincronizzare il DB;
puoi passare una content root diversa con
`pnpm content:import -- --content-root /percorso/content`.

Dettagli operativi e schema: [Persistence layer](./docs/database.md)

## Variabili Ambiente

Il setup locale non richiede variabili obbligatorie a runtime, ma
[.env.example](./.env.example) documenta i path locali supportati dal setup.

Per un deploy pubblico conviene invece impostare almeno:

- `DATABASE_URL` verso un database `libsql://...` remoto oppure un path locale
  solo se l'hosting garantisce persistenza del filesystem;
- `DATABASE_AUTH_TOKEN` oppure `LIBSQL_AUTH_TOKEN` se il provider `libsql`
  richiede un token;
- `AUTH_USERNAME`, `AUTH_SESSION_SECRET` e una tra `AUTH_PASSWORD_HASH` o
  `AUTH_PASSWORD` per attivare il login minimale dell'app.

Se nessuna variabile `AUTH_*` e configurata, l'app resta aperta. Se ne imposti
solo una parte, l'avvio fallisce apposta per evitare deploy pubblici esposti per
errore.

Per generare un hash password PBKDF2 senza dipendenze extra:

```sh
./scripts/with-node.sh pnpm auth:hash-password -- "scegli-una-password"
```

Poi usa l'output come valore di `AUTH_PASSWORD_HASH`.
Se lo incolli dentro un file `.env*`, ricordati di fare escape dei simboli
`$` come `\$`, altrimenti Next prova a espanderli e l'hash risulta troncato.

## Deploy Free Consigliato

Stack minimo consigliato per esporla su internet spendendo zero:

- hosting `Vercel Hobby` per la webapp `Next.js`;
- database remoto `Turso` sul free tier `libsql`;
- auth nativa di questa app tramite le variabili `AUTH_*`.

Questo evita di affidarsi a filesystem effimeri del provider e tiene il setup
coerente con `@libsql/client` gia presente nel repo.

Con questo setup, il bootstrap del server usa direttamente Turso come database
remoto e prova solo a scaldare le cache dati di dashboard e media library per
ridurre la latenza del primo caricamento, senza introdurre repliche locali o
sync extra.

## Backup schedulato del database

Il repository include anche un backup automatico del database remoto Turso via
GitHub Actions: [`.github/workflows/backup-turso-daily.yml`](./.github/workflows/backup-turso-daily.yml).

Comportamento attuale:

- backup giornaliero alle `02:15 UTC`;
- avvio manuale possibile da `Actions > Backup Turso Database > Run workflow`;
- export del DB remoto, conversione in un file SQLite compatto
  `japanese-custom-study.backup.db`;
- verifica con `PRAGMA integrity_check`;
- upload come artifact GitHub con retention di `90` giorni.

Ogni artifact contiene:

- `japanese-custom-study.backup.db`
- `metadata.json`
- `integrity-check.txt`
- `SHA256SUMS`
- `restore.txt`

Per ripristinare un backup su un nuovo database Turso:

```sh
turso db create <new-database-name> --from-file ./japanese-custom-study.backup.db -w
```

Per consultarlo localmente:

```sh
sqlite3 ./japanese-custom-study.backup.db 'select count(*) from media;'
```

Il workflow usa il secret GitHub `TURSO_PLATFORM_API_TOKEN` per autenticare la
CLI Turso in modo non interattivo. I secret usati dal runtime applicativo
restano separati.

## Struttura repo

```text
src/
  app/
  components/
    dashboard/
    layout/
    media/
    ui/
  db/
  lib/
  styles/
content/
  media/
    <media-slug>/
      assets/
tests/
scripts/
docs/
```

## Documenti

Per workflow con LLM esterni, il punto di partenza operativo e
[`docs/llm-kit/README.md`](./docs/llm-kit/README.md). I file in
[`docs/legacy/`](./docs/legacy/README.md) sono solo archivio storico e non
vanno usati per istruzioni operative correnti.

- [Blueprint operativo](./docs/blueprint-operativo.md)
- [Persistence layer](./docs/database.md)
- [Schema dati iniziale](./docs/schema-dati-iniziale.md)
- [Specifica contenuti Markdown](./docs/content-format.md)
- [Content parser e validator](./docs/content-parser.md)
- [Importer sync strategy](./docs/importer-sync-strategy.md)
- [Checklist QA manuale](./docs/qa-manual-checklist.md)
- [Note di verifica locale](./docs/local-verification-notes.md)
- [Performance baseline](./docs/performance-baseline.md)
- [Kit operativo LLM esterni (source of truth)](./docs/llm-kit/README.md)
- [Archivio legacy LLM (non operativo)](./docs/legacy/README.md)
- [Tooling locale](./docs/dev-tooling.md)
- [Direzione UX/UI](./docs/design/ux-ui-direction.md)
- [Design tokens](./docs/design/design-tokens.css)
- [Wireframes](./docs/design/wireframes.md)
- [Task index per agenti implementatori](./docs/tasks/README.md)

## Convenzioni UI

- Lo shell usa top bar editoriale su desktop e bottom navigation su mobile.
- I pattern base riusabili vivono in `src/components/ui` e `src/components/layout`.
- Dashboard, library e media detail leggono il DB tramite helper server-side in
  `src/lib/app-shell.ts`, evitando dati fake quando i record reali sono gia
  disponibili.

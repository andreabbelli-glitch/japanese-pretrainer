# Japanese Custom Study

Webapp privata single-user per studiare giapponese a partire da media specifici
(anime, videogiochi, TCG, visual novel, ecc.) prima di consumarli davvero.

## Obiettivo

Per ogni media, l'app deve offrire:

- un textbook progressivo organizzato per difficolta e per segmenti del media;
- un glossary ricercabile per kanji, kana e romaji;
- un sistema di review Anki-like per vocaboli, frasi e pattern grammaticali;
- tracking dei progressi di studio e della review;
- supporto nativo a furigana e tooltip contestuali.

## Stato

Il repository include ora la foundation applicativa e una prima shell reale:

- app `Next.js` con App Router e TypeScript;
- shell desktop/mobile coerente con la direzione UX/UI approvata;
- dashboard `/`, media library `/media` e media detail `/media/[mediaSlug]`;
- entry point dedicati per `/textbook`, `/glossary`, `/review` e `/progress`
  sotto ogni media, senza anticipare i task completi successivi;
- font self-hosted, cosi `build` non dipende da fetch esterni;
- tooling base per lint, format, typecheck e test unitari;
- struttura cartelle pronta per persistence, importer e UI task successivi.

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

## Script disponibili

```sh
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm check
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm content:import
pnpm db:setup
pnpm db:studio
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

L'importer esegue parser + validazione prima di sincronizzare il DB. Di default
legge `./content`; puoi passare una content root diversa con
`-- --content-root /percorso/content`.

Dettagli operativi e schema: [Persistence layer](./docs/database.md)

## Variabili ambiente

La foundation non richiede ancora variabili obbligatorie a runtime, ma
[.env.example](./.env.example) documenta i path locali previsti per i task
successivi.

## Struttura iniziale

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
tests/
scripts/
docs/
```

## Documenti

- [Blueprint operativo](./docs/blueprint-operativo.md)
- [Persistence layer](./docs/database.md)
- [Schema dati iniziale](./docs/schema-dati-iniziale.md)
- [Specifica contenuti Markdown](./docs/content-format.md)
- [Content parser e validator](./docs/content-parser.md)
- [Importer sync strategy](./docs/importer-sync-strategy.md)
- [Handoff per LLM esterno](./docs/llm-content-handoff.md)
- [Tooling locale](./docs/dev-tooling.md)
- [Direzione UX/UI](./docs/design/ux-ui-direction.md)
- [Design tokens](./docs/design/design-tokens.css)
- [Wireframes](./docs/design/wireframes.md)
- [Task index per agenti implementatori](./docs/tasks/README.md)

## Convenzioni UI introdotte

- Lo shell usa top bar editoriale su desktop e bottom navigation su mobile.
- I pattern base riusabili vivono in `src/components/ui` e `src/components/layout`.
- Dashboard, library e media detail leggono il DB tramite helper server-side in
  `src/lib/app-shell.ts`, evitando dati fake quando i record reali sono gia
  disponibili.

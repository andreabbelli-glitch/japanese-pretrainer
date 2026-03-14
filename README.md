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

Il repository e allineato a una v1 locale operativa:

- app `Next.js` con App Router e TypeScript;
- shell desktop/mobile coerente con la direzione UX/UI approvata;
- dashboard `/`, media library `/media` e media detail `/media/[mediaSlug]`;
- entry point dedicati per `/textbook`, `/glossary`, `/review` e `/progress`
  sotto ogni media, coerenti con i flussi reali di studio;
- font self-hosted, cosi `build` non dipende da fetch esterni;
- tooling locale per lint, format, typecheck, test unit/integration ed E2E;
- struttura cartelle coerente con importer, persistence e UI gia in uso.

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

## Gate pre-release v1 locale

Prima di considerare la v1 locale "verde", esegui il gate canonico:

```sh
./scripts/with-node.sh pnpm release:check
```

Il comando `release:check` copre l'intero set richiesto per la v1 locale:

- lint
- typecheck
- test unit/integration
- build di produzione
- validazione contenuti sul bundle reale `duel-masters-dm25`
- E2E

## Script disponibili

```sh
pnpm dev
pnpm build
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

`pnpm db:seed` importa il contenuto reale presente in `./content` riallineando
eventuali dati seed precedenti. L'importer esegue parser + validazione prima di
sincronizzare il DB; puoi passare una content root diversa con
`pnpm content:import -- --content-root /percorso/content`.

Dettagli operativi e schema: [Persistence layer](./docs/database.md)

## Variabili ambiente

La v1 locale non richiede variabili obbligatorie a runtime, ma
[.env.example](./.env.example) documenta i path locali supportati dal setup.

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

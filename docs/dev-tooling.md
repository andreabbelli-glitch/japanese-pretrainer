# Tooling Locale

## Runtime di riferimento

- Node: `22.22.1`
- pnpm: `10.30.3`
- SQLite CLI: `3.43.2`
- Python: `3.9+`

## Stato macchina verificato

Gia presenti:

- `git`
- `rg`
- `sqlite3`
- `python3`
- `uv`
- `nvm`
- `pnpm`

## Regola operativa per gli agenti

Prima di lavorare nel repository, usare una shell che abbia caricato `nvm` e il
runtime definito in `.nvmrc`.

Comando sicuro:

```sh
source ~/.zshrc && nvm use
```

Oppure, in modo piu robusto e ripetibile per gli agenti:

```sh
./scripts/with-node.sh <comando>
```

Questo e il percorso canonico anche quando `pnpm` sembra funzionare con una
versione Node diversa: il repo supporta ufficialmente `Node 22.x`, mentre la
compatibilita con release successive come `Node 25` resta solo best effort per
gli script CLI TypeScript.

Verifica minima:

```sh
node --version
pnpm --version
sqlite3 --version
```

Verifica completa del setup:

```sh
./scripts/tooling-doctor.sh
```

La suite Vitest e volutamente limitata a pochi worker in `vitest.config.ts`.
Molti test creano database SQLite temporanei, eseguono migrazioni e importano
bundle reali; su macchine locali saturare tutti i core rende i test piu lenti e
fragili invece che piu rapidi.

## Codex locale in sandbox

Per worktree e automazioni Codex locali, il repo include una configurazione
condivisa in `.codex/`.

Bootstrap consigliato per ogni nuovo worktree:

```sh
.codex/scripts/setup-worktree.sh
```

Il setup installa le dipendenze del worktree, verifica `Node`, `pnpm`,
`sqlite3`, `python3`, `git`, `rg` e controlla che la cache locale dei browser
Playwright sia disponibile. Se mancano i browser, esegue in automatico:

```sh
./scripts/with-node.sh pnpm exec playwright install chromium firefox webkit
```

Il file `.codex/config.toml` imposta il default di progetto su sandbox
`workspace-write` con rete attiva e aggiunge come writable roots extra-repo:

- `~/.nvm`
- `/opt/homebrew/opt/nvm`
- `~/Library/Caches/ms-playwright`

Questi path servono per due motivi pratici:

- `./scripts/with-node.sh` risolve Node `22.x` via `nvm`;
- i test E2E Playwright usano i browser installati nella cache utente macOS.

Action repo-shared consigliate nell'app Codex:

```sh
.codex/scripts/dev.sh
.codex/scripts/check.sh
.codex/scripts/release-check.sh
.codex/scripts/test-e2e.sh
.codex/scripts/db-setup.sh
.codex/scripts/content-import.sh
```

Workflow immagini:

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25
```

`image:apply` aggiorna i markdown, ma il reader usa il contenuto importato nel
DB locale. Dopo un apply reale serve quindi un nuovo `content:import`.

Workflow pronunce:

```sh
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/duel-masters-dm25/textbook/tcg-core-overview
./scripts/with-node.sh pnpm pronunciations:forvo -- --manual --media duel-masters-dm25 --entry term-cost
```

`pronunciations:resolve` e il percorso operativo standard: seleziona i target
da review, prossima lesson o pagina textbook, filtra le entry gia coperte,
prova il riuso cross-media, esegue il fetch offline e manda a Forvo manuale
solo il residuo. Aggiorna anche lo storico
`data/forvo-requested-word-add.json`, marcando come `resolved` le entry per cui
e' stato trovato un audio. `pronunciations:forvo` resta il comando low-level
per batch mirati o debug del solo fallback manuale.

Workflow optimizer FSRS:

```sh
./scripts/with-node.sh pnpm fsrs:optimize
./scripts/with-node.sh pnpm fsrs:optimize:if-needed
```

Gli script CLI TypeScript non richiedono piu
`--experimental-default-type=module`, cosi un avvio accidentale sotto `Node 25`
non fallisce per quel flag obsoleto. Questo non estende la matrice supportata:
per check, release gate e automazioni repo-shared resta obbligatorio `Node 22.x`
via `./scripts/with-node.sh`.

`fsrs:optimize` forza un training immediato dei preset `recognition` e
`concept` usando i log di `review_subject_log`, poi salva config, stato e pesi
ottimizzati in `user_setting`. Il run forzato ignora il flag `enabled`: quel
flag blocca solo il job automatico schedulato.

`FSRS_OPTIMIZER_TRAINING_TIMEOUT_MS` puo ridurre o estendere il timeout di ogni
training preset; se non e impostato resta il default runtime di `5000ms`.

`fsrs:optimize:if-needed` e il comando da schedulare esternamente una volta al
giorno. Il comando fa no-op finche non sono passati almeno `30` giorni
dall'ultimo training riuscito oppure non ci sono almeno `500` review nuove
eleggibili. La schedulazione vera resta fuori dal repo: usare `cron`,
`launchd`, `systemd` o automazioni Codex.

Workflow dataset `Kanji Clash` per kanji simili:

```sh
./scripts/with-node.sh pnpm kanji-clash:generate-similar-kanji
```

Il comando rigenera il dataset versionato degli swap `A <-> B` combinando
White Rabbit, `strokeEditDistance >= 0.75`, `yehAndLiRadical >= 0.75` e gli
override manuali in `src/features/kanji-clash/tooling/similar-kanji-overrides.ts`.

## Gate per skill content-only

Le skill repo-scoped sotto `.agents/skills/` che modificano solo contenuti,
asset, pronunce o sidecar workflow devono indicare nella propria sezione
`Verification` il gate minimo necessario per il media o sottosistema toccato.
Non devono imporre `pnpm check` o `pnpm release:check` per default.

Per un normale aggiornamento editoriale il gate tipico è:

```sh
./scripts/with-node.sh pnpm content:validate -- --media-slug <media-slug>
./scripts/with-node.sh pnpm content:import -- --media-slug <media-slug>
```

Se la skill crea o modifica card, pronunce o accenti, aggiunge i workflow
specifici del media, per esempio `pronunciations:pending` e
`pitch-accents:fetch`. Per nuove flashcard locali, il fetch accenti deve essere
mirato alle entry appena create o riviste, usando `--entry <id>` come default e
`--word` / `--words-file` solo quando la lista ID non e disponibile. Se invece
cambia codice di parser, importer, routing, DB, auth, cache o UI, torna ai gate
canonici del repo e ai test mirati indicati dalla skill.

## Kanji Clash

Kanji Clash non richiede comandi dedicati oltre ai gate canonici del repo, ma
tocca un flusso sensibile a regressioni di input, sessione e conferma errore.

Per debug rapido puoi rilanciare solo `pnpm test:e2e:runner` o un file
Playwright specifico, ma ora `start:e2e` verifica anche che la build production
sia fresca. Se `.next/BUILD_ID` e piu vecchio di `src/`, `package.json`,
`next.config.ts` o `tsconfig.json`, il bootstrap termina con un errore
esplicito invece di servire una UI stale.

Se lo stesso debug gira dentro il sandbox Codex su macOS e il browser non parte,
tratta gli E2E browser come non eseguibili in quell'ambiente e riportalo
esplicitamente nel riepilogo finale. Non introdurre fallback browser-specifici
nel repo come sostituzione del gate canonico.

Quando modifichi route, query, queue builder, pairing, round controller o
server action di Kanji Clash:

- esegui almeno `./scripts/with-node.sh pnpm check`;
- esegui anche `./scripts/with-node.sh pnpm release:check` se il cambiamento e
  user-facing oppure tocca routing, sessione o logica di queue.

## Katakana Speed

Katakana Speed usa un catalogo statico in
`src/features/katakana-speed/model/catalog.ts` e persiste solo stato runtime
nelle tabelle `katakana_*`. Non richiede workflow contenuto, import dei media,
pronunce o asset audio.

Il registry operativo non-audio vive in
`src/features/katakana-speed/model/exercise-catalog.ts` e alimenta word bank,
trap moraiche, variant pair, chunk spotting, ladder verticali e opzioni raw
senza creare una tabella catalogo. I nuovi mode operativi usano le tabelle
session/trial/block/result esistenti e salvano metadata in JSON snapshot.

Per modifiche mirate al modello puro puoi lanciare i test Katakana Speed:

```sh
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-catalog-tokenizer.test.ts tests/katakana-speed-options-errors.test.ts tests/katakana-speed-scheduler-session.test.ts
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-operational-catalog.test.ts tests/katakana-speed-operational-planner.test.ts tests/katakana-speed-raw-answer.test.ts
```

Per modifiche a scheduler espanso, Server Actions o controller sessione usa
anche i test di persistenza/UI della feature:

```sh
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-persistence-expansion.test.ts tests/katakana-speed-expansion-actions.test.ts tests/katakana-speed-interactions.test.ts
```

Per modifiche a persistenza, Server Actions, route o UI della sessione, usa i
gate canonici:

```sh
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

Quando aggiungi o cambi tabelle `katakana_*`, genera sempre la migrazione con:

```sh
./scripts/with-node.sh pnpm db:generate
```

## Tool da avere pronti

- browser Playwright per test E2E;
- dipendenze progetto installate localmente dopo l'inizializzazione app.
- writable roots sandbox per `nvm` e cache Playwright quando il lavoro gira in
  un worktree Codex locale.

## Nota

Le dipendenze applicative come Next.js, Drizzle, Vitest e Playwright package non
vanno installate globalmente. Devono vivere nel progetto.

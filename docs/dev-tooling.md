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

`fsrs:optimize:if-needed` e il comando da schedulare esternamente una volta al
giorno. Il comando fa no-op finche non sono passati almeno `30` giorni
dall'ultimo training riuscito oppure non ci sono almeno `500` review nuove
eleggibili. La schedulazione vera resta fuori dal repo: usare `cron`,
`launchd`, `systemd` o automazioni Codex.

## Kanji Clash

Kanji Clash non richiede comandi dedicati oltre ai gate canonici del repo, ma
tocca un flusso sensibile a regressioni di input, sessione e conferma errore.

Quando modifichi route, query, queue builder, pairing, round controller o
server action di Kanji Clash:

- esegui almeno `./scripts/with-node.sh pnpm check`;
- esegui anche `./scripts/with-node.sh pnpm release:check` se il cambiamento e
  user-facing oppure tocca routing, sessione o logica di queue.

## Tool da avere pronti

- browser Playwright per test E2E;
- dipendenze progetto installate localmente dopo l'inizializzazione app.
- writable roots sandbox per `nvm` e cache Playwright quando il lavoro gira in
  un worktree Codex locale.

## Nota

Le dipendenze applicative come Next.js, Drizzle, Vitest e Playwright package non
vanno installate globalmente. Devono vivere nel progetto.

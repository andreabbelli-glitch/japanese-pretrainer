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

Workflow immagini:

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25
```

`image:apply` aggiorna i markdown, ma il reader usa il contenuto importato nel
DB locale. Dopo un apply reale serve quindi un nuovo `content:import`.

## Tool da avere pronti

- browser Playwright per test E2E;
- dipendenze progetto installate localmente dopo l'inizializzazione app.

## Nota

Le dipendenze applicative come Next.js, Drizzle, Vitest e Playwright package non
vanno installate globalmente. Devono vivere nel progetto.

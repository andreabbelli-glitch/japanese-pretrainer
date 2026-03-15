# Performance Baseline

Benchmark leggero e ripetibile per misurare le route piu importanti in
production con `next build` + `next start`.

Lo script:

- usa un DB locale dedicato in `.tmp/perf/` se `DATABASE_URL` non e impostato;
- puo puntare a un DB SQLite locale esplicito oppure a Turso/libsql via env;
- esegue warmup e piu run per ogni route;
- misura `TTFB`, `load` e `total`;
- salva sia un report JSON sia un report Markdown;
- effettua login solo se l'app ha `AUTH_*` attive.

## Route misurate

- `/`
- `/media`
- `/review`
- `/glossary`
- `/media/duel-masters-dm25`
- `/media/duel-masters-dm25/textbook/tcg-core-overview`

## Comando base

```sh
./scripts/with-node.sh pnpm perf:benchmark
```

Artifact di default:

- JSON: `.tmp/perf/latest.json`
- Markdown: `.tmp/perf/latest.md`

Opzioni utili:

```sh
./scripts/with-node.sh pnpm perf:benchmark -- --runs 7 --warmup 2
./scripts/with-node.sh pnpm perf:benchmark -- --port 3311
./scripts/with-node.sh pnpm perf:benchmark -- --output-json .tmp/perf/run-a.json --output-md .tmp/perf/run-a.md
./scripts/with-node.sh pnpm perf:benchmark -- --skip-db-prepare
```

## Database locale

Senza `DATABASE_URL`, lo script usa un database benchmark dedicato:

```sh
./scripts/with-node.sh pnpm perf:benchmark
```

Se vuoi un path SQLite esplicito:

```sh
DATABASE_URL=./data/japanese-custom-study.perf.sqlite \
./scripts/with-node.sh pnpm perf:benchmark
```

Per default il benchmark prepara il DB target con:

1. migrazioni
2. import del contenuto reale in `content/`
3. purge dei media archiviati

Quando usa il DB locale di default in `.tmp/perf/`, il file viene ricreato a
ogni run per tenere il benchmark piu ripetibile e non toccare il DB normale.

## Turso / libsql remoto

Supporto esplicito via env gia usate dall'app:

```sh
DATABASE_URL=libsql://your-db.turso.io \
DATABASE_AUTH_TOKEN=your-token \
./scripts/with-node.sh pnpm perf:benchmark
```

Questo prepara anche il DB remoto, quindi conviene usare un database dedicato al
benchmark.

Se il DB remoto e gia migrato e popolato e vuoi solo misurare:

```sh
DATABASE_URL=libsql://your-db.turso.io \
DATABASE_AUTH_TOKEN=your-token \
./scripts/with-node.sh pnpm perf:benchmark -- --skip-db-prepare
```

`LIBSQL_AUTH_TOKEN` resta supportata come fallback.

## Auth opzionale

Se l'app gira senza `AUTH_*`, il benchmark entra direttamente sulle route.

Se l'auth e attiva:

- il benchmark legge `AUTH_USERNAME`;
- usa `AUTH_PASSWORD` se disponibile;
- se l'app usa solo `AUTH_PASSWORD_HASH`, devi passare `BENCH_AUTH_PASSWORD`.

Esempio:

```sh
AUTH_USERNAME=owner \
AUTH_PASSWORD_HASH='pbkdf2_sha256$...' \
AUTH_SESSION_SECRET='super-secret-session-key' \
BENCH_AUTH_PASSWORD='study-hard' \
./scripts/with-node.sh pnpm perf:benchmark
```

Puoi anche forzare uno username diverso con `BENCH_AUTH_USERNAME`.

## Metriche

- `TTFB`: `performance.navigation.responseStart`
- `load`: `performance.navigation.loadEventEnd`
- `total`: tempo wall-clock attorno a `page.goto(..., { waitUntil: "load" })`

Il benchmark usa Chromium headless con cache disabilitata a livello browser per
tenere i run piu confrontabili.

Se Chromium non e ancora installato per Playwright:

```sh
./scripts/with-node.sh pnpm exec playwright install chromium
```

# Performance Baseline

Benchmark leggero e ripetibile per misurare le route piu importanti in
production con `next build` + `next start`.

Lo script:

- carica `.env`, `.env.production`, `.env.local` e `.env.production.local`
  con priorita compatibile col run production del benchmark per auth e runtime;
- non eredita `DATABASE_URL` dai file env: il target DB cambia solo se lo passi
  esplicitamente nel comando o nella shell;
- usa un DB locale dedicato in `.tmp/perf/` se `DATABASE_URL` non e impostato;
- puo puntare a un DB SQLite locale esplicito oppure a Turso/libsql via env;
- esegue warmup e piu run per ogni route;
- misura `TTFB`, `load` e `total`;
- salva sia un report JSON sia un report Markdown;
- include anche lo status HTTP finale per intercettare route rotte o redirect non attesi;
- fallisce se una route benchmarkata atterra su un path diverso da quello
  richiesto, cosi non misura per errore login o redirect intermedi;
- crea una sessione autenticata solo se l'app ha `AUTH_*` attive.

## Route misurate

- `/`
  guardrail shell/dashboard globale
- `/media`
  guardrail media library
- `/review`
  route P0 review globale
- `/glossary`
  route P0 glossary globale
- `/media/duel-masters-dm25`
  media detail stabile del dataset reale
- `/media/duel-masters-dm25/review`
  route P0 review per-media stabile del dataset reale

Il benchmark usa volutamente slug reali gia presenti in `content/` per evitare
fixture artificiali e mantenere confrontabile il before/after dei refactor P0.

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

## Protocollo before/after per il rollout P0

Per confronti credibili usa sempre:

- stessa macchina
- stesso dataset `content/`
- stesso numero di run/warmup
- stesso stato auth
- DB benchmark dedicato, non il DB quotidiano

Baseline prima dei refactor:

```sh
./scripts/with-node.sh pnpm perf:benchmark -- \
  --runs 3 \
  --warmup 1 \
  --output-json .tmp/perf/p0-before.json \
  --output-md .tmp/perf/p0-before.md
```

Run finale dopo i refactor:

```sh
./scripts/with-node.sh pnpm perf:benchmark -- \
  --runs 3 \
  --warmup 1 \
  --output-json .tmp/perf/p0-after.json \
  --output-md .tmp/perf/p0-after.md
```

Se devi rieseguire solo la misura finale senza ripreparare un DB benchmark gia
migrato e popolato:

```sh
./scripts/with-node.sh pnpm perf:benchmark -- \
  --runs 3 \
  --warmup 1 \
  --skip-db-prepare \
  --output-json .tmp/perf/p0-after.json \
  --output-md .tmp/perf/p0-after.md
```

## Lettura minima del report

Per ogni route guarda almeno:

- `Status`: deve restare `200`; redirect o altri status vanno capiti prima di
  confrontare i tempi
- `Final path`: deve coincidere con la route richiesta; il benchmark fallisce se
  trova redirect non attesi
- `Median total (ms)`: metrica principale per il before/after
- `Median TTFB (ms)`: utile per capire se il guadagno arriva soprattutto dal
  server/data loading

Per i P0 il confronto minimo da riportare e:

- `/glossary`
- `/review`
- `/media/duel-masters-dm25/review`

Come guardrail extra, verifica anche almeno una route shell tra `/` e `/media`.

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

Nel bootstrap del server applicativo, un `DATABASE_URL=libsql://...` abilita
automaticamente una embedded replica locale in
`./data/japanese-custom-study-replica.db`. Il server sincronizza la replica al
boot e poi legge localmente, quindi i benchmark misurano soprattutto il costo
del sync iniziale e del render, non round-trip remoti per ogni singola query.

## Auth opzionale

Se l'app gira senza `AUTH_*`, il benchmark entra direttamente sulle route.

Se l'auth e attiva:

- il benchmark usa la stessa config auth caricata dal runtime;
- genera una sessione valida senza passare dalla form di login;
- non richiede variabili `BENCH_*` aggiuntive.

Esempio:

```sh
AUTH_USERNAME=owner \
AUTH_PASSWORD_HASH='pbkdf2_sha256$...' \
AUTH_SESSION_SECRET='super-secret-session-key' \
./scripts/with-node.sh pnpm perf:benchmark
```

## Metriche

- `TTFB`: `performance.navigation.responseStart`
- `load`: `performance.navigation.loadEventEnd`
- `total`: tempo wall-clock attorno a `page.goto(..., { waitUntil: "load" })`
- `Status`: HTTP status della navigazione finale osservata da Playwright

Il benchmark usa Chromium headless con cache disabilitata a livello browser per
tenere i run piu confrontabili.

## Nota sul flusso review

I benchmark di questo documento misurano soprattutto il costo di navigazione e
render delle route review. La sessione di grading usa anche un fast-path
interattivo separato: il client prefetcha la card successiva e prova un
avanzamento ottimistico subito dopo `Again/Hard/Good/Easy`, mentre il server
completa la mutazione e la riconciliazione in background.

Quando valuti regressioni sulla review non fermarti quindi al solo `TTFB` della
route `/review`: verifica anche manualmente che il passaggio risposta -> card
successiva resti immediato e che il fallback con rollback compaia solo in caso
di errore reale del submit.

Se Chromium non e ancora installato per Playwright:

```sh
./scripts/with-node.sh pnpm exec playwright install chromium
```

## Profilazione Review Su Vercel

Per isolare il collo di bottiglia della review sulla deployment reale, puoi
attivare un profiling temporaneo con:

```txt
/review?__profile=1
/media/<mediaSlug>/review?__profile=1
```

L'app salva un cookie tecnico di breve durata e scrive log strutturati con
prefisso `[review-timing]` per:

- route review globale e per-media;
- `getReviewPageData` / `getGlobalReviewPageLoadResult`;
- workspace review, fallback subject-level e pronunce card selezionata;
- server actions di prefetch e grading della review.

Per disattivarlo:

```txt
/review?__profile=0
```

Su Vercel puoi poi leggere i log del deployment e cercare `[review-timing]`
per confrontare i passi piu lenti della request reale.

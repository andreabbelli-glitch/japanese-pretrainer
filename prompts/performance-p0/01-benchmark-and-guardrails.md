# Task 01 - Benchmark e Guardrail

## Ruolo

Sei l'agente responsabile dei guardrail di performance per il rollout P0.
Il tuo lavoro non e risolvere i P0 applicativi, ma mettere in piedi un modo
credibile e ripetibile per misurare il prima e il dopo.

## Missione

Rafforza il benchmark esistente in modo che il team possa confrontare prima e
dopo dei task implementativi su glossary, review e pagine correlate.

## Contesto utile

- Esiste gia un benchmark documentato in `docs/performance-baseline.md`.
- Esiste gia uno script: `pnpm perf:benchmark`.
- Le route oggi misurate includono `/review` e `/glossary`, ma non e garantito
  che coprano abbastanza bene le route per-media piu colpite dai P0.
- Il repo ha gia test e fixture importanti in:
  - `tests/glossary.test.ts`
  - `tests/review.test.ts`
  - `tests/review-global-queue.test.ts`
  - `tests/e2e/glossary-portal.spec.ts`

## Ownership

Sei proprietario di questi file e aree:

- `scripts/perf-benchmark.ts`
- `docs/performance-baseline.md`
- eventuali helper nuovi sotto `scripts/` o `tests/helpers/` usati solo per il
  benchmark

Evita di toccare:

- `src/lib/glossary.ts`
- `src/lib/review.ts`
- `src/lib/app-shell.ts`
- `src/actions/*`

## Obiettivi concreti

1. Verifica che il benchmark misuri almeno:
   - `/glossary`
   - `/review`
   - una route review per-media
   - una route rilevante tra home o media library
2. Se serve, amplia lo script o la configurazione per rendere queste route
   misurabili in modo stabile.
3. Aggiorna la documentazione con istruzioni chiare per:
   - run baseline prima dei refactor
   - run finale dopo i refactor
   - interpretazione minima del report
4. Se serve, aggiungi piccoli helper per rendere il benchmark piu ripetibile,
   ma senza introdurre dipendenze invasive nel runtime applicativo.

## Vincoli

- Non introdurre cambiamenti di comportamento utente.
- Non aggiungere logging permanente rumoroso in produzione.
- Se hai bisogno di osservabilita extra, falla opt-in via script o env flag.
- Mantieni il write set separato dai task implementation principali.

## Criteri di accettazione

- Esiste un percorso chiaro e documentato per misurare before/after.
- Il benchmark copre le route critiche P0.
- La documentazione spiega come eseguire i run in locale con il dataset del
  progetto.
- Nessun cambiamento rompe `pnpm test`, `pnpm typecheck` o `pnpm perf:benchmark`.

## Validazione minima

Esegui e riporta i risultati di:

- `pnpm typecheck`
- `pnpm test`
- `pnpm perf:benchmark -- --runs 3 --warmup 1`

Se il benchmark completo e troppo lento, documenta il comando ridotto che hai
usato e perche.

## Output atteso nel tuo handoff

Restituisci solo:

- conclusione
- evidenze
- file modificati
- rischi
- passo successivo raccomandato

Nel punto "evidenze" includi:

- route coperte dal benchmark aggiornato
- comandi esatti usati
- eventuali limiti residui del setup

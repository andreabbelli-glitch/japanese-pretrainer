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

Per scegliere rapidamente workflow e verifiche in base al task, usa il
documento generato [`docs/agent-orientation.md`](./agent-orientation.md).

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
Quando il wrapper attiva `nvm`, il binario Node risolto da `.nvmrc` viene
portato davanti agli altri runtime gia presenti in `PATH`.

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

La suite Vitest esegue i file test in sequenza in `vitest.config.ts`. Molti
test creano database SQLite temporanei, eseguono migrazioni e importano bundle
reali; su macchine locali e sandbox Codex il parallelismo per file rende i test
piu lenti e fragili invece che piu rapidi, fino a timeout del worker pool.

Il gate `pnpm lint` usa ESLint su `.` ma la flat config esclude esplicitamente
artefatti locali e directory di tooling generate (`.codex/`, `.playwright-*`,
`output/`, `tmp/`, `test-results/`, cache SQLite/TypeScript). Le skill in
`.agents/` restano nel repo, ma ESLint ignora solo i loro file Markdown/YAML e
shell: eventuali helper JavaScript continuano a essere coperti dal lint.

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

`./scripts/with-node.sh pnpm release:check` prepara un DB SQLite locale dedicato
in `.tmp/release-check/`, valida i corpus Pitch Accent vendorizzati e forza
build/E2E su quel database. Questo evita che un `.env.local` puntato a Turso
consumi quota remota durante i gate locali.

Workflow immagini:

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25
```

`image:apply` aggiorna i markdown, ma il reader usa il contenuto importato nel
DB locale. Dopo un apply reale serve quindi un nuovo `content:import`.
Se l'apply o la revisione tocca solo una o poche lesson, puoi limitare il sync
DB alle sole route textbook coinvolte:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25 --lesson-slug <lesson-slug>
```

Ripeti `--lesson-slug` per piu lesson dello stesso media. Usa invece il solo
`--media-slug` quando hai rinumerato lesson, spostato segmenti su larga scala o
vuoi applicare archive/prune completi dentro quel media.

Workflow pronunce:

```sh
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/duel-masters-dm25/textbook/tcg-core-overview
./scripts/with-node.sh pnpm pronunciations:tofugu:sync
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode targeted --media duel-masters-dm25 --entry term-cost
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested -- --audio-index /tmp/forvo-requested-audio-index.json
```

`pronunciations:resolve` e il percorso operativo standard: seleziona i target
da review, prossima lesson o pagina textbook, filtra le entry gia coperte,
prova il riuso cross-media, importa eventuali match esatti dal dataset locale
Tofugu/WaniKani e manda solo il residuo al fetch Forvo Anki-style (helper Anki
dedicato, player `Play(...)`, ranking speaker, download diretto, conversione
OGG -> MP3). Aggiorna anche lo storico
`data/forvo-requested-word-add.json`, marcando come `resolved` le entry per cui
e' stato trovato un audio. Anche i target espliciti usano
`pronunciations:resolve -- --mode targeted`; il fetcher Forvo diretto resta
solo per manutenzione interna con `--direct-fetcher-debug` o fallback manuale
estremo.

Il dataset Tofugu/WaniKani completo resta locale e ignorato da git sotto
`data/tofugu-japanese-vocabulary-pronunciation-audio`; `pronunciations:tofugu:sync`
lo clona o aggiorna. Durante `pronunciations:resolve -- --dry-run` il resolver
non scarica e non copia file, ma usa il dataset se e' gia presente.

Se Forvo non espone una pronuncia, il workflow deve aprire la richiesta
`word-add/...` precompilata e registrarla in
`data/forvo-requested-word-add.json` / `data/forvo-known-missing.json`. Il
download manuale dal browser normale e' solo extrema ratio per casi singoli in
cui la logica Anki-style o l'import diretto falliscono; non e' il percorso
standard e non va usato per batch ordinari.

Quando una richiesta storica e' stata soddisfatta su Forvo, importa l'indice
audio estratto dalla pagina account autenticata con
`pronunciations:forvo:import-requested`; il comando scarica il file diretto,
converte OGG in MP3 e aggiorna manifest, registri Forvo e pending summary.

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

`fsrs:optimize:if-needed` e il comando CLI per eseguire manualmente lo stesso
gate. Il comando fa no-op finche non sono passati almeno `30` giorni
dall'ultimo training riuscito oppure non ci sono abbastanza review nuove
eleggibili. La soglia review e dinamica:
`min(3000, max(500, 25% delle review usate nell'ultimo training riuscito))`.
Questa policy mantiene un floor minimo nelle prime fasi, cresce con il dataset
quando il segnale storico e ancora piccolo, e applica un cap per non rendere il
retrain troppo raro quando la cronologia diventa grande.

In produzione il job e registrato in `vercel.json`: Vercel Cron chiama una
volta al giorno `/api/internal/fsrs-optimizer/run`, che richiede
`Authorization: Bearer $CRON_SECRET` e usa il `DATABASE_URL` canonico del
runtime. L'orario cron e in UTC e puo essere invocato da Vercel entro la
finestra oraria prevista dal piano. Il job deve restare leggero: controlla prima
le soglie e non carica lo storico completo dei log se il training non e dovuto.

Per Turso remoto, non usare i workflow GitHub come sync generico a ogni push:
`Sync Turso On Main` e limitato a migrazioni e import media-scoped, mentre il
backup remoto e manuale perche `turso db export` puo consumare molte `Rows Read`.

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

Se il cambio e limitato a una o piu lesson dello stesso media, l'import puo
essere lesson-scoped:

```sh
./scripts/with-node.sh pnpm content:import -- --media-slug <media-slug> --lesson-slug <lesson-slug> [--lesson-slug <lesson-slug> ...]
```

Se la skill crea o modifica card, pronunce o accenti, aggiunge i workflow
specifici del media, per esempio `pronunciations:pending` e
`pitch-accents:fetch`. Per nuove flashcard locali, il fetch accenti deve essere
mirato alle entry appena create o riviste, usando `--entry <id>` come default e
`--word` / `--words-file` solo quando la lista ID non e disponibile. Se il
fetch stampa `review_required`, valuta i candidati e salva manualmente
l'accento solo quando e giustificato; non trattarlo come risoluzione
automatica. Se invece
cambia codice di parser, importer, routing, DB, auth, cache o UI, torna ai gate
canonici del repo e ai test mirati indicati dalla skill.

## Gate agent-facing

Per modifiche a documenti o strumenti che orientano gli agenti, esegui:

```sh
./scripts/with-node.sh pnpm agent:check
```

Il comando verifica che `docs/agent-orientation.md` sia aggiornato, che ogni
skill repo-scoped abbia una sezione `## Verification`, che il diff corrente
renda esplicite modifiche a path protetti e che
`docs/llm-kit/general/01-content-format.md` resti allineato byte-per-byte a
`docs/content-format.md`.

`agent:check` resta un gate standalone: non sostituisce `pnpm check`, i gate
content-only dichiarati dalle skill, `content:validate`, `content:import` o
`release:check`. Se stai eseguendo un workflow contenuto esplicito e hai
modifiche legittime sotto `content/`, `content/media/**/workflow/**` o
`drizzle/`, puoi rilanciarlo con:

```sh
./scripts/with-node.sh pnpm agent:check -- --allow-protected-paths
```

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
scelta inversa romaji -> katakana, RAN Grid e opzioni raw senza creare una
tabella catalogo. I preset manuali sono un input di planning separato da
`sessionMode`: usano le tabelle session/trial/block/result esistenti e salvano
metadata in JSON snapshot.

I termini media/ad hoc aggiuntivi vivono in
`src/features/katakana-speed/model/media-word-bank.json`. Per aggiunte manuali
usa la skill repo-scoped `.agents/skills/katakana-speed-word-bank`, che fornisce
lo script `scripts/add-katakana-words.mjs`; le parole entrano nel catalogo come
candidati normali, senza preferenza nello scheduling.

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

## Pitch Accent Minimal Pairs

Pitch Accent usa corpus statici vendorizzati sotto `public/vendor/`: il corpus
base GPL-3.0 di `Kuuuube/minimal-pairs` e il corpus aggiuntivo Tofugu/Jaydar
generato offline. A runtime persiste solo sessioni nelle tabelle
`pitch_accent_*`. Non usa FSRS, non modifica `/review` e non scrive in
`content/`.

Il loader runtime puo escludere singoli pair vendorizzati che risultano
ambigui o fuorvianti in pratica, mantenendo invariati manifest e audio vendor
per audit e validazione.

La UI normalizza anche le letture Kuuuube con handakuten combinante sulla riga
K (`カ゚`, `キ゚`, `ク゚`, `ケ゚`, `コ゚`) in kana sonori (`ガ`, `ギ`, `グ`,
`ゲ`, `ゴ`). I dati upstream restano invariati, ma label e notazione
pitch-accent non devono mostrare il segno combinante come mora separata.

Import o refresh del vendor corpus:

```sh
./scripts/with-node.sh pnpm pitch-accent:import-minimal-pairs
./scripts/with-node.sh pnpm pitch-accent:validate-corpus
./scripts/with-node.sh pnpm pitch-accent:validate-tofugu-pairs
```

Per test mirati:

```sh
./scripts/with-node.sh pnpm exec vitest run tests/pitch-accent-corpus.test.ts tests/pitch-accent-importer.test.ts tests/pitch-accent-session-persistence.test.ts tests/pitch-accent-interactions.test.ts
./scripts/with-node.sh pnpm exec playwright test tests/e2e/pitch-accent.spec.ts
```

Quando aggiungi o cambi tabelle `pitch_accent_*`, genera sempre la migrazione
con:

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

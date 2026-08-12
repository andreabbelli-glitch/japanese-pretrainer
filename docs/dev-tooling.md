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

## Audio pronunce statico

Gli audio locali delle pronunce restano versionati in
`content/media/<slug>/assets/audio/**`, ma l'app li serve a runtime da
`public/media-audio/<slug>/audio/**`. La directory `public/media-audio/` e'
generata, ignorata da git e viene ricostruita prima di `pnpm dev` e
`pnpm build`.

Comandi diretti:

```sh
./scripts/with-node.sh pnpm media-audio:sync
./scripts/with-node.sh pnpm media-audio:check
```

Usa `media-audio:sync` dopo workflow che aggiungono o sostituiscono file audio,
salvo che il prossimo step sia gia `./scripts/with-node.sh pnpm dev` o
`./scripts/with-node.sh pnpm build`. `media-audio:check` deve passare prima di
considerare allineata una build o una verifica cache. Gli URL emessi da review,
glossary, textbook e consolidation devono usare `/media-audio/...` con
`?v=<updatedAt>` quando il timestamp entry e' disponibile; immagini e altri
asset continuano invece a usare `/media/[mediaSlug]/assets/...`.

La suite Vitest esegue i file in parallelo, con isolamento tra file e un limite
predefinito di quattro worker. Questo e il compromesso verificato tra latenza e
pressione CPU per i test che creano database SQLite temporanei, eseguono
migrazioni o importano bundle reali. Su macchine piu piccole puoi ridurre il
limite senza cambiare configurazione:

```sh
VITEST_MAX_WORKERS=2 ./scripts/with-node.sh pnpm test
```

`VITEST_MAX_WORKERS` accetta solo interi positivi; valori non validi fermano il
comando invece di produrre una configurazione ambigua. L'isolamento resta
sempre attivo: disabilitarlo permette a mock e globali di contaminare altri
file.

Per misurare la suite completa o un sottoinsieme usa il reporter di profiling:

```sh
./scripts/with-node.sh pnpm test:profile
./scripts/with-node.sh pnpm test:profile tests/review-queue-ordering.test.ts
```

Il comando mostra i 15 file e test piu lenti e scrive il report machine-readable
versionato in `.tmp/test-profile/vitest-profile.json`. Il tempo worker e la
somma di setup ambiente, preparazione, collection, setup e test/hook per tutti i
file; con il parallelismo puo quindi essere superiore al tempo wall-clock. Puoi
cambiare solo il path del report con `VITEST_PROFILE_OUTPUT=<path>`.

Il gate `pnpm lint` usa ESLint su `.` e conserva la cache content-aware sotto
`.tmp/eslint/`, una directory locale ignorata da Git. La flat config esclude
esplicitamente artefatti locali e directory di tooling generate (`.codex/`,
`.playwright-*`, `output/`, `tmp/`, `test-results/`, cache SQLite/TypeScript).
Le skill in `.agents/` restano nel repo, ma ESLint ignora solo i loro file
Markdown/YAML e shell: eventuali helper JavaScript continuano a essere coperti
dal lint. Per una diagnosi eccezionale senza cache esegui direttamente
`./scripts/with-node.sh pnpm exec eslint . --max-warnings=0 --no-cache`.

Il gate `pnpm check` esegue prima `pnpm file-size:check`: il controllo guarda
solo i file di codice human-maintained modificati nel diff corrente e fallisce
quando una slice tocca un file molto grande. In quel caso il cambio va
spezzato in moduli piu focalizzati prima di procedere.

## Helper contenuti Duel Masters

`dm:card-fetch` compatta una pagina ufficiale Takara Tomy TCG in poche righe
verificabili:

```sh
./scripts/with-node.sh pnpm dm:card-fetch -- --official-id dm25rp4-T07 --expect-name "天災 デドダム" --expect-keyword "出た時"
./scripts/with-node.sh pnpm dm:card-fetch -- --url "https://dm.takaratomy.co.jp/card/detail/?id=dmr19-067" --expect-keyword "ブロッカー"
```

Il tool e read-only, accetta solo URL `https://dm.takaratomy.co.jp/card/detail/`
con un solo `id` sicuro, e stampa `authority=helper` con flag come
`verify_with_screenshot`, `errata_possible`, `duel_plays_not_checked` e
`ground_truth_user_input`. Usa `--expect-name`, `--expect-type`,
`--expect-print`, `--expect-keyword` e `--expect-text-line` per confrontare la
pagina ufficiale con cio che e visibile nello screenshot o nel testo fornito
dall'utente. Exit code: `0` trovato, `1` errore CLI/input, `2` fetch/source,
`3` pagina non parsabile o non trovata, `4` mismatch con gli `--expect-*`.

`dm:official-text-compare` e il wrapper piu stretto quando hai gia trascritto
campi o righe visibili dall'input utente e vuoi solo sapere se la pagina
ufficiale li contraddice:

```sh
./scripts/with-node.sh pnpm dm:official-text-compare -- --official-id dmr19-067 --visible-name "トリガ・トリカマ" --visible-keyword "ブロッカー" --visible-card-line "このクリーチャーは攻撃できない。"
./scripts/with-node.sh pnpm dm:official-text-compare -- --url "https://dm.takaratomy.co.jp/card/detail/?id=dmr19-067" --visible-text-file ./tmp/visible-card-text.txt
```

Il tool riusa il parser ufficiale di `dm:card-fetch`, non fa OCR, non cerca
Duel Masters Play's e rifiuta run senza input visibile. Output `supported`
significa solo che non ha trovato contraddizioni nei campi controllati; su
`mismatch` esce con codice `4` e l'azione resta conservativa: mantieni
screenshot/testo utente e ispeziona errata, ristampa o variante prima di
copiare wording ufficiale.

`dm:live-card-scaffold` prepara il piano append-only per una nuova lesson
per-card nel segmento `live-duel-encounters` di `duel-masters-dm25`:

```sh
./scripts/with-node.sh pnpm dm:live-card-scaffold -- --card-slug <card-slug> --title "<titolo lesson>" --summary "<summary UI plain text>"
./scripts/with-node.sh pnpm dm:live-card-scaffold -- --card-slug <card-slug> --title "<titolo lesson>" --official-id <official-card-id> --write
```

Di default e plan-only. Con `--write` crea solo il textbook shell valido,
rifiutando collisioni e trattenendo l'import finche il contenuto reale non e
stato scritto. Non crea `cards/` o asset: stampa invece il path pianificato,
i comandi di verifica mirati e, se passi `--official-id` o `--url`, il comando
`dm:card-fetch` da eseguire come helper. La ground truth resta sempre lo
screenshot/testo fornito dall'utente.

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
in `.tmp/release-check/`, esegue un `content:import` completo e forza build/E2E
su quel database. L'import completo esegue gia il parse e la validazione di
tutti i bundle e interrompe la sync se trova issue; il release gate non ripete
quindi un secondo `content:validate`. Il comando standalone resta il preflight
editoriale canonico, mentre il gate valida anche i corpus Pitch Accent
vendorizzati. Questo evita inoltre che un `.env.local` puntato a Turso consumi
quota remota durante i gate locali.

Applicazione di blocchi immagine da asset reali:

```sh
./scripts/with-node.sh pnpm image:status -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25 --dry-run
./scripts/with-node.sh pnpm image:apply -- --media-slug duel-masters-dm25
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25
```

`image:status` / `image:apply` servono solo quando ci sono asset immagine reali
gia risolti da applicare ai textbook. Non sono un workflow per tracciare
immagini mancanti. `image:apply` aggiorna i markdown, ma il reader usa il
contenuto importato nel DB locale. Dopo un apply reale serve quindi un nuovo
`content:import`.
Il DB locale resta un artefatto runtime disposable: per decidere quali lesson,
entry o flashcard esistono gia, usa i Markdown validati in `content/media/**`,
non lo snapshot SQLite locale.

Per ridurre ricerche manuali e token spesi dagli agenti, usa i helper
read-only sui Markdown prima di creare nuove entry, card o lesson:

```sh
./scripts/with-node.sh pnpm content:lookup -- --media-slug <media-slug> "<superficie-giapponese-esatta>"
./scripts/with-node.sh pnpm content:lookup -- --media-slug <media-slug> --kind grammar "～ている"
./scripts/with-node.sh pnpm content:lookup-batch -- --media-slug <media-slug> --query "<superficie-1>" --grammar "<pattern-1>"
./scripts/with-node.sh pnpm content:lookup -- --media-slug <media-slug> --list entries
./scripts/with-node.sh pnpm content:entry-brief -- --media-slug <media-slug> --entry-id <entry-id>
./scripts/with-node.sh pnpm content:entry-usage -- --media-slug <media-slug> --entry-id <entry-id>
./scripts/with-node.sh pnpm content:lesson-brief -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm content:lesson-workflow-check -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm dm:live-card-scaffold -- --card-slug <card-slug> --title "<titolo lesson>"
./scripts/with-node.sh pnpm dm:official-text-compare -- --official-id <official-card-id> --visible-name "<visible-card-name>" --visible-card-line "<visible-card-line>"
./scripts/with-node.sh pnpm content:next-id -- --media-slug <media-slug> --slug <new-lesson-slug>
./scripts/with-node.sh pnpm content:scaffold -- --media-slug <media-slug> --slug <new-lesson-slug> --title "<titolo>"
./scripts/with-node.sh pnpm content:editorial-lint -- --media-slug <media-slug> --lesson-slug <lesson-slug>
./scripts/with-node.sh pnpm content:scope
./scripts/with-node.sh pnpm app:progress-brief -- --media-slug <media-slug>
./scripts/with-node.sh pnpm agent:verify
```

`content:lookup` stampa un verdetto compatto (`covered-card`, `entry-only`,
`new`) e non usa il DB. Cerca match esatti su ID, superficie, reading, alias e
front card, normalizzando furigana e varianti `~`/`～`/`〜`; non fa dedup
semantico fuzzy e non cerca nelle traduzioni. `--list entries|cards|lessons`
e' una vista inventory leggera, non un export globale da incollare agli LLM.
Quando hai piu candidati da controllare, preferisci `content:lookup-batch`
oppure `content:lookup -- --query ... --query ...`: il bundle viene parsato una
sola volta e l'output resta ordinato per query con una sola riga `SUMMARY`.
Usa `--term`, `--grammar` o `--card` per candidati con tipo noto, invece di
lanciare lookup separati.

`content:entry-brief` carica una sola entry tramite parser Markdown e stampa
fonte, significato, audio/accento, lesson, card e riferimenti collegati in forma
compatta. Usalo prima di aggiungere o correggere card/entry quando hai gia un
`entry_id` o una superficie esatta: fallisce chiuso su match ambigui e non usa
il DB, quindi evita dump manuali di cards/textbook senza diventare dedup fuzzy.

`content:entry-usage` e' ancora piu mirato: dopo che conosci un `entry_id`,
stampa stato `covered-card`/`entry-only`, card collegate e riferimenti semantici
con file/linea gia risolti. Usalo quando devi capire dove una entry ricorre
senza fare `rg` su tutto il media; non cerca substring raw e non sostituisce
`content:lookup-batch` per scoprire l'ID.

`content:lesson-brief` compatta una lesson nota in identita, file, headings,
entry, card, immagini, warning editoriali e comandi minimi di validate/import.
Usalo prima di revisionare o consegnare una lesson a un LLM; quando devi
riscrivere prosa esatta, apri comunque il Markdown sorgente della sezione da
modificare.

`content:lesson-workflow-check` chiude il workflow normale per lesson note:
valida il media, esegue `content:editorial-lint` sulle lesson indicate,
controlla che il piano resti lesson-scoped e stampa il comando import minimo.
Di default non modifica il DB; aggiungi `--import` solo quando vuoi importare
quello stesso scope. Con `--import` usa la stessa cache revalidation di
`content:import`. Blocca i warning editoriali salvo
`--allow-editorial-warnings`; non gestisce pronunce, canary, statistiche o
scope media-wide.

`content:next-id` calcola path, prefix, `order`, `lesson_id` e `cards_id` per
una nuova coppia textbook/cards. E' append-only e read-only: non riempie gap,
non rinumera file e segnala collisioni invece di inventare suffissi.

`content:scaffold` usa lo stesso piano di `content:next-id` e scrive solo il
file `textbook/*.md` con frontmatter valido e append-only. Non crea un
`cards/*.md` vuoto, perche i cards file senza blocchi `:::card` sono invalidi:
stampa invece il path pianificato da usare quando le card reali sono pronte.
Non stampa un comando import immediato per la shell vuota: riempi prima il
contenuto reale, poi usa `content:scope`. Usa `--print --json` se vuoi solo il
piano senza scrivere.

Per nuove lesson live-card Duel Masters, preferisci `dm:live-card-scaffold`: e'
un preset piu stretto per `duel-masters-dm25`/`live-duel-encounters`, resta
plan-only finche non passi `--write`, scrive solo il textbook shell e non
inventa cards o asset.

Quando hai gia trascritto piu campi o righe visibili di una carta Duel
Masters, preferisci `dm:official-text-compare` a un fetch raw: e' read-only,
riusa il parser di `dm:card-fetch`, rifiuta run senza input visibile e segnala
solo se la pagina ufficiale contraddice lo screenshot/testo utente.

`content:editorial-lint` scansiona Markdown e blocchi strutturati già parsati,
incluse le card (`front`, `back`, esempi e note), e stampa warning editoriali
su meta-discorso, frasi povere, contrasti stock, esempi `example_jp`
metalinguistici e accenti italiani degradati. Usalo prima di importare o
caricare una lesson appena creata o revisionata; i warning sono promemoria
editoriali da valutare e correggere seriamente, non un gate da aggirare con
rinomini superficiali o soppressioni.

`content:scope` traduce i file modificati in comandi minimi di verifica/import:
di default legge `git status` su `content/media/**`; puoi anche passare path
espliciti. Non esegue dry-run DB, validazione o import: stampa solo `VALIDATE`
e `IMPORT` consigliati, usando lesson scope quando riesce a mappare i file
`textbook/` o `cards/` agli slug delle route textbook.

`app:progress-brief` interroga il DB runtime configurato (`DATABASE_URL`,
incluso Turso remoto quando `.env.local` lo punta) e stampa lo stato reale
dell'app: ultima lesson completata/aperta, resume lesson, active lesson,
conteggi textbook e se il DB e locale o remoto. Usalo quando la domanda parla
di "ultima lesson completata", "dove sono arrivato" o stato d'uso dell'app. Non
legge Markdown, non esegue import/migrazioni e non sostituisce i content helper:
per decisioni editoriali la source of truth resta `content/media/**`.

`agent:verify` e' il verificatore di gate read-only: di default legge i file
modificati nel repo e stampa i comandi minimi da eseguire (`check`,
`release:check`, `agent:check`, o i gate content derivati da `content:scope`).
Non esegue test o import e non sostituisce la sezione `Verification` delle
skill content.

Minimizza sempre lo scope del sync DB: se l'apply o la revisione tocca solo una
o poche lesson note, devi limitare l'import alle sole route textbook coinvolte:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root ./content --media-slug duel-masters-dm25 --lesson-slug <lesson-slug>
```

Ripeti `--lesson-slug` per piu lesson dello stesso media. Usa invece il solo
`--media-slug` solo quando hai rinumerato lesson, spostato segmenti su larga
scala o vuoi applicare archive/prune completi dentro quel media.

Workflow pronunce:

```sh
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/duel-masters-dm25/textbook/tcg-core-overview
./scripts/with-node.sh pnpm pronunciations:tofugu:sync
./scripts/with-node.sh pnpm forvo:preflight -- --mode targeted --media duel-masters-dm25 --entry term-cost
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode targeted --media duel-masters-dm25 --entry term-cost
./scripts/with-node.sh pnpm pronunciations:resolve-entries -- --media-slug duel-masters-dm25 --entry term-cost --preflight
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

`forvo:preflight` e un helper read-only e rapido da usare quando l'LLM sta per
aprire un batch Forvo incerto, costoso o potenzialmente gia coperto. Riusa la
selezione del resolver, legge solo content/DB locale e i registri
`data/forvo-known-missing.json` / `data/forvo-requested-word-add.json`, poi
stampa stato, target, known-missing, richieste gia aperte e il comando
canonico `pronunciations:resolve` da lanciare. Non contatta Forvo, non apre
browser, non copia audio e non e un altro dry-run: per target piccoli e ovvi
puoi saltarlo e chiamare direttamente `pronunciations:resolve`.

`pronunciations:resolve-entries` e il wrapper piu stretto per entry ID appena
creati o revisionati: richiede `--media-slug` e uno o piu `--entry` o una
`--entries-file`, inoltra al resolver in `--mode targeted`, e rifiuta selector
non-entry come `--word`, `--words-file`, `--lesson-url` e `--mode`. Usa
`--preflight` o `--preflight-only` quando vuoi includere il check read-only
senza ricostruire a mano il comando `forvo:preflight`; usa `--print-command`
per auditare la run senza eseguirla.

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

`fsrs:optimize` forza una valutazione dei preset `recognition` e `concept`
usando i log di `review_subject_log`. Il run forzato ignora il flag `enabled`:
quel flag blocca solo il job automatico schedulato. Un preset viene salvato in
`user_setting` soltanto quando il candidato migliora l'incumbent sul holdout
temporale e rispetta il guardrail RMSE; un candidato regressivo viene registrato
nello stato del run ma non attivato.

`FSRS_OPTIMIZER_TRAINING_TIMEOUT_MS` puo ridurre o estendere la deadline
end-to-end di ogni preset, che comprende lettura del ledger condiviso,
costruzione dataset, split, training e valutazione; se non e impostato resta il
default runtime di `4000ms`. Il binding riceve il `90%` del budget residuo:
la coda restante e riservata alla restituzione dei pesi e alle due valutazioni
sul holdout, evitando che il timeout interno del binding corra contro la stessa
deadline esterna.

Le dipendenze sono pin esatti a `ts-fsrs@5.2.3` e
`@open-spaced-repetition/binding@0.5.0`, basato su FSRS Rust `6.5.0`. Il dataset
`fsrs6-prefix-target-v2` include un
prefisso solo quando la review finale ha `deltaT > 0`; gli eventi `reset` e una
transizione legacy da `new` iniziano una nuova sequenza. Training e holdout
sono separati cronologicamente (almeno 100 target per lato con il binding
ufficiale). I due preset mantengono conteggi, watermark, errori e readiness
indipendenti. Un errore o una deadline scaduta viene registrata solo sul preset
coinvolto e non impedisce la promozione dell'altro; promozioni e progressi dei
due preset vengono committati insieme. Il writer transazionale non produce
side effect: cache runtime e tag vengono invalidati una sola volta dopo il
commit riuscito, mai dopo un rollback. Se tutti i preset valutati falliscono,
il risultato globale e `failed` e `lastTrainingError` conserva il riepilogo;
Settings mostra anche l'errore specifico di ciascun preset. Un token di run
impedisce a un'esecuzione lenta o duplicata di sovrascrivere parametri piu
recenti.

`fsrs:optimize:if-needed` e il comando CLI per eseguire manualmente lo stesso
gate. Il comando fa no-op, per ogni preset, finche non sono passati almeno `30`
giorni dall'ultima valutazione oppure non ci sono abbastanza review nuove
eleggibili. La soglia review per-preset e dinamica:
`min(3000, max(500, 25% delle review usate nell'ultima valutazione))`.
Il gate temporale include `60` minuti di tolleranza per la finestra di consegna
del cron Vercel.
Questa policy mantiene un floor minimo nelle prime fasi, cresce con il dataset
quando il segnale storico e ancora piccolo, e applica un cap per non rendere il
retrain troppo raro quando la cronologia diventa grande.
Se un preset supera il gate ma non ha ancora abbastanza target per lo split,
l'optimizer conserva baseline e watermark e applica un cooldown di `7` giorni
prima di ricostruire lo stesso storico. `fsrs:optimize` ignora il cooldown.

In produzione il job e registrato in `vercel.json`: Vercel Cron chiama una
volta al giorno `/api/internal/fsrs-optimizer/run`, che richiede
`Authorization: Bearer $CRON_SECRET` e usa il `DATABASE_URL` canonico del
runtime. L'orario cron e in UTC e puo essere invocato da Vercel entro la
finestra oraria prevista dal piano. Il job deve restare leggero: controlla prima
le soglie con un'aggregazione SQL e non carica lo storico completo dei log se
nessun preset e dovuto. I preset vengono elaborati in sequenza, non nel request
path interattivo, per limitare picchi CPU/memoria e roundtrip Turso sul piano
gratuito mono-utente.

Per Turso remoto, non usare i workflow GitHub come sync generico a ogni push:
`Sync Turso On Main` e limitato a migrazioni e import media-scoped, mentre il
backup remoto e manuale perche `turso db export` puo consumare molte `Rows Read`.

Workflow monitor notifiche mobile:

```sh
.github/workflows/mobile-review-notifications.yml
```

La review live di Daily Kanji iOS non usa Vercel Hobby Cron per near-real-time
push: la cadenza gratuita di Vercel Cron non e pensata per un tick ogni pochi
minuti e va riletta nella pagina ufficiale
<https://vercel.com/docs/cron-jobs/usage-and-pricing> prima di cambiare
strategia. Per ora il monitor GitHub Actions e sospeso perche le notifiche
mobile/APNs non sono ancora affidabili: il workflow espone solo
`workflow_dispatch` manuale e deve generare `0 chiamate automatiche` verso
Vercel. La sintassi GitHub Actions resta documentata in
<https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions>.

La workflow deve restare un tick minimale: niente checkout, niente setup Node,
niente credenziali Turso o APNs, niente logica di review. Esegue solo un
`curl` `POST` manuale verso l'endpoint protetto configurato nei secret GitHub
`MOBILE_REVIEW_NOTIFICATION_MONITOR_URL` e
`MOBILE_NOTIFICATION_MONITOR_SECRET`; se questi secret mancano, deve fare skip
con successo per evitare failure rumorose. Non committare mai URL
privati, secret APNs/mobile/monitor o token Turso in YAML, `.env*`, script o
documentazione.

Se il monitor verra riattivato, mantieni la cadenza a `5` minuti salvo revisione
intenzionale del budget: significa circa `288` chiamate al giorno e `8.640`
chiamate al mese. Il runtime server deve mantenere ogni tick altrettanto
piccolo: una sola due-count check su Turso per run, seguita da eventuale invio
APNs solo quando ci sono review mobile davvero dovute.

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

Per le slice editoriali Duel Masters che toccano il bundle reale DM25, usa il
canary mirato invece di ricordare a mano il path Vitest:

```sh
./scripts/with-node.sh pnpm test:real-bundle
```

Il comando esegue solo `tests/content-real-bundle-canary.test.ts`, cioe parse e
import del bundle reale contro le statistiche aggregate versionate.

Quando le statistiche aggregate del canary sono intenzionalmente cambiate, usa
`./scripts/with-node.sh pnpm content:canary-diff` per vedere le differenze
parser/importer rispetto alla fixture versionata; il comando torna exit 1 se
trova delta e stampa il comando di aggiornamento. Quando le differenze sono
intenzionali, usa
`./scripts/with-node.sh pnpm content:test-stats -- --write` per aggiornarle.
Durante una diagnosi read-only di un bundle ancora invalido puoi usare
`./scripts/with-node.sh pnpm content:test-stats -- --accept-failure`: il comando
riporta l'errore ma torna exit 0. Il flag e rifiutato insieme a `--write`, cosi
un aggiornamento fixture non puo mascherare un parse/import fallito.

Per un normale aggiornamento editoriale, minimizza lo scope dell'import. Se il
cambio e limitato a una o piu lesson note dello stesso media, l'import deve
essere lesson-scoped:

```sh
./scripts/with-node.sh pnpm content:validate -- --media-slug <media-slug>
./scripts/with-node.sh pnpm content:import -- --media-slug <media-slug> --lesson-slug <lesson-slug> [--lesson-slug <lesson-slug> ...]
```

Usa l'import media-scoped solo quando lo scope lesson non e noto o quando il
cambio riguarda davvero l'intero media:

```sh
./scripts/with-node.sh pnpm content:import -- --media-slug <media-slug>
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

Katakana Speed usa `src/features/katakana-speed/model/catalog.ts` come
materializzatore/facade del catalogo: righe statiche di item e cluster stanno in
`src/features/katakana-speed/model/catalog-static-data.ts`, la phrase bank in
`src/features/katakana-speed/model/sentence-bank.ts`, i pseudoword in
`src/features/katakana-speed/model/pseudoword-catalog.ts` e i termini media/ad
hoc in `src/features/katakana-speed/model/media-word-bank.json`. La feature
persiste solo stato runtime nelle tabelle `katakana_*`. Non richiede workflow
contenuto, import dei media, pronunce o asset audio.

Il registry operativo non-audio vive in
`src/features/katakana-speed/model/exercise-catalog.ts` e alimenta word bank,
scelta inversa romaji -> katakana, RAN Grid e opzioni raw senza creare una
tabella catalogo. I preset manuali sono un input di planning separato da
`sessionMode`: usano le tabelle session/trial/block/result esistenti e salvano
metadata in JSON snapshot.

I termini media/ad hoc aggiuntivi vivono in
`src/features/katakana-speed/model/media-word-bank.json`. Per aggiunte manuali
usa la skill repo-scoped `.agents/skills/katakana-speed-word-bank`, che contiene
lo script interno
`.agents/skills/katakana-speed-word-bank/scripts/add-katakana-words.mjs` da
lanciare tramite `./scripts/with-node.sh pnpm exec node`; le parole entrano nel
catalogo come candidati normali, senza preferenza nello scheduling.

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

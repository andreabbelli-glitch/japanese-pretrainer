# Japanese Custom Study

Webapp privata single-user per studiare giapponese a partire da media specifici
(anime, videogiochi, TCG, visual novel, siti web, ecc.) prima di consumarli davvero.

## Obiettivo

Per ogni media, l'app deve offrire:

- un textbook progressivo organizzato per difficolta e per segmenti del media;
- un glossary ricercabile per kanji, kana e romaji;
- un sistema di review FSRS-based con grading tipo Anki per vocaboli, frasi e pattern grammaticali;
- tracking dei progressi di studio e della review;
- supporto nativo a furigana e tooltip contestuali.

## Stato Del Repository

Il repository include attualmente:

- app `Next.js` con App Router e TypeScript;
- shell desktop/mobile coerente con la direzione UX/UI approvata;
- dashboard `/`, media library `/media` e media detail `/media/[mediaSlug]`;
- route globali top-level `/glossary` e `/review`, con `/review` come
  workspace globale reale, `/media/[mediaSlug]/review` come filtro verticale
  locale e un empty state dedicato al primo avvio quando non ci sono ancora
  media o card da ripassare;
- textbook media-scoped in `/media/[mediaSlug]/textbook`, con lesson route sotto
  `/media/[mediaSlug]/textbook/[lessonSlug]`;
- progress integrato nell'overview `/media/[mediaSlug]`, mentre
  `/media/[mediaSlug]/progress` resta un redirect di compatibilita verso
  `#overview`;
- limite dei nuovi globale sulla review, non per media;
- font self-hosted, cosi `build` non dipende da fetch esterni;
- tooling locale per lint, format, typecheck, test unit/integration ed E2E;
- workspace top-level `Katakana Speed` per drill katakana locale-first,
  separato da review, media e Kanji Clash;
- struttura cartelle coerente con importer, persistence e UI gia in uso.

## Glossary Canonico Globale

Il glossary pubblico e solo globale: `/glossary` mostra l'enciclopedia
ricercabile cross-media e le CTA dei media puntano a `/glossary?media=<slug>`.
Le vecchie route `/media/[mediaSlug]/glossary` e detail locali restano solo
stub di compatibilita nel router e restituiscono `404`: non sono piu una
superficie supportata e non vengono trattate come contesto Glossary da nav o
`returnTo`.

Termini e pattern grammaticali vengono raggruppati automaticamente per
superficie grafica normalizzata. Le occorrenze editoriali restano locali al
media, ma la pagina globale e la review mostrano un'unica voce/subject con le
sfaccettature incontrate nei media studiati.

## Semantica Del Resume Textbook

Le CTA come `Continua il percorso` nel Textbook e nei punti di ingresso del
media seguono intenzionalmente il primo step non ancora completato del percorso.
Non puntano automaticamente all'ultima lesson `in_progress` aperta di recente:
la scelta privilegia l'avanzamento lineare del curriculum rispetto al semplice
"ultimo punto visitato".

## Modello Review Globale

La review usa un modello canonico a livello subject:

- `review_subject_state` contiene lo stato FSRS globale del subject condiviso;
- `review_subject_log` registra la cronologia delle risposte a livello subject.

La migrazione SQL [`drizzle/0011_global_review_subjects.sql`](./drizzle/0011_global_review_subjects.sql)
crea le tabelle subject-level. Il flusso normale materializza e riallinea
`review_subject_state` direttamente durante `pnpm content:import` e
`pnpm db:seed`, senza un backfill automatico separato dopo migrate/startup. La
cleanup migration
[`drizzle/0014_oval_expediter.sql`](./drizzle/0014_oval_expediter.sql) rimuove
poi le vecchie tabelle card-level `review_state` e `review_log`, ormai non piu
usate dal runtime. Per rieseguire il pass manualmente esiste anche
`pnpm db:backfill-review-subject-state`, da usare solo per recovery di DB
inconsistenti o upgrade legacy parziali.

A livello di prodotto:

- `/review` e la review globale reale, con dedup cross-media e daily limit globale;
- `/media/[mediaSlug]/review` resta una vista filtrata locale sul singolo media;
- dashboard e CTA globali devono mostrare numeri globali reali, mentre le
  superfici del media devono etichettare chiaramente i numeri locali del media.

Nel flusso sessione, la UI prova a mantenere il grading percepito come
istantaneo: il client prefetcha la card successiva quando possibile e, al click
su `Again/Hard/Good/Easy`, avanza in modo ottimistico mentre il server conferma
la mutazione in background. Se il submit fallisce, il client ripristina la card
precedente e mostra l'errore senza perdere il contesto della sessione.

Il contratto completo e le differenze intenzionali rispetto ad Anki sono in
[`docs/fsrs6-alignment.md`](./docs/fsrs6-alignment.md). In sintesi, la review
usa FSRS 6 a 21 pesi, giornata logica alle 04:00 `Europe/Rome`, learn-ahead di
20 minuti, fuzz/load balancing giornaliero Anki 25.07 e reschedule manuale. La
review globale, il dedup cross-media e la separazione recognition/concept
restano invarianti del prodotto.

Lo scheduler FSRS supporta anche parametri ottimizzati sui log reali. Il
training automatico vive fuori dal runtime interattivo dell'app: in produzione
Vercel Cron chiama ogni giorno `/api/internal/fsrs-optimizer/run`, protetta da
`CRON_SECRET`, e l'endpoint esegue lo stesso gate di
`pnpm fsrs:optimize:if-needed`. Il gate interno valuta ogni preset al massimo
una volta ogni `30` giorni e solo quando le sue review eleggibili nuove
raggiungono `min(3000, max(500, 25% dell'ultima valutazione))`. I watermark e
la readiness restano separati per `recognition` e `concept`, quindi un preset
con pochi dati, in errore o scaduto non blocca e non viene azzerato dal training
dell'altro. Se falliscono tutti i preset valutati, il run termina come fallito e
Settings mostra sia l'errore globale sia quello di ogni preset. Un dataset
ancora insufficiente viene riprovato dopo `7` giorni
senza avanzare il suo watermark; i run forzati ignorano questo cooldown. Le
dipendenze sono fissate a `ts-fsrs@5.2.3` e al binding optimizer `0.5.0` (FSRS
Rust `6.5.0`). Il dataset usa solo
prefissi il cui ultimo evento ha `deltaT > 0`, rispetta reset e study day, e
separa cronologicamente training e holdout. I nuovi pesi diventano attivi solo
se migliorano la log loss rispetto ai pesi correnti senza superare il guardrail
RMSE; altrimenti l'incumbent resta invariato. La pagina `/settings`
mostra in sola lettura lo stato corrente dell'optimizer, la soglia dinamica
corrente e i preset salvati in `user_setting`. Parametri e progressi vengono
committati nella stessa transazione; cache runtime e tag vengono invalidati una
sola volta, solo dopo il commit. `FSRS_OPTIMIZER_TRAINING_TIMEOUT_MS`
puo essere impostato per cambiare la deadline end-to-end per preset (lettura e
costruzione del ledger condiviso e del dataset, split, training e valutazione)
del training CLI/server;
altrimenti resta il default di `4000ms`. Il training nativo usa il `90%` del
budget residuo e lascia la coda finale alla restituzione dei pesi e alla
valutazione holdout. L'optimizer resta fuori dal percorso interattivo di
review: durante una sessione vengono letti soltanto i parametri gia attivi.

## Kanji Clash

`Kanji Clash` e un workspace separato dedicato alla discriminazione rapida tra
vocaboli che condividono almeno un kanji oppure differiscono per un singolo
kanji visivamente confondibile.

- route top-level `/kanji-clash` con item primario dedicato in navbar;
- scope globale di default, con filtro media solo quando `media=<slug>` e
  esplicito e valido;
- modalita `Automatico` e `Drill manuale` nello stesso workspace;
- memoria separata dalla review standard tramite `kanji_clash_pair_state` e
  `kanji_clash_pair_log`.

In v1 non cambia scheduling o log di `/review`, non include `grammar` nel pool
eleggibile e non usa doppioni editoriali o quasi-cloni per forzare nuove pair.
La source of truth tecnica e
[`docs/kanji-clash.md`](./docs/kanji-clash.md).

## Katakana Speed

`Katakana Speed` e il workspace top-level per allenare automaticita sui
katakana confondibili e sui chunk estesi piu frequenti.

- route `/katakana-speed`, `/katakana-speed/session/[sessionId]` e
  `/katakana-speed/recap/[sessionId]`;
- catalogo statico in TypeScript sotto `src/features/katakana-speed/`;
- persistenza runtime in tabelle `katakana_*`;
- registry operativo statico non-audio con chunk estesi, word bank,
  pseudoword, termini media/ad hoc, cluster di confusione, trap moraiche e loop
  daily/diagnostic/repair;
- drill choice focalizzati con primo trial inverso romaji -> katakana,
  selettore manuale per esercizio, raw choice moraiche, self-check timed per
  parole/pseudoparole e RAN Grid aggregata;
- nessuna integrazione con `/review`, media bundle o Kanji Clash.

La source of truth tecnica e
[`docs/katakana-speed.md`](./docs/katakana-speed.md).

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
da `nvm`; quando invece attiva `nvm`, forza il binario Node selezionato davanti
al resto del `PATH`.

Il runtime ufficialmente supportato resta `Node 22.x`. Gli script TypeScript
CLI del repo evitano dipendenze da flag rimossi in `Node 25`, quindi un lancio
accidentale fuori matrice non si rompe piu per `--experimental-default-type=module`,
ma la verifica canonica e il supporto restano ancorati a
`./scripts/with-node.sh pnpm ...`.

## Codex Locale In Sandbox

Il repository include una configurazione di progetto in `.codex/` pensata per
agenti Codex locali che lavorano in sandbox `workspace-write`.

Per classificare rapidamente un task prima di modificare file, parti dal
documento generato [`docs/agent-orientation.md`](./docs/agent-orientation.md).

Le skill Codex specifiche di questo repo vivono in `.agents/skills/`, che e il
percorso repo-scoped scansionato da Codex. Non mantenerne copie parallele in
`~/.codex/skills`: se serve compatibilita temporanea con un client vecchio, usa
symlink verso `.agents/skills` invece di duplicare i file.

I prompt locali non committati per automazioni o workflow manuali vivono in
`prompts/` e sono ignorati da git.

Passo iniziale consigliato per ogni nuovo worktree Codex:

```sh
.codex/scripts/setup-worktree.sh
```

Il bootstrap:

- installa le dipendenze del worktree con `./scripts/with-node.sh pnpm install --frozen-lockfile`;
- verifica la toolchain locale con `./scripts/tooling-doctor.sh`;
- installa i browser Playwright solo se la cache locale `~/Library/Caches/ms-playwright`
  non contiene ancora `chromium`, `firefox` e `webkit`.

La configurazione di progetto in `.codex/config.toml` assume che il sandbox
locale possa usare:

- `~/.nvm` oppure `/opt/homebrew/opt/nvm` per risolvere Node `22.x`;
- `~/Library/Caches/ms-playwright` per i browser Playwright;
- rete in sandbox, cosi un nuovo worktree puo eseguire `pnpm install` e,
  quando necessario, installare i browser Playwright mancanti.

Le action repo-shared consigliate per l'app Codex sono:

- `.codex/scripts/dev.sh`
- `.codex/scripts/check.sh`
- `.codex/scripts/release-check.sh`
- `.codex/scripts/test-e2e.sh`
- `.codex/scripts/db-setup.sh`
- `.codex/scripts/content-import.sh`

## Gate Di Verifica Locale

Per verificare il repository in modo completo, esegui il gate canonico:

```sh
./scripts/with-node.sh pnpm release:check
```

Il comando `release:check` copre l'intero set di controlli locali:

- lint
- typecheck
- test unit/integration
- preparazione di un DB SQLite locale dedicato in `.tmp/release-check/`
- build di produzione
- validazione contenuti su tutti i bundle reali presenti in `content/media`
- validazione completa dei corpus vendorizzati Pitch Accent, inclusi Kuuuube e
  Tofugu/Jaydar quando presenti
- E2E su browser Playwright di default

Anche se `.env.local` punta a un database Turso remoto, `release:check` forza
build ed E2E sul DB SQLite locale dedicato e disattiva la cache revalidation
remota del content import preparatorio.

## Source Of Truth Contenuti

Per contenuti editoriali, flashcard, glossary e handoff verso LLM esterni, la
source of truth del repository e' il filesystem versionato sotto
`content/media/**`.

Il DB SQLite locale di default (`./data/japanese-custom-study.db`) e' solo un
artefatto runtime di sviluppo: viene popolato da `db:seed` o `content:import`,
puo' essere cancellato e ricreato, e puo' non riflettere i Markdown correnti se
non e' stato reimportato. Non usarlo come inventario autorevole per decidere se
una card, entry o lesson esiste gia; usa i file in `content/media/**` e il
parser/validator. Il DB locale serve a far girare la webapp e le verifiche dopo
aver importato lo scope necessario.

## Script disponibili

```sh
pnpm dev
pnpm build
pnpm start
pnpm start:e2e
pnpm media-audio:sync
pnpm media-audio:check
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:all
pnpm test:fast
pnpm test:profile
pnpm test:real-bundle
pnpm test:ios-ops
pnpm test:watch
pnpm test:e2e:runner
pnpm test:e2e
pnpm check
pnpm release:check
pnpm file-size:check
pnpm agent:check
pnpm agent:verify
pnpm daily-kanji:test
pnpm app:progress-brief
pnpm docs:agent-orientation
pnpm docs:agent-orientation:check
pnpm content:validate
pnpm content:lookup
pnpm content:lookup-batch
pnpm content:entry-brief
pnpm content:entry-usage
pnpm content:lesson-brief
pnpm content:editorial-lint
pnpm content:lesson-workflow-check
pnpm content:scope
pnpm content:next-id
pnpm content:scaffold
pnpm content:import
pnpm content:test-stats
pnpm content:canary-diff
pnpm dm:card-fetch
pnpm dm:live-card-scaffold
pnpm dm:official-text-compare
pnpm db:generate
pnpm db:migrate
pnpm db:backfill-review-subject-state
pnpm db:seed
pnpm db:setup
pnpm db:studio
pnpm auth:hash-password
pnpm fsrs:optimize
pnpm fsrs:optimize:if-needed
pnpm pronunciations:resolve
pnpm pronunciations:resolve-entries
pnpm pronunciations:pending
pnpm pronunciations:reuse
pnpm forvo:preflight
pnpm pronunciations:forvo
pnpm pronunciations:forvo:request
pnpm pronunciations:forvo:import-requested
pnpm pronunciations:tofugu:sync
pnpm pitch-accents:fetch
pnpm pitch-accent:import-minimal-pairs
pnpm pitch-accent:generate-tofugu-pairs
pnpm pitch-accent:validate-corpus
pnpm pitch-accent:validate-tofugu-pairs
pnpm image:status
pnpm image:apply
pnpm kanji-clash:generate-similar-kanji
```

Se lanci direttamente `pnpm test:e2e:runner`, serve prima una build fresca:
il bootstrap E2E ora blocca l'avvio quando `.next` e piu vecchio dei file
applicativi per evitare falsi failure contro asset stale. Il percorso canonico
resta `./scripts/with-node.sh pnpm test:e2e`.

## Workflow pronunce

Per richieste del tipo "aggiungi le pronunce mancanti" il percorso standard non
parte piu dal low-level Forvo, ma dal resolver smart:

```sh
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media duel-masters-dm25
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/duel-masters-dm25/textbook/tcg-core-overview
./scripts/with-node.sh pnpm pronunciations:resolve-entries -- --media-slug duel-masters-dm25 --entry term-cost
```

Il resolver seleziona i target, esclude le entry gia coperte, prova il riuso
cross-media e manda il residuo al fetch Forvo Anki-style: helper Anki dedicato,
candidati audio estratti da `Play(...)`, ranking speaker, download diretto e
conversione OGG -> MP3 quando serve.

Ogni workflow che crea o modifica flashcard deve anche risolvere le pronunce
delle entry toccate: audio locale quando disponibile, altrimenti richiesta Forvo
`word-add` registrata. Una nuova card non va lasciata muta senza questo passaggio.

Gli audio delle pronunce restano sorgente versionata in
`content/media/<slug>/assets/audio/**`, ma a runtime vengono copiati nella
directory generata e ignorata `public/media-audio/<slug>/audio/**`. Dopo una run
reale che aggiunge o sostituisce audio locale, riallinea la copia statica con
questi comandi, salvo che il prossimo step sia gia
`./scripts/with-node.sh pnpm dev` o `./scripts/with-node.sh pnpm build`:

```sh
./scripts/with-node.sh pnpm media-audio:sync
./scripts/with-node.sh pnpm media-audio:check
```

`pnpm dev` e `pnpm build` eseguono gia il sync prima di Next. Review, glossary,
textbook e consolidation devono usare URL runtime `/media-audio/...` con
`?v=<updatedAt>` quando disponibile, non
`/media/[mediaSlug]/assets/audio/...`.

`pnpm pronunciations:forvo` resta disponibile come comando low-level per target
mirati del fetcher. Il recupero manuale va usato solo come extrema ratio per un
caso specifico in cui la logica Anki-style o l'import diretto falliscono. La
source of truth operativa e
[`docs/pronunciation-workflow.md`](./docs/pronunciation-workflow.md).

Per importare pronunce richieste su Forvo e poi soddisfatte da altri utenti,
usa `pnpm pronunciations:forvo:import-requested` con un indice audio estratto
dalla pagina account Forvo autenticata.

## Workflow pitch accent

Per backfill completi:

```sh
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug>
```

Per workflow editoriali che creano o modificano solo alcune flashcard, usa il
fetch mirato sulle entry appena toccate:

```sh
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry <term-or-grammar-id>
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --word 食べる --word 設定
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --words-file tmp/pitch-accent-targets.tsv
```

La procedura dettagliata e in
[`docs/pitch-accent-workflow.md`](./docs/pitch-accent-workflow.md).

Il training `/pitch-accent` usa corpus statici sotto `public/vendor/`. Il
corpus base Kuuuube si aggiorna con:

```sh
./scripts/with-node.sh pnpm pitch-accent:import-minimal-pairs
./scripts/with-node.sh pnpm pitch-accent:validate-corpus
```

Il corpus aggiuntivo Tofugu/Jaydar richiede prima un export Jaydar completo
degli omofoni per tutte le reading Tofugu candidate:

```sh
./scripts/with-node.sh pnpm pitch-accent:generate-tofugu-pairs -- --jaydar-export tmp/jaydar-tofugu-homophones.jsonl
./scripts/with-node.sh pnpm pitch-accent:validate-tofugu-pairs -- --kuuuube-manifest public/vendor/minimal-pairs/manifest.json
```

La procedura e i vincoli dell'export Jaydar sono documentati in
[`docs/pitch-accent-minimal-pairs.md`](./docs/pitch-accent-minimal-pairs.md).

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

Il file SQLite locale e' disposable: trattalo come cache di sviluppo derivata
da migrazioni + import contenuti, non come sorgente primaria. Se il contenuto in
`content/media/**` e il DB locale divergono, il Markdown validato vince;
riallinea il DB con `content:import` o `db:setup` nello scope appropriato.

Se `DATABASE_URL` punta a un database remoto `libsql://...`, il runtime usa il
client remoto standard direttamente. Non usiamo piu embedded replica locali ne
sync automatiche al bootstrap, cosi il comportamento resta coerente tra locale,
CLI e deploy serverless e non consuma quota `Syncs` extra su Turso.

`pnpm db:seed` importa il contenuto reale presente in `./content`, riallinea il
DB ai media correnti e rimuove eventuali residui legacy non piu presenti nel
workspace. L'importer esegue parser + validazione prima di sincronizzare il DB;
puoi passare una content root diversa con
`pnpm content:import -- --content-root /percorso/content`.
Regola generale: minimizza lo scope dell'import. Usa sempre
`--media-slug <media-slug> --lesson-slug <lesson-slug>` quando hai toccato solo
una o piu route textbook note dello stesso media; ripeti `--lesson-slug` per
piu lesson. Usa il solo `--media-slug` quando il cambio e' media-wide o deve
applicare archive/prune oltre alle lesson note. Usa l'import full solo per setup,
recovery o riallineamenti intenzionali dell'intera content root.

Dettagli operativi e schema: [Persistence layer](./docs/database.md)

## Variabili Ambiente

Il setup locale non richiede variabili obbligatorie a runtime, ma
[.env.example](./.env.example) documenta i path locali supportati dal setup.

Per un deploy pubblico conviene invece impostare almeno:

- `DATABASE_URL` verso un database `libsql://...` remoto oppure un path locale
  solo se l'hosting garantisce persistenza del filesystem;
- `DATABASE_AUTH_TOKEN` oppure `LIBSQL_AUTH_TOKEN` se il provider `libsql`
  richiede un token;
- `CRON_SECRET` per proteggere l'endpoint Vercel Cron dell'optimizer FSRS;
- `AUTH_USERNAME`, `AUTH_SESSION_SECRET` e una tra `AUTH_PASSWORD_HASH` o
  `AUTH_PASSWORD` per attivare il login minimale dell'app.

Se nessuna variabile `AUTH_*` e configurata, l'app resta aperta. Se ne imposti
solo una parte, l'avvio fallisce apposta per evitare deploy pubblici esposti per
errore.

Per generare un hash password PBKDF2 senza dipendenze extra:

```sh
./scripts/with-node.sh pnpm auth:hash-password -- "scegli-una-password"
```

La password deve arrivare al comando come un singolo argomento: se contiene
spazi, lascia le virgolette.

Poi usa l'output come valore di `AUTH_PASSWORD_HASH`.
Se lo incolli dentro un file `.env*`, ricordati di fare escape dei simboli
`$` come `\$`, altrimenti Next prova a espanderli e l'hash risulta troncato.

## Deploy Free Consigliato

Stack minimo consigliato per esporla su internet spendendo zero:

- hosting `Vercel Hobby` per la webapp `Next.js`;
- database remoto `Turso` sul free tier `libsql`;
- auth nativa di questa app tramite le variabili `AUTH_*`.

Questo evita di affidarsi a filesystem effimeri del provider e tiene il setup
coerente con `@libsql/client` gia presente nel repo.

Con questo setup, il bootstrap del server usa direttamente Turso come database
remoto e non crea repliche locali o sync extra. Il warm-up delle cache piu
costose parte solo in background dopo l'avvio del runtime: e best-effort e non
blocca la prima risposta del sito, cosi il cold start Vercel non paga in
anticipo l'intera preparazione della review.

Il database Turso di produzione risiede in `eu-west-1`; `vercel.json` fissa
quindi l'unica regione Functions Hobby a `dub1` (Dublino). Mantieni compute e
database co-localizzati: rimuovere questa impostazione riporterebbe le Functions
al default Vercel `iad1` e aggiungerebbe un roundtrip transatlantico a ogni
lettura o grade server-side.

Per le notifiche live di Daily Kanji iOS, il monitor GitHub near-real-time e
sospeso finche APNs/notifiche non sono affidabili. Il workflow resta disponibile
solo come avvio manuale con `workflow_dispatch`:
[`.github/workflows/mobile-review-notifications.yml`](./.github/workflows/mobile-review-notifications.yml).
Il volume corrente deve quindi restare a `0 chiamate automatiche` verso Vercel.
Se il monitor verra riattivato, non usare Vercel Hobby Cron per tick ravvicinati
e mantieni una cadenza gratuita GitHub Actions di `5` minuti solo dopo una
revisione esplicita: quella cadenza vale circa `288` chiamate al giorno e
`8.640` al mese. Il server deve tenerla a una singola due-count check Turso per
run. Endpoint e secret vivono solo nei secret Actions
`MOBILE_REVIEW_NOTIFICATION_MONITOR_URL` e
`MOBILE_NOTIFICATION_MONITOR_SECRET`; secret APNs/mobile/monitor e token Turso
non devono mai essere committati. Se i secret monitor non sono ancora
configurati, la workflow manuale deve fare skip con successo invece di fallire.
Riferimenti:
[Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
e [GitHub Actions workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions).

## Backup schedulato del database

Il repository include anche un backup automatico del database remoto Turso via
GitHub Actions: [`.github/workflows/backup-turso-daily.yml`](./.github/workflows/backup-turso-daily.yml).

Comportamento attuale:

- backup giornaliero alle `02:15 UTC`;
- avvio manuale possibile da `Actions > Backup Turso Database > Run workflow`;
- export del DB remoto, conversione in un file SQLite compatto
  `japanese-custom-study.backup.db`;
- verifica con `PRAGMA integrity_check`;
- upload come artifact GitHub con retention di `90` giorni.

Ogni artifact contiene:

- `japanese-custom-study.backup.db`
- `metadata.json`
- `integrity-check.txt`
- `SHA256SUMS`
- `restore.txt`

Per ripristinare un backup su un nuovo database Turso:

```sh
turso db create <new-database-name> --from-file ./japanese-custom-study.backup.db -w
```

Per consultarlo localmente:

```sh
sqlite3 ./japanese-custom-study.backup.db 'select count(*) from media;'
```

Il workflow usa il secret GitHub `TURSO_PLATFORM_API_TOKEN` per autenticare la
CLI Turso in modo non interattivo. I secret usati dal runtime applicativo
restano separati.

## Struttura repo

```text
src/
  app/
    api/
    consolidation/
    glossary/
    kanji-clash/
    katakana-speed/
    login/
    media/
    pitch-accent/
    review/
    settings/
  actions/
  components/
    auth/
    consolidation/
    dashboard/
    glossary/
    kanji-clash/
    katakana-speed/
    layout/
    media/
    pitch-accent/
    review/
    settings/
    textbook/
    ui/
  db/
    queries/
    schema/
  features/
    auth/
    cache/
    consolidation/
    content/
    dashboard/
    fsrs-optimizer/
    glossary/
    image-workflow/
    kanji-clash/
    katakana-speed/
    media/
    navigation/
    pitch-accent/
    progress/
    pronunciation/
    review/
    security/
    settings/
    shared/
    study/
    textbook/
  styles/
.agents/
  skills/
content/
  media/
    <media-slug>/
      assets/
tests/
scripts/
docs/
prompts/
```

## Documenti

Per workflow con LLM esterni, il punto di partenza operativo e
[`docs/llm-kit/README.md`](./docs/llm-kit/README.md).

- [Blueprint operativo](./docs/blueprint-operativo.md)
- [Persistence layer](./docs/database.md)
- [Specifica contenuti Markdown](./docs/content-format.md)
- [Standard stile lesson textbook](./docs/llm-kit/general/10-textbook-lesson-style-standard.md)
- [Content parser e validator](./docs/content-parser.md)
- [Importer sync strategy](./docs/importer-sync-strategy.md)
- [Kanji Clash](./docs/kanji-clash.md) - contratto tecnico e guardrail editoriali della feature
- [Katakana Speed](./docs/katakana-speed.md) - workspace drill katakana persistito
- [Checklist QA manuale](./docs/qa-manual-checklist.md)
- [Note di verifica locale](./docs/local-verification-notes.md)
- [Kit operativo LLM esterni (source of truth)](./docs/llm-kit/README.md)
- [Tooling locale](./docs/dev-tooling.md)
- [Direzione UX/UI](./docs/design/ux-ui-direction.md)
- [Design tokens](./docs/design/design-tokens.css)
- [Wireframes](./docs/design/wireframes.md)

## Convenzioni UI

- Lo shell usa una top bar editoriale su desktop; su mobile la stessa
  navigazione primaria diventa una griglia compatta sotto il brand, non una
  bottom navigation separata.
- I pattern base riusabili vivono in `src/components/ui` e
  `src/components/layout`; lo shell globale e in `src/components/site-shell*.tsx`.
- Dashboard, library, media detail e progress leggono il DB tramite loader
  server-side in `src/features/dashboard/server`, `src/features/media/server`
  e `src/features/progress/server`; i formatter e helper puri condivisi vivono
  in `src/features/study/model`.

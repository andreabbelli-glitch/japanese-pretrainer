# Note Di Verifica Locale

Questo documento riassume i controlli locali e i limiti noti ancora utili come
promemoria operativo. Non rappresenta un sign-off di completezza del prodotto e
non sostituisce un audit completo e aggiornato del codice.

## Copertura Attuale Dei Controlli

- Vitest e partizionato in corsie disgiunte: `test:fast` per la suite core,
  `test:real-bundle` per i canary reali e `test:ios-ops` per i contratti
  operativi Daily Kanji. `test`, `test:all` e quindi `check` continuano a
  eseguire l'aggregato completo.
- Per modifiche sotto `apps/daily-kanji-ios/**`, `agent:verify` indica sia
  `test:ios-ops` sia il gate XCTest canonico `daily-kanji:test`.
- Suite E2E minima con Playwright su DB dedicato e import reale dell'intero workspace `content/`.
- I test unit/integration ordinari di parser, validator e importer usano fixture
  sintetiche versionate o generate in `tests/helpers/content-fixtures.ts`; il
  bundle reale `duel-masters-dm25` resta coperto solo dal canary esplicito
  `tests/content-real-bundle-canary.test.ts`, richiamabile insieme al workflow
  CLI delle statistiche con `./scripts/with-node.sh pnpm test:real-bundle`, che
  confronta invarianti generali e statistiche aggregate.
- Per le slice editoriali Duel Masters, `content:canary-diff` mostra i delta
  parser/importer rispetto alle statistiche versionate prima di aggiornare la
  fixture con `content:test-stats -- --write`; `content:test-stats --
  --accept-failure` serve solo per diagnosi read-only di bundle ancora invalidi.
- Copertura dei flussi chiave: dashboard, media detail, textbook reader, tooltip, lightbox immagini, glossary, review, progress, settings.
- Copertura dedicata di `Kanji Clash` su `/kanji-clash` con filtro media,
  sessione manuale e interazioni click/tastiera/touch.
- Copertura dedicata di `Pitch Accent` su `/pitch-accent` con avvio sessione,
  asset audio vendor verificato via HTTP, replay stubbed, risposta, recap
  persistito e smoke dei filtri salvati nel DB E2E.
- Smoke parametrica sulle route chiave di ogni media attivo presente in `content/media`.
- Verifica mobile del reader con sheet touch per termini e rail lesson.
- Le immagini del textbook restano plain media: click/tap apre il lightbox
  anche in presenza di `card_id` legacy nei bundle storici.
- `/review` come workspace globale; `/media/[mediaSlug]/review` come filtro
  verticale sullo stesso sistema.
- Root `/review` deve avere uno stato vuoto dedicato per il primo avvio, non un
  redirect verso una review locale o un copy che parli di un singolo media.
- Loading state contestuali per glossary, textbook, lesson, review, progress e settings.
- `Kanji Clash` resta un workspace separato da `/review`, con pair state e log
  dedicati e senza mutazioni laterali sulla review standard.
- La Review puo` pero` forzare l'ingresso di un contrasto in `Kanji Clash`
  tramite `+ Contrasto`, senza mischiare queue e log dei due workspace.
- `Kanji Clash` puo` ammettere coppie sia per `shared-kanji` sia per
  `similar-kanji`, mantenendo la pair key unica quando una coppia passa
  entrambe le route.
- I `forced manual contrast` possono includere anche subject fuori dal pool
  automatico, purche` materializzabili come round Kanji Clash.
- I `forced manual contrast` hanno una chiave unordered di contrasto ma due
  round direzionali distinti.
- `Kanji Clash` esclude correttamente same-entry, same-group, same-surface ed
  editorial-clone dal pool eligibile.
- `Kanji Clash` esclude anche i `qualified-contained-clone`, dove una forma
  breve e` gia il nucleo visivo dell'altra e la parte extra e` solo un
  qualificatore corto.
- `Kanji Clash` esclude anche i `shared-lexical-core`, dove due forme
  riusano la stessa testa lessicale o la stessa derivazione mista kanji+kana
  con modificatori brevi, ma non elimina contrasti reali come `一番上` vs
  `一番下`.
- `Kanji Clash` esclude anche i `shared-contextual-prefix`, dove due forme
  condividono lo stesso contesto frasale iniziale ma confrontano poi due code
  sostanziali incompatibili come `山札の上から1枚目` vs `山札の一番下`.
- `Kanji Clash` esclude anche i `contextualized-head-family`, dove una forma
  contestualizzata `XのY` viene confrontata con una forma piu` nuda della
  stessa famiglia, come `山札の一番下` vs `一番上`.
- `Kanji Clash` esclude anche i `cross-edge-mixed-stem`, dove uno stesso stem
  misto kanji+kana compare all'inizio di una forma e alla fine dell'altra con
  solo piccoli modificatori ai bordi, come `受け取る` vs `一括受け取り`.
- `Kanji Clash` esclude anche i `same-kanji-core-reading`, dove due forme
  tengono fermo lo stesso blocco kanji sullo stesso bordo, cambiano solo per
  kana circostanti e non cambiano la lettura del blocco stesso, come
  `ランク戦` vs `ストラテジー戦` o `行く` vs `行こう`.
- Messaggio di errore comprensibile in `content:import` quando il DB target non è migrato.

## Comportamenti Da Verificare

- La nav review globale e la CTA review della dashboard portano al workspace
  review globale, mentre dal media detail resta disponibile il filtro verticale.
- `Kanji Clash` apre da navbar e CTA dedicate, ma non rimpiazza la queue di
  `/review`; gli ingressi devono restare espliciti e distinti.
- `Kanji Clash` in scope media deve attivarsi solo con `media=<slug>` valido;
  se manca uno slug esplicito, il runtime deve restare su scope globale anche
  quando il default setting e` `media`.
- Una sessione manuale `Kanji Clash` completata deve offrire un top-up di `+10`
  round nello stesso scope, senza perdere il filtro media corrente.
- Il pool `Kanji Clash` deve includere solo `term` gia consolidati nella review
  reale (`review` o `relearning`, `stability >= 7`, `reps >= 2`), escludendo
  `grammar`, `new`, `learning`, `known_manual` e `suspended`.
- Il pool `Kanji Clash` deve scartare anche card driver non lessicali: front
  solo kana, frammenti con particelle o punteggiatura (`山札の一番下`,
  `ターンを追加する`, `どの ポケモンに 使いますか？`) e compound con prefisso
  leggero in kana/katakana (`カード交換`, `おすすめ編成`) o coda katakana
  (`進化クリーチャー`, `タップ状態`).
- Le coppie `similar-kanji` devono usare solo uno swap singolo ammesso dal
  dataset versionato, con stessa lunghezza e resto della superficie identico.
- La sessione `Kanji Clash` non deve ripresentare la stessa pair key nella
  stessa run, anche con lati invertiti o target invertito.
- Un `forced manual contrast` deve invece poter mostrare entrambe le direzioni
  nella stessa sessione, una per target.
- Una risposta corretta in `Kanji Clash` deve avanzare al round successivo
  senza pannello verde inline, senza timer artificiale e senza micro-scroll del
  viewport.
- In caso di errore in `Kanji Clash`, la UI deve mostrare la soluzione corretta
  e fermarsi finche l'utente non conferma `Continua`.
- Una sessione `Kanji Clash` non deve cambiare queue, log o contatori
  giornalieri della review standard.
- Una sessione `Pitch Accent` non deve cambiare queue, log o contatori
  giornalieri della review standard, e non deve scrivere in `content/media`.
- I vendor corpus Pitch Accent devono restare validabili con
  `./scripts/with-node.sh pnpm pitch-accent:validate-corpus` e
  `./scripts/with-node.sh pnpm pitch-accent:validate-tofugu-pairs`; manifest,
  `NOTICE.md`, audit/licenze e audio statici devono essere coerenti.
- Con un contrasto selezionato in Review, grading e inserimento in `Kanji
  Clash` devono essere transazionali: se l'upsert fallisce, la Review non deve
  avanzare silenziosamente.
- Un contrasto manuale archiviato non deve ricomparire ne dalla queue manuale
  ne come candidate automatico equivalente; restore o riselezione dalla Review
  devono riportarlo `due-now` in entrambe le direzioni.
- Il daily limit della review è globale e la coda mostra fusioni cross-media
  quando la stessa superficie grafica di un termine o pattern è condivisa tra
  più media.
- Il glossary è globale: le CTA locali dei media devono portare a
  `/glossary?media=<slug>`, mentre `/media/[mediaSlug]/glossary` deve risultare
  non disponibile e non deve essere interpretato come contesto Glossary da nav
  o `returnTo`.
- Su DB già esistenti, il comportamento della review deve restare compatibile
  con lo storico legacy: la migrazione deve preservare i soggetti già introdotti
  e non deve far ricomparire card già contate nel limite giornaliero.
- La migrazione SQL `0011_global_review_subjects.sql` non fa backfill da sola:
  il percorso normale e` `pnpm content:import`, che crea e riallinea
  `review_subject_state` durante il sync. `pnpm db:backfill-review-subject-state`
  resta solo una rete di sicurezza manuale per DB parzialmente migrati o
  subject-level state mancanti.
- Nel fallback legacy, una sibling `suspended` o `known_manual` non deve mai
  diventare representative subject se esiste una sibling attiva.
- Dashboard e CTA globali devono usare numeri globali reali; progress e media
  detail possono mostrare anche numeri locali, ma devono etichettarli come
  `Review del media` o equivalente, senza presentarli come globali.
- Le schermate di studio secondarie non ereditano più il loading generico “Caricamento media”, ma comunicano cosa si sta preparando.
- `content:import` non esplode più con stacktrace SQL opaco quando manca lo schema: ora indica di eseguire `db:migrate`.
- `pronunciations:resolve -- --mode review|next-lesson|lesson-url|targeted --dry-run`
  seleziona i target attesi, esclude le entry gia coperte, prova riuso
  cross-media e dataset Tofugu/WaniKani se gia presente, ma non scarica o copia
  file.
- Gli audio locali delle pronunce devono essere serviti da `/media-audio/...`,
  non dalla route dinamica `/media/[mediaSlug]/assets/audio/...`. Dopo una run
  che aggiunge o sostituisce audio, `./scripts/with-node.sh pnpm media-audio:sync`
  riallinea `public/media-audio/`, salvo che il prossimo step sia gia
  `./scripts/with-node.sh pnpm dev` o `./scripts/with-node.sh pnpm build`;
  `./scripts/with-node.sh pnpm media-audio:check` segnala copie mancanti, stale
  o extra. In Network, review e consolidation devono mostrare `Cache-Control:
  public, max-age=31536000, immutable` sugli audio statici.
- Le voci gia marcate come `known missing` restano eleggibili per riuso
  cross-media e Tofugu/WaniKani; vengono escluse solo dal passaggio Forvo.
- Aggiungendo `--retry-known-missing` allo stesso comando, quelle entry
  tornano eleggibili per il fetch Forvo Anki-style o, se ancora assenti su Forvo,
  per la richiesta `word-add` registrata.
- Dopo una run reale che trova audio, `data/forvo-requested-word-add.json`
  mantiene lo storico delle richieste ma marca come `resolved` le entry ormai
  coperte.
- Settings mostra anche lo stato read-only dell'optimizer FSRS, inclusi ultimo
  training riuscito, review nuove accumulate e stato dei preset `recognition` /
  `concept`.
- La giornata review cambia alle 04:00 `Europe/Rome`: i test manuali vicino al
  rollover e ai cambi DST non devono anticipare/posticipare il giorno per una
  divisione fissa di 24 ore.
- Le card learning/relearning possono rientrare nella stessa sessione. Il
  learn-ahead arriva al massimo a 20 minuti e solo a coda ordinaria vuota; non
  deve avviare polling o una ricostruzione completa dopo ogni risposta.
- La preview di riallineamento FSRS in Settings e on-demand. Una visita normale
  a `/settings` non deve rileggere la cronologia completa.
- Il media `web-giapponese` resta navigabile come `Giapponese random` nelle
  route principali, con lesson reali e senza contenuti bootstrap residui.

## Comando E2E

`./scripts/with-node.sh pnpm test:e2e`

Il comando costruisce l'app, prepara un DB E2E temporaneo, importa tutti i
bundle reali presenti in `content/` e avvia un server locale su porta `3100`
per la suite.

Se ti serve invocare direttamente `./scripts/with-node.sh pnpm test:e2e:runner`
su una subset, assicurati prima di avere una build fresca. `start:e2e` rifiuta
di partire se `.next/BUILD_ID` e piu vecchio dei file applicativi rilevanti, in
modo da evitare falsi failure Playwright contro una build production stale.

Quando il comando gira da un worktree Codex locale in sandbox, il setup del
worktree deve avere gia eseguito `.codex/scripts/setup-worktree.sh` e il profilo
di sandbox deve poter usare `nvm` e la cache browser Playwright fuori dal repo.

Su questo repository il blocco noto del sandbox puo impedire l'avvio dei browser
Playwright su macOS. Se `release:check` o il runner E2E arrivano a Playwright
ma il browser non parte per limiti del sandbox, segnala esplicitamente che gli
E2E browser non sono eseguibili in quell'ambiente e completa il resto delle
verifiche disponibili.

## Daily Kanji iOS

La app iOS privata + WidgetKit vive in `apps/daily-kanji-ios/`. Non fa parte del
gate applicativo Next.js quando si tocca solo Swift/UI iOS, ma va verificata con
Xcode quando cambiano progetto, signing, widget o risorse native.

La milestone smart-sync usa l'App Group `group.dev.local.daily-kanji`: l'app
scarica il JSON privato e lo scrive nella cache condivisa, mentre il widget resta
senza rete e legge cache condivisa -> bundle packaged -> sample. Il token di
sync va trattato come segreto: non e' committato, ma un'IPA buildata con token
configurato lo contiene nei build setting espansi.

Comandi locali:

```sh
cd apps/daily-kanji-ios
./scripts/doctor.sh
xcodegen generate
./scripts/package-ipa.sh
```

Il Mac deve puntare a `/Applications/Xcode.app/Contents/Developer`, non a
Command Line Tools. Se manca Xcode completo, la build iOS resta bloccata e va
segnalata come limite concreto della verifica.

Per validare il percorso che registra davvero il widget su iPhone fisico:

```sh
cd apps/daily-kanji-ios
./scripts/xcode-renew.sh
```

Su questo setup il rinnovo da CLI e' stato verificato via CoreDevice anche senza
cavo quando l'iPhone risulta `transportType: localNetwork`. Sideloadly rimane
diagnostico: installa la app principale, ma non registra la WidgetKit extension
nella gallery widget.

### Monitor Review Live

La near-real-time push per le review mobile e sospesa finche APNs/notifiche non
sono affidabili. Il workflow
[`.github/workflows/mobile-review-notifications.yml`](../.github/workflows/mobile-review-notifications.yml)
resta manuale tramite `workflow_dispatch`: non deve avere una schedule attiva e
deve produrre `0 chiamate automatiche` verso Vercel. Quando viene lanciato a
mano, esegue un `POST` verso l'endpoint protetto configurato dai secret
`MOBILE_REVIEW_NOTIFICATION_MONITOR_URL` e
`MOBILE_NOTIFICATION_MONITOR_SECRET`.

Questa scelta e intenzionale per restare dentro i piani gratuiti: Vercel Hobby
Cron non viene usato per push near-real-time, perche i limiti/costi vanno
considerati dalla documentazione ufficiale
<https://vercel.com/docs/cron-jobs/usage-and-pricing>. La sintassi della
schedule GitHub Actions segue
<https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions>.
Se il monitor verra riattivato, una cadenza di `5` minuti produce circa `288`
chiamate al giorno e `8.640` al mese; non aumentarla senza rivalutare
esplicitamente quota Actions, costo Vercel e carico Turso.

Il monitor deve restare minuscolo: nessun setup Node, nessuna credenziale DB,
nessuna credenziale APNs e nessuna logica di review nel workflow. Il lavoro
server-side dietro l'endpoint deve fare una sola due-count check Turso per run
e inviare push solo se serve. Secret APNs/mobile/monitor e token Turso non
devono mai essere committati.

Il rinnovo automatico launchd usa un plist persistente con `RunAtLoad` e
`StartInterval=14400`: esegue un check al caricamento/login e ogni 4 ore. Il
wrapper legge la scadenza minima dei provisioning profile embedded registrata
in `~/Library/Application Support/DailyKanji/profile-expiry.epoch`. Prima delle
ultime 48 ore (`RENEW_BEFORE_EXPIRY_SECONDS=172800`) esce senza lock,
CoreDevice, package o Xcode; una scadenza mancante o corrotta richiede invece un
tentativo.

Nella finestra preventiva il wrapper preflighta CoreDevice e Developer Disk
Image, esegue il package dalla root del repo e usa `xcode-renew.sh` con build
fisica `Release` di default. Device offline/bloccato, DDI, package, signing,
build, install o profili invalidi producono exit non-zero. Il job non riscrive
il proprio plist e non crea child process: il successivo `StartInterval`
fornisce il retry. Dopo un install riuscito, `xcode-renew.sh` registra
atomicamente la scadenza minima tra app e widget leggendo gli
`embedded.mobileprovision`. Solo una scadenza valida, successiva alla precedente
e oltre la finestra preventiva aggiorna
`~/Library/Application Support/DailyKanji/last-renew-success.epoch`; le opzioni
legacy `--mark-success-now` e `--reschedule-only` non creano successi sintetici.
L'installer mantiene un backup del plist precedente fino al bootstrap del nuovo:
se il bootstrap fallisce, ripristina il file precedente e tenta di ricaricarlo,
ma restituisce comunque l'exit code originale dell'installazione fallita.
I log unattended sono in
`~/Library/Logs/DailyKanji/xcode-renew.out.log` e
`~/Library/Logs/DailyKanji/xcode-renew.err.log`.

Installazione/migrazione e diagnosi:

```sh
cd apps/daily-kanji-ios
DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh
./scripts/xcode-renew-if-needed.sh --status
./scripts/xcode-renew-if-needed.sh --force
```

Se il rinnovo fallisce con `No Accounts`, `No profiles` o errori di provisioning,
aprire Xcode Settings > Accounts, verificare il Personal Team, aprire
`apps/daily-kanji-ios/DailyKanji.xcodeproj` e lasciare Xcode rigenerare i profili
per `dev.local.daily-kanji` e `dev.local.daily-kanji.widget`.

Per abilitare la sync dataset runtime privata nella build locale, imposta questi
build setting in Xcode o passali a `xcodebuild`/script wrapper:

```sh
DAILY_KANJI_IOS_SYNC_ENDPOINT=https://<deployment>/api/daily-kanji/ios-dataset
DAILY_KANJI_IOS_SYNC_TOKEN=<secret>
```

Per abilitare la review live nativa, configura separatamente:

```sh
MOBILE_API_ENDPOINT=https://<deployment>
MOBILE_API_TOKEN=<secret>
```

Se i valori dataset restano assenti o placeholder, l'app continua a funzionare
con cache o bundle locale e mostra `Sync non configurato`; il widget continua a
leggere solo la cache cards-only condivisa o il bundle cards-only. Se i valori
`MOBILE_API_*` restano assenti o placeholder, la review live mostra
`Live review non configurata` e non abilita grading nativo. La richiesta
permesso notifiche viene fatta solo quando
`MOBILE_API_*` e' configurato e la build e' firmata con entitlement
`aps-environment`. Le build Personal Team usano il default senza push; imposta
`DAILY_KANJI_ENABLE_APNS=1` solo con un Apple Developer team/provisioning che
supporta Push Notifications. La widget extension resta senza push e senza rete.

Per aggiornare lo snapshot offline e gli audio packaged usati dall'app iOS:

```sh
./scripts/with-node.sh pnpm daily-kanji:package
```

Il comando scrive `apps/daily-kanji-ios/App/Resources/daily-kanji-cards.json`,
`apps/daily-kanji-ios/App/Resources/Audio/` e la proiezione cards-only
`apps/daily-kanji-ios/WidgetExtension/Resources/daily-kanji-widget-cards.json`,
poi esegue
`daily-kanji:verify-resources`. I due workflow iOS `scripts/package-ipa.sh` e
`scripts/xcode-renew.sh` rieseguono lo stesso verifier prima di `xcodegen
generate`, cosi' una build/install viene bloccata se il bundle contiene ancora
la card sample, un dataset stale, audio referenziati ma non packaged, oppure una
proiezione widget assente, divergente o contenente il glossary. Le risorse sono
ignorate da git perche' contengono stato personale derivato dal DB runtime e
copie audio generate. Xcode include dataset completo e audio solo nel bundle
app; il bundle widget riceve esclusivamente il JSON cards-only, senza glossary o
audio duplicati. Gli audio in formati non riproducibili dal
runtime iOS, per esempio OGG, vengono segnalati come skipped e non abilitano il
pulsante audio nell'app. Per una build intenzionalmente stale usa
`DAILY_KANJI_ALLOW_STALE_RESOURCES=1`, evitando di renderlo il default.

## Gate Canonico Di Verifica

Per eseguire il controllo locale piu completo:

`./scripts/with-node.sh pnpm release:check`

Il gate canonico copre nell'ordine:

- `pnpm check` per lint, typecheck e test unit/integration;
- preparazione di un DB SQLite locale dedicato in `.tmp/release-check/`, con
  migrazioni e `pnpm content:import` completo;
- `pnpm build`;
- `pnpm pitch-accent:validate-corpus`;
- `pnpm pitch-accent:validate-tofugu-pairs`;
- runner E2E Playwright sul setup locale dedicato.

Il full `content:import` esegue il parse e la validazione di tutti i bundle
prima della sync e propaga le issue come import fallito. Il gate non ripete
quindi `content:validate` dopo l'import; il comando resta disponibile come
preflight editoriale standalone e nei workflow content-only mirati.

Il DB locale del release gate viene passato esplicitamente come `DATABASE_URL` e
`E2E_DATABASE_URL`, con `DATABASE_AUTH_TOKEN`, `LIBSQL_AUTH_TOKEN` e le variabili
di cache revalidation svuotate, per evitare letture o invalidazioni Turso quando
`.env.local` contiene credenziali remote.

Il sign-off locale resta valido solo sul runtime supportato del repo, cioe
`Node 22.x` risolto tramite `./scripts/with-node.sh`. Gli script CLI
TypeScript evitano ormai il flag obsoleto `--experimental-default-type=module`,
quindi un'esecuzione sotto `Node 25` non dovrebbe piu rompersi per quel motivo
specifico, ma non conta come matrice ufficiale di verifica.

## Limiti Residui

- La suite E2E è intenzionalmente piccola: copre i flussi ad alto valore, non ogni variante di filtro o ogni card.
- La suite E2E Pitch Accent copre il flow principale e uno smoke filtri, non
  ogni combinazione di pattern o modifier audio.
- I flussi E2E restano concentrati sul media di focus per textbook; per review
  conviene coprire sia il workspace globale sia il filtro verticale sul media.
- `Kanji Clash` ha una suite E2E mirata, ma resta focalizzata sul round flow
  principale: filtro media, click, tastiera, swipe, errore con stop e dedupe.
- Se la feature `forced manual contrast` e` attiva, la verifica locale utile
  include anche il passaggio Review -> `+ Contrasto` -> selezione glossary ->
  grading -> presenza dei due round direzionali in `Kanji Clash`.
- La doc di `Kanji Clash` deve restare allineata ai guardrail editoriali: niente
  duplicati creati solo per aumentare le coppie candidabili.
- Il primo avvio di `/review` va controllato anche senza media importati, per
  verificare che l'empty state dedicato non sembri una review locale vuota.
- Le performance sono verificate solo a livello locale/percepito, non con budget automatizzati.
- Il prodotto resta single-user e locale-first; non include hardening per esposizione remota.
- Il training automatico FSRS in produzione dipende da Vercel Cron, configurato
  in `vercel.json` sulla route `/api/internal/fsrs-optimizer/run`. La route
  richiede `CRON_SECRET` e usa il `DATABASE_URL` remoto del runtime. In locale lo
  stesso gate puo essere verificato con
  `./scripts/with-node.sh pnpm fsrs:optimize:if-needed`.
- I workflow GitHub che toccano Turso remoto sono volutamente limitati: il sync
  automatico su `main` copre migrazioni, relativi backfill in
  `src/db/backfills/**` e import `content/media/**` incrementali per slug,
  mentre il backup `turso db export` resta manuale per evitare consumi
  improvvisi della quota `Rows Read`.

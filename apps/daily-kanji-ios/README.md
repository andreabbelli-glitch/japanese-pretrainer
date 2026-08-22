# Daily Kanji iOS

App iOS privata e monoutente per mostrare sul widget flashcard con kanji che
vale la pena rinforzare passivamente. Il progetto evolve lo spike WidgetKit gia
validato su questo Mac, ma da questa milestone non e' piu trattato come spike:
nome app, bundle id, scheme e documentazione sono quelli di **Daily Kanji**.

## Stato attuale

- App SwiftUI + estensione WidgetKit iOS.
- Target unit test iOS per modello dataset, ranking, storico e deep link.
- Progetto Xcode generato da XcodeGen (`project.yml`).
- Bundle app: `dev.local.daily-kanji`.
- Bundle widget: `dev.local.daily-kanji.widget`.
- Signing automatico con Apple Developer team `F5U46464YH`.
- Installazione app + widget validata via CoreDevice su iPhone fisico, anche
  senza cavo quando il device e' visibile come `transportType: localNetwork`.
- Sideloadly resta solo diagnostico: su questo setup installa la app principale
  ma non registra la WidgetKit extension nella gallery widget.

La app legge il dataset completo `daily-kanji-cards.json`; il widget riceve
invece `daily-kanji-widget-cards.json`, una proiezione cards-only dello stesso
export senza glossary; il target widget non include gli asset audio. Se il file
dedicato non e' presente usa un sample locale (`学`) per mantenere build e
preview funzionanti. Lo storico locale conserva le esposizioni effettive della
sezione Daily (inclusi rientri e deep link) e gli slot dei timeline pianificati
dall'estensione WidgetKit negli ultimi 3 giorni, anche quando la stessa card
viene mostrata piu volte.
Serve a evitare ripetizioni quando l'app viene aperta; le righe recenti sono
tappabili per riaprire la card completa e fare una mini-review locale. App e
widget condividono la cache JSON tramite App Group
`group.dev.local.daily-kanji`, cosi il widget puo rileggere la proiezione del
dataset scaricato dall'app senza fare sync di rete separati. La scrittura della
cache aggiorna sia il dataset completo dell'app sia la proiezione ridotta letta
dal widget.

## Esperienza app

La root usa tre tab native, ciascuna con navigazione indipendente:
`Widget`, `Ripasso` e `Cerca`. `Widget` e la superficie companion: mostra il
percorso attivo, una card contestuale e le esposizioni recenti. `Ripasso`
mantiene la sessione FSRS live; quando la capability non e inclusa, mostra
`Ripasso non disponibile` con il percorso verso `Impostazioni`, senza esporre
endpoint o token. `Cerca` offre il glossario con ricerca per termine, lettura o
significato e apre i dettagli nello stesso stack di navigazione.

Le informazioni operative vivono in una sola sheet `Impostazioni`: dati,
disponibilita del ripasso, notifiche, percorso widget e informazioni app. Non
ci sono selettori o blocchi di stato tecnico inline nella schermata principale.
`Aggiorna ripasso` porta sempre alla tab `Ripasso` e forza una nuova richiesta,
anche quando la sheet e stata aperta da `Widget` o `Cerca`; gli aggiornamenti
automatici al foreground restano invece limitati alla tab `Ripasso`.

La riga notifiche riflette lo stato di autorizzazione reale. Una build senza
capability non propone azioni; lo stato non ancora deciso mostra `Attiva
notifiche`, mentre gli stati negato e autorizzato portano alle impostazioni di
sistema senza riproporre il prompt.

`Percorso widget`, disponibile dalla tab Widget e da Impostazioni, apre una
sheet nativa con la bozza di modalita e media. Le modalita sono `Giornaliero`,
`Prestudio` e `Ultime 3`: Giornaliero usa il ranking globale
Hard/Again/bassa-stabilita, Prestudio usa le card della prossima lesson non
completata del media scelto, Ultime 3 quelle valutate Hard/Again nelle ultime
tre lesson completate. `Annulla` scarta la bozza; `Applica` la salva
atomicamente nell'App Group e ricarica una sola volta le timeline WidgetKit.
Il default del media resta coerente con la modalita: tutti i media per
Giornaliero, primo media disponibile per le modalita legate a un media.

## Obiettivo v1

- Mostrare nel widget una card con kanji difficile/instabile.
- Prioritizzare bassa stabilita FSRS, difficolta alta, learning/relearning,
  lapses e hard/again recenti.
- Escludere card nuove mai viste, `known_manual`, sospese, manual override e
  card ormai stabili/note.
- Tenere la app iOS read-only rispetto alla review FSRS.
- Restare offline-first: dataset e audio packaged nel bundle come fallback, con
  refresh remoto solo dall'app quando la cache e' stale o quando l'utente forza
  "Aggiorna ora".
- Restare comodamente nei piani gratuiti Vercel e Turso per uso personale.

## Prerequisiti

1. Xcode completo installato in `/Applications/Xcode.app`.
2. Xcode aperto almeno una volta con setup completato.
3. XcodeGen installato:

   ```sh
   brew install xcodegen
   ```

4. iPhone con Developer Mode attiva e trust del Mac approvato.
5. Account Apple Developer Program attivo e configurato in Xcode per il team
   `F5U46464YH`.

Gli script impostano automaticamente `DEVELOPER_DIR` su
`/Applications/Xcode.app/Contents/Developer` quando Xcode e' presente.

## Comandi

Preflight locale:

```sh
cd apps/daily-kanji-ios
./scripts/doctor.sh
```

Generazione progetto:

```sh
xcodegen generate
open DailyKanji.xcodeproj
```

Build simulatore:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData build
```

Installazione manuale su iPhone fisico:

```sh
./scripts/install-device.sh
```

Per usare un altro device, preferire l'UDID hardware stabile mostrato da Xcode
rispetto all'UUID temporaneo assegnato da CoreDevice:

```sh
DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-device.sh
```

L'installer e' un comando sincrono one-shot: preflighta CoreDevice e Developer
Disk Image, verifica le risorse, genera il progetto, crea una build `Release`,
controlla firma e provisioning di app e widget, installa e avvia l'app. Non
crea job pianificati, processi in background, retry o file di stato. L'iPhone
deve essere sbloccato e raggiungibile via cavo o sulla stessa Wi-Fi.

La configurazione locale non versionata vive in:

```text
~/Library/Application Support/DailyKanji/device.env
```

Il file puo contenere `DEVICE_ID`, le coppie private di sync/review e
`DAILY_KANJI_ENABLE_APNS=1`; deve avere permessi `0600`. Endpoint e token non
vengono stampati, cosi come gli identificatori del device. La DerivedData
dedicata e protetta da una directory radice `0700`; non spostare build contenenti
configurazione privata in directory condivise. Anche quando arrivano
dall'ambiente, i valori privati vengono rimossi dall'environment ereditato dai
processi figli e passati alla sola build tramite la xcconfig temporanea. Prima
di installare, lo script richiede due profili embedded del team `F5U46464YH`,
con bundle id esatti, device incluso e almeno 30 giorni residui. Questo
impedisce di usare accidentalmente una firma temporanea. Se Xcode segnala
account o profili mancanti, apri Xcode > Settings > Accounts, aggiorna il team
e ripeti il comando.

Package IPA diagnostico:

```sh
./scripts/package-ipa.sh
```

Output atteso:

```text
build/DailyKanji.ipa
```

Rigenerazione dataset offline packaged:

```sh
cd ../..
./scripts/with-node.sh pnpm daily-kanji:package
```

Output predefiniti:

```text
apps/daily-kanji-ios/App/Resources/daily-kanji-cards.json
apps/daily-kanji-ios/App/Resources/Audio/
apps/daily-kanji-ios/WidgetExtension/Resources/daily-kanji-widget-cards.json
```

Il JSON e' generato dal DB runtime configurato (`DATABASE_URL`). Gli audio iOS
playable sono copiati da `content/media/<media-slug>/assets/audio/**` solo per
le card presenti nel dataset; formati non supportati da iOS, come OGG, vengono
saltati e l'app disabilita il pulsante audio per quelle card. JSON e audio
restano ignorati da git per evitare di committare snapshot personali o asset
duplicati. Durante la build Xcode il dataset completo e gli audio vengono
copiati solo nel bundle app; la WidgetKit extension contiene esclusivamente il
JSON cards-only, cosi non duplica glossary e circa 93 MB di audio packaged.

Il dataset esporta anche metadata opzionali `studyModes`: le card legacy senza
metadata restano valide come `Daily`, mentre le nuove card possono essere taggate
per `prestudy` o `lastLessonsHardAgain` senza rompere cache o app che ignorano
campi JSON sconosciuti.
Quando il bundle installato contiene questi metadata, l'app ignora cache/sync
legacy senza `studyModes` per non perdere Prestudy/Last 3 dopo un refresh.

Sync dataset runtime privato:

```sh
DAILY_KANJI_IOS_SYNC_ENDPOINT=https://<deployment>/api/daily-kanji/ios-dataset
DAILY_KANJI_IOS_SYNC_TOKEN=<secret>
```

Review live runtime privata:

```sh
MOBILE_API_ENDPOINT=https://<deployment>
MOBILE_API_TOKEN=<secret>
```

Questi valori vanno impostati come build settings locali, passati a `xcodebuild`
oppure salvati nel file locale non versionato:

```sh
~/Library/Application Support/DailyKanji/device.env
```

`scripts/install-device.sh` legge `device.env` e passa endpoint/token alla
build Xcode tramite una xcconfig temporanea protetta. I placeholder non
configurati vengono ignorati: senza `MOBILE_API_*`
la review live resta non configurata; senza `DAILY_KANJI_IOS_SYNC_*` l'app usa
fallback packaged/cache per Daily Kanji e widget. I token non vanno committati.
Dopo una build installata con `MOBILE_API_*`, l'app carica la review globale
live ogni volta che viene aperta o riportata in foreground; il grading nativo
richiede rete. Le notifiche push usano APNs solo nelle build firmate con un
Apple Developer team che supporta Push Notifications.
`DAILY_KANJI_ENABLE_APNS=1` fa usare `DailyKanjiPush.entitlements` quando il
provisioning lo supporta. Il
processo di avvio e ogni ritorno in foreground leggono lo stato notifiche senza
mostrare richieste di permesso. Il prompt di sistema viene avviato soltanto dal
tap esplicito su `Attiva notifiche`; se l'autorizzazione e gia presente, l'app
si registra nuovamente con APNs senza richiedere il permesso. Se la capability
non e configurata non viene effettuata alcuna richiesta. Il widget resta senza
push e senza rete. Dopo una
build installata con `DAILY_KANJI_IOS_SYNC_*`, l'app prova il sync dataset al
massimo ogni 4 ore nello stesso giorno, sempre al cambio del giorno locale del
dispositivo, oppure subito quando l'utente preme "Aggiorna ora". Il widget non
fa rete direttamente; legge la cache condivisa App Group scritta dall'app.

Unit test iOS:

```sh
cd ../..
./scripts/with-node.sh pnpm daily-kanji:test
```

Il comando rigenera `DailyKanji.xcodeproj` con XcodeGen e lancia XCTest sul
simulatore, riusando `apps/daily-kanji-ios/build/SimulatorDerivedData` tra le
esecuzioni. Per scegliere un altro simulatore o una cache diversa:

```sh
DAILY_KANJI_IOS_TEST_DESTINATION='platform=iOS Simulator,name=iPhone 17 Pro' \
DAILY_KANJI_IOS_TEST_DERIVED_DATA_PATH="$PWD/.tmp/daily-kanji-derived-data" \
  ./scripts/with-node.sh pnpm daily-kanji:test
```

`DAILY_KANJI_IOS_TEST_CONFIGURATION` puo cambiare la configurazione `Debug`
predefinita. Se `DEVELOPER_DIR` non e' gia impostato, lo script usa il path
canonico di `/Applications/Xcode.app` quando presente; in caso contrario
rispetta l'Xcode selezionato dal sistema.

## Note widget

- Per Home Screen, la famiglia primaria sara `systemMedium` e mostra fronte,
  retro, reading, pitch accent e una spiegazione breve.
- Per Lock Screen, iOS espone solo slot `accessoryRectangular`: la app pubblica
  quindi due widget coordinati che l'utente puo affiancare. `Daily Kanji`
  mostra solo il fronte/card in grande, mentre `Daily Kanji Reading` mostra
  lettura hiragana, pitch accent con linee sopra le mora alte e traduzione breve.
  Note e spiegazioni restano nell'app e nel widget Home Screen. I due widget
  usano lo stesso provider e la stessa selezione deterministica per slot orario,
  quindi puntano alla stessa card quando WidgetKit li aggiorna per lo stesso
  slot. iOS non consente a un widget singolo di espandersi oltre le dimensioni
  del family selezionato.
- La rotazione widget usa slot orari e programma 24 entrate, quindi espone una
  nuova scheda ogni ora quando WidgetKit puo aggiornare la timeline. Il widget
  legge prima la cache cards-only condivisa App Group scritta dall'app, poi il
  bundle cards-only packaged, poi il sample di sviluppo. Non carica il glossary
  o gli audio dell'app. WidgetKit non garantisce un cambio card a ogni singolo
  wake/sblocco del telefono.
- Il widget usa deep link `dailykanji://card/<card-id>` per aprire la card
  completa nell'app.
- L'app non puo sapere con certezza se il widget lockscreen e' stato davvero
  visibile. Lo storico conserva quindi gli slot pianificati da WidgetKit, senza
  ricostruire retroattivamente il passato dal dataset o dallo scope correnti; la
  selezione in-app usa gli slot persistiti dell'ultimo giorno per ridurre le
  ripetizioni immediate. Se WidgetKit rigenera la timeline a slot gia iniziato,
  lo storico mantiene sia la card pianificata prima del reload sia l'eventuale
  nuova card dello stesso slot e sostituisce soltanto gli slot ancora futuri.
- Dopo reinstallazioni importanti puo essere necessario rimuovere e riaggiungere
  il widget per evitare preview cacheate di WidgetKit.
- `devicectl` puo installare e lanciare la app, ma non puo aprire la widget
  gallery o aggiungere widget alla Home/Lock Screen.

## Limiti gratuiti e traffico

La v1 resta personale e leggera; la milestone smart-sync evolve il
contratto in offline-first senza introdurre vendita, multiutente o sync FSRS da
iOS:

- dataset full e audio locali restano packaged solo nell'app come fallback;
- il widget package contiene solo la proiezione cards-only dello stesso export;
- solo l'app scarica un piccolo JSON privato quando la cache condivisa e' stale
  o quando l'utente forza il refresh;
- la review live e' online-only e usa `MOBILE_API_*`, separata dal dataset
  packaged/cache;
- le notifiche APNs sono app-only; il widget resta network-free;
- il widget legge la cache cards-only condivisa App Group e non fa richieste di
  rete;
- nessuna scrittura FSRS offline da iOS;
- App Group limitato a `group.dev.local.daily-kanji`;
- nessun Associated Domains;
- nessun polling illimitato dal widget;
- fallback offline sempre disponibile.

Con il contratto offline-first, l'app iOS installata puo consumare traffico
runtime solo per il JSON del dataset privato e per la review live quando
configurata. Il budget atteso resta ampiamente sotto i free tier per uso
monoutente: sync automatico massimo ogni 4 ore solo quando l'app viene
aperta/foregrounded, payload JSON piccolo, nessun download audio e nessun
accesso diretto a Turso dal telefono.

Il contratto offline-first e' dichiarato in `offline-contract.json` e verificato
da `tests/daily-kanji-ios-offline-contract.test.ts`: il test blocca
l'introduzione accidentale di database runtime iOS, Associated Domains o App
Group diversi da quello atteso. Le API di rete restano vietate in `Shared/` per
evitare che codice network venga linkato implicitamente sia da app sia da
widget; il client di rete deve vivere nel target `App/`. Lo stesso contratto
dichiara il budget free-tier atteso: 200 sync app mensili come budget automatico
modellato, 0 sync widget, 200 richieste Vercel / 200 query Turso massime attese
lato endpoint, piu export/package manuale.

## Verifica per agenti

Per slice che toccano solo iOS:

```sh
./apps/daily-kanji-ios/scripts/doctor.sh
./scripts/with-node.sh pnpm daily-kanji:test
```

Per slice che toccano signing/widget su device:

```sh
cd apps/daily-kanji-ios
./scripts/install-device.sh
```

Per slice che toccano exporter, API, webapp o DB:

```sh
./scripts/with-node.sh pnpm check
```

Se vengono aggiunte route/API, eseguire anche:

```sh
./scripts/with-node.sh pnpm release:check
```

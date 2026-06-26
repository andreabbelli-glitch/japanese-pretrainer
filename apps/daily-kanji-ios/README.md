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
- Signing automatico con Personal Team `F5U46464YH`.
- Installazione widget validata via Xcode su iPhone fisico con Apple ID
  personale gratuito.
- Reinstall/rinnovo da CLI validato via CoreDevice anche senza cavo, quando
  l'iPhone e' visibile come `transportType: localNetwork`.
- Sideloadly resta solo diagnostico: su questo setup installa la app principale
  ma non registra la WidgetKit extension nella gallery widget.

La app e il widget leggono `daily-kanji-cards.json` quando e' stato esportato.
Se il file non e' presente usano un sample locale (`学`) per mantenere build e
preview funzionanti. Lo storico locale dell'app conserva le esposizioni recenti
degli ultimi 3 giorni, includendo la finestra widget oraria da 72 slot e le
aperture manuali dell'app, anche quando la stessa card viene mostrata piu volte.
Serve a evitare ripetizioni quando l'app viene aperta; le righe recenti sono
tappabili per riaprire la card completa e fare una mini-review locale. App e
widget condividono la cache JSON tramite App Group
`group.dev.local.daily-kanji`, cosi il widget puo rileggere il dataset scaricato
dall'app senza fare sync di rete separati.

La schermata principale dell'app ha selettori locali per media e modalita':
`Daily` usa il ranking globale Hard/Again/low-stability, `Prestudy` mostra le
card della prossima lesson non completata del media selezionato, `Last 3` mostra
le card valutate Hard/Again nelle ultime 3 lesson completate di quel media. Il
cambio di modalita/media resta in bozza finche l'utente non preme `Applica`;
solo allora viene salvato nell'App Group e ricarica subito le timeline WidgetKit,
cosi i widget usano lo stesso scope confermato nell'app. Quando si cambia
modalita, la bozza media viene riportata al default coerente con quella modalita:
`All media` per `Daily`, primo media disponibile per le modalita media-scoped.

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
5. Apple ID personale configurato in Xcode.

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

Reinstall/rinnovo su iPhone fisico:

```sh
./scripts/xcode-renew.sh
```

Per usare un altro device CoreDevice:

```sh
DEVICE_ID=<coredevice-id-or-udid> ./scripts/xcode-renew.sh
```

Automazione rinnovo firma via launchd:

```sh
DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh --mark-success-now
./scripts/xcode-renew-if-needed.sh --status
./scripts/xcode-renew-if-needed.sh --force
```

Il LaunchAgent controlla ogni 6 ore, ma esegue il package + build/install solo
quando l'ultimo rinnovo riuscito ha almeno 5 giorni e l'iPhone e' raggiungibile
via CoreDevice; il package viene lanciato dalla root del repo anche quando
launchd avvia il job da un'altra directory. Il device id resta in
`~/Library/Application Support/DailyKanji/renew.env`, non nel repo. Rieseguire
`install-renew-launchd.sh` aggiorna solo `DEVICE_ID` e conserva eventuali
endpoint/token di sync gia' presenti nello stesso file. Per rimuovere
l'automazione:

```sh
./scripts/install-renew-launchd.sh --uninstall
```

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
```

Il JSON e' generato dal DB runtime configurato (`DATABASE_URL`). Gli audio iOS
playable sono copiati da `content/media/<media-slug>/assets/audio/**` solo per
le card presenti nel dataset; formati non supportati da iOS, come OGG, vengono
saltati e l'app disabilita il pulsante audio per quelle card. JSON e audio
restano ignorati da git per evitare di committare snapshot personali o asset
duplicati. Durante la build Xcode queste risorse vengono copiate sia nel bundle
app sia nel bundle WidgetKit extension.

Il dataset esporta anche metadata opzionali `studyModes`: le card legacy senza
metadata restano valide come `Daily`, mentre le nuove card possono essere taggate
per `prestudy` o `lastLessonsHardAgain` senza rompere cache o app che ignorano
campi JSON sconosciuti.
Quando il bundle installato contiene questi metadata, l'app ignora cache/sync
legacy senza `studyModes` per non perdere Prestudy/Last 3 dopo un refresh.

Sync runtime privato:

```sh
DAILY_KANJI_IOS_SYNC_ENDPOINT=https://<deployment>/api/daily-kanji/ios-dataset
DAILY_KANJI_IOS_SYNC_TOKEN=<secret>
```

Questi valori vanno impostati come build settings locali, passati a `xcodebuild`
oppure salvati nel file locale non versionato:

```sh
~/Library/Application Support/DailyKanji/renew.env
```

`scripts/xcode-renew.sh` legge `renew.env` e passa endpoint/token alla build
Xcode. I placeholder non configurati vengono ignorati e l'app resta sul fallback
packaged/cache. Il token non va committato. Dopo una build installata con questi
valori, l'app prova il sync quando viene aperta o riportata in foreground: al
massimo ogni 4 ore nello stesso giorno, sempre a cambio giorno, oppure subito
quando l'utente preme "Aggiorna ora". Il widget non fa rete direttamente; legge
la cache condivisa App Group scritta dall'app.

Unit test iOS:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

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
- La rotazione widget usa slot di 1 ora. Il widget legge prima la cache
  condivisa App Group scritta dall'app, poi il bundle packaged, poi il sample di
  sviluppo. WidgetKit non garantisce un cambio card a ogni singolo wake/sblocco
  del telefono.
- Il widget usa deep link `dailykanji://card/<card-id>` per aprire la card
  completa nell'app.
- L'app non puo sapere con certezza se il widget lockscreen e' stato davvero
  visibile. Lo storico mostra quindi gli slot widget ricostruiti, mentre la
  selezione in-app tratta solo lo slot widget corrente come esposizione recente
  per ridurre ripetizioni immediate senza bloccare tutta la finestra dei kanji
  piu prioritari.
- Dopo reinstallazioni importanti puo essere necessario rimuovere e riaggiungere
  il widget per evitare preview cacheate di WidgetKit.
- `devicectl` puo installare e lanciare la app, ma non puo aprire la widget
  gallery o aggiungere widget alla Home/Lock Screen.

## Limiti gratuiti e traffico

La v1 resta personale e leggera; la milestone smart-sync evolve il
contratto in offline-first senza introdurre vendita, multiutente o sync FSRS da
iOS:

- dataset full e audio locali restano packaged nell'app come fallback;
- solo l'app scarica un piccolo JSON privato quando la cache condivisa e' stale
  o quando l'utente forza il refresh;
- il widget legge la cache condivisa App Group e non fa richieste di rete;
- nessuna scrittura FSRS da iOS;
- App Group limitato a `group.dev.local.daily-kanji`;
- nessun Associated Domains;
- nessun polling illimitato dal widget;
- fallback offline sempre disponibile.

Con il contratto offline-first, l'app iOS installata puo consumare traffico
runtime solo per il JSON del dataset privato. Il budget atteso resta ampiamente
sotto i free tier per uso monoutente: sync automatico massimo ogni 4 ore solo
quando l'app viene aperta/foregrounded, payload JSON piccolo, nessun download
audio e nessun accesso diretto a Turso dal telefono.

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
cd apps/daily-kanji-ios
./scripts/doctor.sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

Per slice che toccano signing/widget su device:

```sh
cd apps/daily-kanji-ios
./scripts/xcode-renew.sh
```

Per slice che toccano exporter, API, webapp o DB:

```sh
./scripts/with-node.sh pnpm check
```

Se vengono aggiunte route/API, eseguire anche:

```sh
./scripts/with-node.sh pnpm release:check
```

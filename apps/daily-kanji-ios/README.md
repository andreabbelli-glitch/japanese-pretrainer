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
degli ultimi 3 giorni, anche quando la stessa card viene mostrata piu volte, e
serve a evitare ripetizioni quando l'app viene aperta; le righe recenti sono
tappabili per riaprire la card completa e fare una mini-review locale. Il widget
resta senza App Group per non introdurre entitlement fragili con Personal Team.

## Obiettivo v1

- Mostrare nel widget una card con kanji difficile/instabile.
- Prioritizzare bassa stabilita FSRS, difficolta alta, learning/relearning,
  lapses e hard/again recenti.
- Escludere card nuove mai viste, `known_manual`, sospese, manual override e
  card ormai stabili/note.
- Tenere la app iOS read-only rispetto alla review FSRS.
- Azzerare il traffico runtime iOS v1: dataset e audio packaged nel bundle,
  senza refresh remoto dall'app o dal widget.
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
- Per Lock Screen, la famiglia primaria sara `accessoryRectangular`, usando tutto
  lo spazio che iOS assegna a quel family. iOS non consente a un widget singolo
  di espandersi oltre le dimensioni del family selezionato.
- La rotazione widget usa slot offline di 1 ora, precompilando 72 entry di
  timeline per coprire circa 3 giorni senza chiamate di rete. WidgetKit non
  garantisce un cambio card a ogni singolo wake/sblocco del telefono.
- Il widget usa deep link `dailykanji://card/<card-id>` per aprire la card
  completa nell'app.
- Senza App Group, l'app non puo sapere se il widget lockscreen e' stato
  davvero visibile. Lo storico mostra quindi gli slot widget offline ricostruiti,
  mentre la selezione in-app tratta solo lo slot widget corrente come esposizione
  recente per ridurre ripetizioni immediate senza bloccare tutta la finestra dei
  kanji piu prioritari.
- Dopo reinstallazioni importanti puo essere necessario rimuovere e riaggiungere
  il widget per evitare preview cacheate di WidgetKit.
- `devicectl` puo installare e lanciare la app, ma non puo aprire la widget
  gallery o aggiungere widget alla Home/Lock Screen.

## Limiti gratuiti e traffico

La v1 deve restare personale e leggera:

- dataset full e audio locali vengono packaged nell'app;
- zero chiamate di rete runtime da app iOS o widget;
- nessuna scrittura FSRS da iOS;
- nessun entitlement App Group o Associated Domains;
- nessun polling dal widget;
- fallback offline sempre disponibile.

Con questa architettura, l'app iOS installata non consuma traffico runtime e non
tocca Turso durante l'uso quotidiano. Vercel/Turso entrano solo nel workflow di
export/package quando rigeneri il bundle personale; per un uso monoutente questo
resta ampiamente sotto i free tier, perche' non ci sono aperture app, refresh
widget, audio o contenuti pesanti scaricati dal telefono.

Il contratto offline e' dichiarato in `offline-contract.json` e verificato da
`tests/daily-kanji-ios-offline-contract.test.ts`: il test blocca l'introduzione
accidentale di API di rete runtime, App Group o Associated Domains nella app iOS.
Lo stesso contratto dichiara anche il budget free-tier atteso: 0 richieste
runtime mensili a Vercel, 0 query runtime mensili a Turso, export/package solo
manuale, 1 query remota attesa per run di export se `DATABASE_URL` punta a Turso,
0 richieste Vercel per run di package e limite default di 250 card packaged.
Il test confronta quel limite con il default reale dell'exporter, cosi' il
contratto non puo divergere silenziosamente dallo script `daily-kanji:package`.

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

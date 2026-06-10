# Daily Kanji iOS Widget Spike

Spike tecnico per validare il giro gratuito:

1. build di una mini app SwiftUI;
2. estensione WidgetKit iOS;
3. packaging IPA;
4. installazione privata via Sideloadly;
5. auto-refresh settimanale di Sideloadly con Apple ID personale gratuito.

Il contenuto e' volutamente hardcoded. Lo spike deve provare la catena di
firma/installazione/widget, non ancora l'integrazione con il backend Next.js.

## Stato rilevato su questo Mac

Stato aggiornato dello spike su questo Mac:

- Xcode 26.5 installato in `/Applications/Xcode.app`.
- SDK `iphoneos` e `iphonesimulator` disponibili.
- XcodeGen installato via Homebrew.
- `mas`, `xcodes` e `aria2` installati via Homebrew.
- Sideloadly v0.60 installato da `https://sideloadly.io/SideloadlySetup.dmg`.
- Sideloadly si avvia, anche se `spctl` lo valuta come app non firmata.
- `./scripts/package-ipa.sh` genera correttamente
  `build/DailyKanjiWidgetSpike.ipa` con app + WidgetKit extension.
- Build iOS Simulator riuscita su `iPhone 17 Simulator (26.5)`.
- Installazione e launch su simulatore riusciti per bundle
  `dev.local.daily-kanji-spike`; screenshot verificato con app non vuota e
  kanji hardcoded `学`.
- iPhone fisico rilevato da Xcode/CoreDevice:
  `iPhone di Andrea (3)`, iPhone 15, iOS 26.5, Developer Mode attiva.
- Installazione privata via Sideloadly riuscita con Apple ID personale gratuito,
  sia con bundle id automatico (`dev.local.daily-kanji-spike.F5U46464YH`) sia
  con bundle id manuale (`dev.local.daily-kanji-spike`).
- Primo launch bloccato finche il profilo sviluppatore non e' stato autorizzato
  da iOS in `Impostazioni > Generali > VPN e gestione dispositivo`.
- Dopo il trust manuale del profilo, il launch da `devicectl` e' riuscito:
  l'app `Daily Kanji Spike` si apre sul device fisico.
- Il bundle IPA contiene la WidgetKit extension
  `Daily Kanji Widget.appex` con extension point
  `com.apple.widgetkit-extension`.
- Con Sideloadly, anche mantenendo il bundle id manuale e senza rimuovere i
  PlugIns, iOS non mostra `Daily Kanji` nella widget gallery. La app principale
  funziona, ma la WidgetKit extension non risulta registrata dal device.
- Con Xcode + Apple ID personale gratuito/Personal Team, la stessa app viene
  firmata con profili separati per app e widget; il widget compare e funziona
  sulla Home Screen.
- La build `0.1.2`/`3` applica `containerBackground` a tutte le famiglie widget
  e aggiunge `accessoryCircular`; questo corregge il messaggio Lock Screen
  "Please adopt containerBackground API" visto sulla preview `accessory`.

Gli script usano
automaticamente `/Applications/Xcode.app/Contents/Developer` tramite
`DEVELOPER_DIR` quando Xcode e' presente ma `xcode-select` punta ancora ai
Command Line Tools.

I tentativi automatici precedenti avevano trovato questi limiti, ora superati
dall'installazione manuale di Xcode:

- `mas install 497799835` richiede privilegi root e si blocca senza password
  admin interattiva.
- `xcodes install 26.5 --no-superuser --select` richiede Apple ID/password.
- `xcodes download 26.5` richiede Apple ID/password anche per il solo download.
- Command Line Tools non include gli SDK `iphoneos` e `iphonesimulator`, quindi
  non puo compilare WidgetKit iOS.

## Prerequisiti

1. Installa Xcode completo da App Store o Apple Developer Downloads.
2. Apri Xcode una volta e completa il primo setup.
3. Se necessario, punta gli strumenti CLI a Xcode:

   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

4. Installa XcodeGen:

   ```sh
   brew install xcodegen
   ```

5. Installa Sideloadly dal sito ufficiale.
6. Su iPhone abilita Developer Mode, collega l'iPhone al Mac e autorizza il
   trust del computer.

Usa un Apple ID personale dedicato al sideload, non l'Apple ID aziendale.

Per reinstallare gli strumenti automatizzabili:

```sh
cd spikes/daily-kanji-ios-widget
./scripts/bootstrap-tools.sh
```

Il bootstrap non installa Xcode completo perche richiede credenziali Apple o
interazione App Store.

## Genera il progetto

```sh
cd spikes/daily-kanji-ios-widget
./scripts/doctor.sh
xcodegen generate
open DailyKanjiWidgetSpike.xcodeproj
```

In Xcode puoi selezionare il tuo iPhone e lanciare la app per una prima prova.
Se il bundle id `dev.local.daily-kanji-spike` collide, cambialo in
`project.yml`.

## Crea l'IPA per Sideloadly

```sh
cd spikes/daily-kanji-ios-widget
./scripts/package-ipa.sh
```

Output atteso:

```text
build/DailyKanjiWidgetSpike.ipa
```

Di default lo script crea una build `Release`. Per forzare un'altra
configurazione:

```sh
CONFIGURATION=Debug ./scripts/package-ipa.sh
```

Apri Sideloadly, trascina l'IPA, usa il tuo Apple ID personale e avvia
l'installazione. Dopo l'installazione, aggiungi il widget "Daily Kanji" dalla
schermata Home o Lock Screen.

Alla prima installazione sideloaded, iOS puo negare il launch finche non approvi
il profilo sviluppatore in `Impostazioni > Generali > VPN e gestione
dispositivo`. Dopo il trust, il launch da Mac e l'apertura manuale dell'app
funzionano.

Nota importante: su questo Mac/iPhone Sideloadly installa e lancia l'app, ma non
registra la WidgetKit extension nella gallery widget. Per provare il widget su
iPhone fisico serve installare da Xcode con il Personal Team.

## Installa da Xcode per il widget

```sh
cd spikes/daily-kanji-ios-widget
xcodegen generate
open DailyKanjiWidgetSpike.xcodeproj
```

In Xcode seleziona `iPhone di Andrea (3)` e premi Run. Il progetto e'
configurato con `Automatically manage signing` e Team ID `F5U46464YH`, ricavato
dal Personal Team configurato localmente in Xcode. Se lo spike viene clonato su
un altro Mac, aggiorna `DEVELOPMENT_TEAM` in `project.yml`.

Dopo ogni reinstallazione, rimuovi e riaggiungi il widget dalla Home o dalla
Lock Screen per evitare preview cacheate di WidgetKit. `devicectl` puo vedere
l'app installata e lanciarla, ma non puo aprire la widget gallery o aggiungere
widget alla Home Screen.

Smoke simulator opzionale:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanjiWidgetSpike.xcodeproj \
  -scheme DailyKanjiWidgetSpike \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData build
```

## Criteri di successo

- La app "Daily Kanji Spike" si apre su iPhone.
- Il widget "Daily Kanji" e' disponibile nella gallery widget.
- Il widget mostra il kanji hardcoded `学`.
- Xcode installa app e WidgetKit extension con Apple ID personale gratuito.
- Sideloadly resta utilizzabile per installare la app principale, ma non e'
  sufficiente per validare widget iOS su questo setup.

## Cosa prova e cosa non prova

Prova:

- toolchain Xcode sul Mac aziendale;
- packaging app + WidgetKit extension;
- compatibilita' del widget con Apple ID personale gratuito via Xcode;
- limite pratico di Sideloadly per questo widget: app ok, widget non registrato.

Non prova ancora:

- endpoint backend reale;
- token privato;
- scelta automatica del kanji del giorno;
- refresh dati dal widget.

Se lo spike passa, il prossimo step e' sostituire il provider hardcoded del
widget con una chiamata HTTPS a un endpoint read-only del backend, protetto da
token revocabile.

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
- Installazione privata via Sideloadly riuscita con Apple ID personale gratuito.
  Sideloadly ha riscritto il bundle id installato in
  `dev.local.daily-kanji-spike.F5U46464YH`.
- Primo launch bloccato finche il profilo sviluppatore non e' stato autorizzato
  da iOS in `Impostazioni > Generali > VPN e gestione dispositivo`.
- Dopo il trust manuale del profilo, il launch da `devicectl` e' riuscito:
  l'app `Daily Kanji Spike` si apre sul device fisico.
- Il bundle IPA contiene la WidgetKit extension
  `Daily Kanji Widget.appex` con extension point
  `com.apple.widgetkit-extension`.
- La verifica CLI non puo aprire o pilotare la widget gallery iOS. Durante il
  polling dei processi non e' comparso `Daily Kanji Widget.appex`; questo non
  prova il fallimento del widget, ma lascia da confermare manualmente che
  `Daily Kanji` appaia nella gallery e mostri `学`.

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

Per concludere la verifica end-to-end serve confermare manualmente dal telefono
che il widget "Daily Kanji" compaia nella gallery e si possa aggiungere alla
Home o Lock Screen. `devicectl` puo vedere l'app installata e lanciarla, ma non
puo aprire la widget gallery o aggiungere widget alla Home Screen.

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
- Sideloadly vede l'app installata e l'auto-refresh e' attivabile.
- Dopo un refresh manuale in Sideloadly, l'app resta installabile senza passare
  da Xcode.

## Cosa prova e cosa non prova

Prova:

- toolchain Xcode sul Mac aziendale;
- packaging app + WidgetKit extension;
- compatibilita' del widget con sideload gratuito;
- flusso Sideloadly su iPhone personale.

Non prova ancora:

- endpoint backend reale;
- token privato;
- scelta automatica del kanji del giorno;
- refresh dati dal widget.

Se lo spike passa, il prossimo step e' sostituire il provider hardcoded del
widget con una chiamata HTTPS a un endpoint read-only del backend, protetto da
token revocabile.

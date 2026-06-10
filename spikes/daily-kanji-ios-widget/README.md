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

- XcodeGen installato via Homebrew.
- `mas`, `xcodes` e `aria2` installati via Homebrew.
- Sideloadly v0.60 installato da `https://sideloadly.io/SideloadlySetup.dmg`.
- Sideloadly si avvia, anche se `spctl` lo valuta come app non firmata.
- Xcode completo non e' installato; il Mac ha ancora solo Command Line Tools:

```sh
xcode-select -p
# /Library/Developer/CommandLineTools
```

Serve Xcode completo prima di poter compilare o creare l'IPA.
I tentativi automatici hanno trovato questi limiti:

- `mas install 497799835` richiede privilegi root e si blocca senza password
  admin interattiva.
- `xcodes install 26.5 --no-superuser --select` richiede Apple ID/password.
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

Apri Sideloadly, trascina l'IPA, usa il tuo Apple ID personale e avvia
l'installazione. Dopo l'installazione, aggiungi il widget "Daily Kanji" dalla
schermata Home o Lock Screen.

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

# AGENTS.md - Daily Kanji iOS

App iOS privata e monoutente per mostrare nel widget flashcard con kanji
difficili/instabili esportate da Japanese Custom Study.

## Regole locali

- Questo progetto nasce dallo spike WidgetKit gia validato su iPhone fisico.
- Il progetto Xcode e' generato da `project.yml` con XcodeGen: non editare a
  mano `DailyKanji.xcodeproj`.
- Non committare token, URL privati o file di configurazione locale con segreti.
- Usa Xcode + Personal Team per validare il widget su iPhone. Sideloadly puo
  installare la app principale, ma su questo setup non registra la WidgetKit
  extension nella gallery.
- Mantieni la app read-only rispetto alla review FSRS fino a una milestone
  esplicita di sync bidirezionale.
- Le risorse audio packaged sono build artifact generati: non committare
  dump audio duplicati dentro questa cartella senza una decisione esplicita.

## Comandi canonici

```sh
cd apps/daily-kanji-ios
./scripts/doctor.sh
xcodegen generate
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

Unit test iOS:

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project DailyKanji.xcodeproj \
  -scheme DailyKanji \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath build/SimulatorDerivedData test
```

Rinnovo/install su iPhone personale via CoreDevice:

```sh
./scripts/xcode-renew.sh
```

Package IPA diagnostico:

```sh
./scripts/package-ipa.sh
```

Rigenera dataset JSON e audio locali packaged prima delle build realmente usate
sul telefono:

```sh
cd ../..
./scripts/with-node.sh pnpm daily-kanji:package
```

## Verifica per slice

- Cambi a Swift/UI/widget: test simulatore e, se toccano widget/signing,
  `./scripts/xcode-renew.sh` su device fisico quando serve validare il device.
- Cambi a exporter/API/webapp: dalla root repo usa
  `./scripts/with-node.sh pnpm check`; per route/API anche
  `./scripts/with-node.sh pnpm release:check`.
- Ogni slice implementativa deve avere reviewer indipendente green prima del
  commit, poi commit e push su `main` come da regole root.

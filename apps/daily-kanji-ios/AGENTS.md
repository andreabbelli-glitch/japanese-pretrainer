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
- Il monitor GitHub Actions delle notifiche review live resta nel workflow root
  `.github/workflows/mobile-review-notifications.yml`: deve fare solo un `POST`
  ogni `5` minuti all'endpoint protetto tramite secret Actions
  `MOBILE_REVIEW_NOTIFICATION_MONITOR_URL` e
  `MOBILE_NOTIFICATION_MONITOR_SECRET`, senza Node, Turso, APNs o logica review
  nel workflow. Non committare mai secret APNs/mobile/monitor.

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

Automazione launchd per rinnovo firma a basso consumo:

```sh
DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh --mark-success-now
./scripts/xcode-renew-if-needed.sh --status
./scripts/xcode-renew-if-needed.sh --force
```

Il LaunchAgent utente controlla ogni 6 ore, ma il wrapper esegue la build/install
solo se l'ultimo rinnovo riuscito ha almeno 5 giorni, l'iPhone e' raggiungibile
via CoreDevice e la Developer Disk Image e' montabile. Il `DEVICE_ID` viene scritto nel file locale non versionato
`~/Library/Application Support/DailyKanji/renew.env`; lo stesso file puo
contenere `DAILY_KANJI_IOS_SYNC_ENDPOINT`, `DAILY_KANJI_IOS_SYNC_TOKEN`,
`MOBILE_API_ENDPOINT` e `MOBILE_API_TOKEN`, che `scripts/xcode-renew.sh` passa
come build settings locali senza committare segreti. Rieseguire
`scripts/install-renew-launchd.sh` aggiorna solo `DEVICE_ID` e conserva le altre
righe del file. Usa `--mark-success-now` solo
dopo un rinnovo/install manuale gia riuscito: scrive il marker
`last-renew-success.epoch` e impedisce a `RunAtLoad` di rifare subito un build.
Se il marker manca o e' corrotto, il rinnovo e' considerato dovuto. Quando il
rinnovo e' davvero dovuto, il wrapper preflighta CoreDevice/DDI, poi esegue
`pnpm daily-kanji:package` dalla root del repo e poi
`scripts/xcode-renew.sh`, cosi' il verifier non blocca risorse packaged stale. Se
il device non e' disponibile o l'iPhone e' bloccato durante il mount DDI, il job
termina senza marcare successo e riprova al giro successivo. Per rimuoverlo:

```sh
./scripts/install-renew-launchd.sh --uninstall
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

Prima di `xcodegen generate`, `scripts/xcode-renew.sh` e `scripts/package-ipa.sh`
eseguono il verifier root `daily-kanji:verify-resources`: blocca build/install
con dataset sample, dataset stale o audio referenziati non presenti nel bundle.
Per una build intenzionalmente stale usa
`DAILY_KANJI_ALLOW_STALE_RESOURCES=1`, ma non renderlo il default.

## Verifica per slice

- Cambi a Swift/UI/widget: test simulatore e, se toccano widget/signing,
  `./scripts/xcode-renew.sh` su device fisico quando serve validare il device.
- Cambi a exporter/API/webapp: dalla root repo usa
  `./scripts/with-node.sh pnpm check`; per route/API anche
  `./scripts/with-node.sh pnpm release:check`.
- Ogni slice implementativa deve avere reviewer indipendente green prima del
  commit, poi commit e push su `main` come da regole root.

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
- Dataset e risorse audio packaged sono build artifact generati: non committare
  snapshot o dump audio duplicati. Il target app include dataset full e audio;
  il target widget deve includere solo
  `WidgetExtension/Resources/daily-kanji-widget-cards.json`, mai
  `App/Resources`.
- Il monitor GitHub Actions delle notifiche review live e sospeso finche
  APNs/notifiche non sono affidabili. Il workflow root
  `.github/workflows/mobile-review-notifications.yml` deve restare manuale
  (`workflow_dispatch`), senza schedule automatica. Quando lanciato a mano deve
  fare solo un `POST` all'endpoint protetto tramite secret Actions
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

Il LaunchAgent utente non fa polling continuo: `install-renew-launchd.sh` genera
un `StartCalendarInterval` alla prossima scadenza reale dei provisioning profile
embedded registrata in
`~/Library/Application Support/DailyKanji/profile-expiry.epoch`, piu' un piccolo
grace period. `StartCalendarInterval` non contiene un campo anno, quindi questa
automazione e' intenzionalmente tarata sui profili Xcode Personal Team
short-lived, che scadono circa 7 giorni dopo l'install. Se la scadenza manca, e'
corrotta o e' gia passata, l'install interattivo fa un run immediato e programma
una retry futura; quando il job gira da launchd, riscrive il calendario con
`--reschedule-only` senza rilanciarsi subito. Il rinnovo automatico parte solo se
l'iPhone e' raggiungibile via CoreDevice e la Developer Disk Image e'
montabile. Il `DEVICE_ID` viene scritto nel file locale non versionato
`~/Library/Application Support/DailyKanji/renew.env`; lo stesso file puo
contenere `DAILY_KANJI_IOS_SYNC_ENDPOINT`, `DAILY_KANJI_IOS_SYNC_TOKEN`,
`MOBILE_API_ENDPOINT`, `MOBILE_API_TOKEN` e opzionalmente
`DAILY_KANJI_ENABLE_APNS=1`, che `scripts/xcode-renew.sh` passa come build
settings locali senza committare segreti. Lascia APNs disabilitato per Personal
Team; abilitalo solo con provisioning Apple Developer che supporta Push
Notifications. Rieseguire `scripts/install-renew-launchd.sh` aggiorna solo
`DEVICE_ID` e conserva le altre righe del file. Usa `--mark-success-now` solo
dopo un rinnovo/install manuale gia riuscito: scrive solo il marker diagnostico
`last-renew-success.epoch`; la decisione automatica resta basata sulla scadenza
dei profili embedded. Quando il rinnovo e' davvero dovuto, il wrapper preflighta
CoreDevice/DDI, poi esegue `pnpm daily-kanji:package` dalla root del repo e poi
`scripts/xcode-renew.sh`, cosi' il verifier non blocca risorse packaged stale.
Dopo l'install, `xcode-renew.sh` registra la scadenza minima tra app e widget
leggendo gli `embedded.mobileprovision`; il wrapper poi rischedula launchd sulla
nuova data. Se non riesce, se il device non e' disponibile o se l'iPhone e'
bloccato durante il mount DDI, il job termina senza marcare successo e programma
una retry dopo `RENEW_RETRY_DELAY_SECONDS` (default 30 minuti). Errori durante
la rischedulazione launchd finiscono in
`~/Library/Logs/DailyKanji/xcode-renew.err.log`. Per rimuoverlo:

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

Il package genera il dataset completo e gli audio sotto `App/Resources/` e una
proiezione cards-only sotto `WidgetExtension/Resources/`. Il verifier richiede
che la proiezione widget corrisponda esattamente alle card del dataset completo
e non contenga il glossary.

Prima di `xcodegen generate`, `scripts/xcode-renew.sh` e `scripts/package-ipa.sh`
eseguono il verifier root `daily-kanji:verify-resources`: blocca build/install
con dataset sample, dataset stale, audio referenziati non presenti nel bundle o
proiezione widget non coerente. Per una build intenzionalmente stale usa
`DAILY_KANJI_ALLOW_STALE_RESOURCES=1`, ma non renderlo il default.

## Verifica per slice

- Cambi a Swift/UI/widget: test simulatore e, se toccano widget/signing,
  `./scripts/xcode-renew.sh` su device fisico quando serve validare il device.
- Cambi a exporter/API/webapp: dalla root repo usa
  `./scripts/with-node.sh pnpm check`; per route/API anche
  `./scripts/with-node.sh pnpm release:check`.
- Ogni slice implementativa deve avere reviewer indipendente green prima del
  commit, poi commit e push su `main` come da regole root.

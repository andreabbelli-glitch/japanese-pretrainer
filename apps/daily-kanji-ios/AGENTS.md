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
DEVICE_ID=<coredevice-id-or-udid> ./scripts/install-renew-launchd.sh
./scripts/xcode-renew-if-needed.sh --status
./scripts/xcode-renew-if-needed.sh --force
```

Il LaunchAgent utente e' persistente: usa `RunAtLoad` e `StartInterval` ogni
ora (`RENEW_CHECK_INTERVAL_SECONDS=3600`). Ogni attivazione legge soltanto la
scadenza minima dei provisioning profile registrata nello snapshot atomico
`~/Library/Application Support/DailyKanji/profile-state.env`; prima delle
ultime 48 ore (`RENEW_BEFORE_EXPIRY_SECONDS=172800`) esce subito, senza lock,
CoreDevice, package o Xcode. Nella finestra preventiva tenta il rinnovo a ogni
intervallo finche app e widget non sono realmente reinstallati con una scadenza
nuova. Non riscrive il plist e non genera processi figli o retry in background.
L'installer conserva il plist precedente finche il bootstrap del nuovo non e'
riuscito; in caso di errore lo ripristina e tenta di ricaricarlo, mantenendo
come exit code quello del bootstrap nuovo fallito.

Il rinnovo dovuto parte solo se l'iPhone e' raggiungibile via CoreDevice e la
Developer Disk Image e' montabile. Device offline/bloccato, package, signing,
build, install e lettura profili falliscono con exit non-zero: `launchd` conserva
il job e riprova al controllo successivo. Il marker
`last-renew-success.epoch` viene aggiornato soltanto dopo install riuscita e
scadenza embedded valida, successiva alla precedente e fuori dalla finestra di
48 ore. Il `DEVICE_ID` viene scritto nel file locale non versionato
`~/Library/Application Support/DailyKanji/renew.env`; lo stesso file puo
contenere `DAILY_KANJI_IOS_SYNC_ENDPOINT`, `DAILY_KANJI_IOS_SYNC_TOKEN`,
`MOBILE_API_ENDPOINT`, `MOBILE_API_TOKEN` e opzionalmente
`DAILY_KANJI_ENABLE_APNS=1`, che `scripts/xcode-renew.sh` passa come build
settings locali senza committare segreti. Lascia APNs disabilitato per Personal
Team; abilitalo solo con provisioning Apple Developer che supporta Push
Notifications. Rieseguire `scripts/install-renew-launchd.sh` aggiorna solo
`DEVICE_ID` e conserva le altre righe del file. Le vecchie opzioni
`--mark-success-now` e `--reschedule-only` sono accettate solo per migrazione:
non creano successi sintetici e installano comunque il job persistente. Quando
il rinnovo e' dovuto, il wrapper preflighta CoreDevice/DDI, poi esegue
`pnpm daily-kanji:package` dalla root del repo e `scripts/xcode-renew.sh`, cosi'
il verifier non blocca risorse packaged stale. La build fisica usa `Release` di
default per ridurre overhead e consumo sul telefono; `CONFIGURATION=Debug`
resta disponibile solo per diagnosi esplicite. Dopo l'install,
`xcode-renew.sh` registra in un unico file atomico scadenza minima e due UUID
esatti
leggendo gli `embedded.mobileprovision` di app e widget. Nella finestra dovuta
il wrapper sposta temporaneamente dalla cache Xcode solo i file di quegli UUID,
forzando il refresh Personal Team: un errore li ripristina dal backup mirato
sotto `STATE_DIR`, mentre una nuova scadenza verificata elimina il backup.
Profili estranei non vengono cercati per bundle id ne' modificati.

Per l'automazione usare preferibilmente l'UDID hardware stabile dell'iPhone,
non l'UUID temporaneo CoreDevice. Un tunnel Wi-Fi inattivo e' normale e viene
ricreato on demand. Solo per le firme note `CoreDeviceError 4000`,
`RemotePairingError 1001`, RSD `-402653181`/`0xE8000003` o timeout di negoziazione,
`coredevice-recovery.sh` riavvia una sola volta `remotepairingd` e
`CoreDeviceService` nel dominio utente, attende 4 secondi e ritenta il solo
comando fallito. Il budget e' condiviso tra wrapper e child. Non estendere
l'allowlist a errori generici, device bloccato/non trovato, e non aggiungere
`sudo`, unpair, reset rete, `killall` o restart di `com.apple.remoted`.
I log sono in
`~/Library/Logs/DailyKanji/xcode-renew.out.log` e
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

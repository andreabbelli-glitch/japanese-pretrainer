# AGENTS.md - Daily Kanji iOS

App iOS privata e monoutente con companion app SwiftUI e widget WidgetKit.

## Regole locali

- Il progetto Xcode e' generato da `project.yml` con XcodeGen: non editare a
  mano `DailyKanji.xcodeproj`.
- Non committare token, URL privati o file di configurazione locale con segreti.
- Usa il team Apple Developer `F5U46464YH` per le build su iPhone fisico.
- L'installazione fisica canonica e' manuale e sincrona tramite
  `scripts/install-device.sh`: nessun job pianificato, retry in background o
  file di stato operativo.
- L'installer deve verificare prima dell'installazione entrambi i provisioning
  profile embedded, team, bundle id, device e almeno 30 giorni di validita'.
- Mantieni la app read-only rispetto alla review FSRS fino a una milestone
  esplicita di sync bidirezionale.
- Dataset e risorse audio packaged sono artifact generati: non committare
  snapshot o dump audio duplicati. Il target app include dataset completo e
  audio; il widget include solo
  `WidgetExtension/Resources/daily-kanji-widget-cards.json`.
- Il monitor GitHub Actions delle notifiche review live resta manuale
  (`workflow_dispatch`), senza schedule. Non committare secret APNs/mobile.

## Comandi canonici

```sh
cd apps/daily-kanji-ios
./scripts/doctor.sh
xcodegen generate
```

Build e test simulatore:

```sh
cd ../..
./scripts/with-node.sh pnpm daily-kanji:test
```

Package aggiornato e installazione su iPhone via CoreDevice (cavo o stessa
Wi-Fi):

```sh
./scripts/with-node.sh pnpm daily-kanji:package
cd apps/daily-kanji-ios
./scripts/install-device.sh
```

Il device e i build setting privati vivono esclusivamente nel file locale
`~/Library/Application Support/DailyKanji/device.env`, permessi `0600`:

```text
DEVICE_ID=<udid-hardware>
DAILY_KANJI_IOS_SYNC_ENDPOINT=<endpoint-privato>
DAILY_KANJI_IOS_SYNC_TOKEN=<token-privato>
MOBILE_API_ENDPOINT=<endpoint-privato>
MOBILE_API_TOKEN=<token-privato>
DAILY_KANJI_ENABLE_APNS=1
```

Endpoint e token devono comparire in coppia. `DAILY_KANJI_ENABLE_APNS=1` va
usato solo quando la capability Push Notifications e' attiva per il bundle
dell'app; il widget mantiene soltanto gli entitlement App Group. L'installer
usa una xcconfig temporanea `0600`, mantiene la DerivedData dietro una directory
`0700`, non stampa segreti o identificatori del device, esegue un solo tentativo
e non scrive marker o log persistenti.

La build fisica usa `Release`, signing automatico, team `F5U46464YH`,
`-allowProvisioningUpdates` e `-allowProvisioningDeviceRegistration`. Prima di
installare verifica firma profonda e profili app/widget con identificatori:

- `F5U46464YH.dev.local.daily-kanji`
- `F5U46464YH.dev.local.daily-kanji.widget`

Se il profilo residuo e' temporaneo o Xcode non riconosce l'abbonamento, apri
Xcode > Settings > Accounts, aggiorna il team e ripeti il comando. Non aggirare
la soglia minima di validita'.

Package IPA diagnostico:

```sh
./scripts/package-ipa.sh
```

Sia `install-device.sh` sia `package-ipa.sh` eseguono
`daily-kanji:verify-resources` prima di `xcodegen generate`. Per una build
intenzionalmente stale usa `DAILY_KANJI_ALLOW_STALE_RESOURCES=1`, senza renderlo
il default.

## Verifica per slice

- Cambi Swift/UI/widget: `./scripts/with-node.sh pnpm daily-kanji:test`.
- Cambi a script iOS/setup: anche `./scripts/with-node.sh pnpm test:ios-ops` e
  documentazione pertinente.
- Cambi a exporter/API/webapp: `./scripts/with-node.sh pnpm check`; per route o
  API anche `./scripts/with-node.sh pnpm release:check`.
- Ogni slice implementativa richiede reviewer indipendente GREEN prima di
  commit e push su `main`.

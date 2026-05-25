# Pitch Accent Minimal Pairs

La sezione `/pitch-accent` e un workspace locale separato da review, media,
Kanji Clash e Katakana Speed. Allena la percezione del pitch accent tramite
coppie minime finite, con corpus vendorizzato e audio statico offline.

## Superfici

- `/pitch-accent`: dashboard con filtri per pattern, `Solo devoicing`,
  `Strict pair finding`, CTA di avvio e link alla sessione/recap piu recente.
- `/pitch-accent/session/[sessionId]`: sessione focalizzata da 20 trial con
  audio, replay, scorciatoie `1`/`2`/`3`, `r` e `Space`.
- `/pitch-accent/recap/[sessionId]`: recap persistito con accuratezza globale,
  breakdown per pattern e log tentativi.

Le sessioni sono indipendenti da FSRS e da `/review`: non cambiano daily limit,
queue, `review_subject_state`, Kanji Clash o `content/media`.

## Corpus vendorizzato

Il corpus v1 deriva da `Kuuuube/minimal-pairs`, pin:
`774a17422a6baadce5877c10069a1d40648e20a9`.

Il vendor output principale vive in:

```text
public/vendor/minimal-pairs/
  manifest.json
  pitch-graphs.json
  LICENSE-GPL-3.0.txt
  NOTICE.md
  audio/<pairId>/<variant>.<codec>
```

La licenza upstream e GPL-3.0-only. La UI/runtime dell'app non importa codice
JS/CSS upstream: usa solo manifest normalizzato, metadata e audio decodificato.
Gli asset audio reali del corpus sono AAC anche quando l'upstream li dichiara
come data URL OGG; l'importer sniffa i magic bytes e salva estensioni/MIME reali.

Il manifest vendor resta fedele al commit upstream per audit e checksum. A
runtime l'app puo applicare correzioni conservative prima del rendering: in
particolare normalizza l'handakuten combinante erroneo sulla riga K
(`カ゚/キ゚/ク゚/ケ゚/コ゚`) in kana sonori (`ガ/ギ/グ/ゲ/ゴ`), cosi grafi e
label non contano il segno combinante come una mora separata.

Il loader conserva i pair del manifest vendorizzato senza esclusioni runtime
per singolo item. Anche il pair Kuuuube `ze` (`しのぶ`, contrasto 1/2) resta
disponibile nel drill.

Un secondo corpus statico opzionale puo vivere in:

```text
public/vendor/tofugu-pitch-minimal-pairs/
  manifest.json
  pitch-graphs.json
  NOTICE.md
  audit.json
  audio/<pairId>/<variant>.mp3
```

Questo corpus e generato una tantum da:

- tutti gli MP3 locali Tofugu/WaniKani, indicizzati come `surface + reading`;
- un export Jaydar/JMDict completo per tutte le reading Tofugu candidate;
- Kanjium come fonte persistita del pitch accent;
- il manifest Kuuuube, usato per escludere contrasti gia coperti come
  `normalizedKana + unorderedPitchContrast`.

Jaydar non e una dipendenza runtime dell'app. Il runtime legge solo i manifest
statici gia generati. Se il corpus Tofugu non esiste, `/pitch-accent` usa solo
il corpus Kuuuube.

I file `pitch-graphs.json` sono manifest statici generati dagli audio
vendorizzati e keyed by `audioSrc`. Il formato storico `version: 1` conserva
durata, intervallo campioni e una traccia F0 in Hz con `null` per frame non
voiced/silenzio. Il formato `version: 2` aggiunge `rawValues`, `extractor`,
`qualityScore` e una curva didattica `values` gia renderizzabile: i frame non
voiced restano nella timeline, ma vengono compressi su una baseline visuale
invece di essere trattati come `0 Hz` reale.

Il runtime usa `values` nella review dopo errore: il graph resta nascosto
finche non si tocca una risposta, poi mostra la singola pronuncia selezionata e
sincronizza la playhead con l'audio originale. Effetti di ascolto come
`Muffle` e rumore non modificano i dati del graph. L'overlay teorico derivato
da `pitchAccent/moraCount` e persistibile in V2 come audit separato, ma non e
forzato nella UI iniziale.

## Workflow operativo

Import o refresh del corpus:

```sh
./scripts/with-node.sh pnpm pitch-accent:import-minimal-pairs
```

Validazione vendor:

```sh
./scripts/with-node.sh pnpm pitch-accent:validate-corpus
```

Rigenerazione pitch graph statici dagli audio vendorizzati:

```sh
./scripts/with-node.sh pnpm pitch-accent:generate-pitch-graphs
```

Rigenerazione esplicita in formato V2 local-improved, da fare solo dopo
approvazione visiva del bake-off:

```sh
./scripts/with-node.sh pnpm pitch-accent:generate-pitch-graphs -- --graph-version 2
```

Bake-off locale su 20-30 pair, senza modificare i manifest vendorizzati:

```sh
./scripts/with-node.sh pnpm pitch-accent:generate-pitch-graph-bakeoff
```

Il report viene scritto di default in `.tmp/pitch-graph-bakeoff/` e include
colonne fisse per current strict, WORLD/Praat/pYIN, Onsei-style Praat, SwiftF0
raw/voiced-gated/smoothed, cleanup WORLD, render Kotu-like locale, render
improved locale e baseline Kotu. Di default il comando usa `uv` per eseguire
gli estrattori Python esterni (`pyworld`, `praat-parselmouth`, `librosa.pyin`,
`swift-f0`) su Python 3.12; passa `--no-external-extractors` solo per
smoke/test veloci senza dipendenze esterne.
La colonna Onsei replica la logica F0 della repo `itsupera/onsei` senza
vendorizarla: Parselmouth `to_pitch(time_step=0.005)`, `kill_octave_jumps()` e
`smooth()`.
Le colonne SwiftF0 usano il pacchetto della repo `lars76/swift-f0`: raw espone
`pitch_hz` del modello ONNX, voiced-gated applica la maschera voiced speech
`confidence > 0.9` e `65-400 Hz` senza normalizzare la scala pitch, smoothed
aggiunge interpolazione di gap brevi e smoothing leggero preservando come gap i
tratti unvoiced lunghi.

Benchmark scientifico contro PTDB-TUG, con 5 audio microfonici e F0 reference
da laryngograph scaricati dall'hosting ufficiale solo in `.tmp`:

```sh
./scripts/with-node.sh pnpm pitch-accent:benchmark-ptdb-tug
```

Il report confronta ogni extractor contro la F0 validata e calcola una
similarita 0-100 basata su F1 voiced/unvoiced e vicinanza pitch in cents, oltre
a MAE/RMSE, Gross Pitch Error e octave error. Quando disponibili, il confronto
e il render usano i timestamp reali degli extractor invece di assumere che ogni
curva inizi a `t=0`.

Benchmark visuale didattico per scegliere come mostrare SwiftF0 dopo errore:

```sh
./scripts/with-node.sh pnpm pitch-accent:benchmark-display-variants
```

Il report viene scritto in `.tmp/pitch-graph-display-variants/` e seleziona
almeno 10 pair coprendo piu volte `pitch0`-`pitch4`. Per ogni audio mostra:
SwiftF0 voiced-gated smoothed raw, una curva display con micro-gap bridging,
scala log relativa alla mediana, asse robusto e smoothing leggero, poi la stessa
curva con overlay teorico e una variante continua dove tutti i gap sono
interpolati. Include anche una variante continua `theory-shaped` con dominio e
blend orientati al pattern teorico, piu playhead verticale sincronizzata
all'audio del report. Il report include inoltre una diagnostica Ishi-style:
comprime la curva continua in valori rappresentativi per mora, calcola i
rapporti tra more adiacenti in semitoni e riporta il calo relativo piu forte.
Questa e una approssimazione locale: usa bin moraici uniformi perche il corpus
non contiene boundary CV/VC allineati.

La baseline Kotu e autorizzata ma opt-in. La documentazione pubblica
[Kotu API](https://docs.kotu.io/) dichiara una superficie v2 limitata a status,
pronunciation search e text parsing; per questo il runtime non dipende da
endpoint audio/pitch. Se serve confrontare una curva Kotu, popola una cache
locale rate-limited con consenso esplicito. Il bake-off puo farlo
automaticamente dietro flag: scansiona `questions/next`, associa
`rawPronunciation + pitchAccent`, scarica `raw-pitch` per i `pronunciationID`
matched e salva `.tmp/pitch-graph-bakeoff/kotu-baseline-cache.json`.

```sh
./scripts/with-node.sh pnpm pitch-accent:generate-pitch-graph-bakeoff -- --allow-kotu-api --kotu-api-scan-limit 400
```

Per fetch mirati da ID Kotu gia noto, resta disponibile anche il comando
manuale:

```sh
./scripts/with-node.sh pnpm pitch-accent:fetch-kotu-pitch-baseline -- --allow-kotu-api --pronunciation-id <kotu-id> --raw-pronunciation スル --pitch-accent 1
./scripts/with-node.sh pnpm pitch-accent:generate-pitch-graph-bakeoff -- --kotu-cache .tmp/pitch-graph-bakeoff/kotu-baseline-cache.json
```

Generazione del corpus statico Tofugu/Jaydar:

```sh
./scripts/with-node.sh pnpm pitch-accent:generate-tofugu-pairs -- --jaydar-export tmp/jaydar-tofugu-homophones.jsonl
```

Validazione del corpus Tofugu/Jaydar:

```sh
./scripts/with-node.sh pnpm pitch-accent:validate-tofugu-pairs -- --kuuuube-manifest public/vendor/minimal-pairs/manifest.json
```

L'export Jaydar e un prerequisito esplicito. Deve contenere una riga JSONL per
ogni reading Tofugu candidata, con questa forma:

```json
{"reading":"はし","homophones":[{"surface":"橋","reading":"はし","jaydarPitchAccents":[2],"isCommon":true}]}
```

`jaydarPitchAccents` e opzionale per membership omofona, ma se presente e non
include il pitch singleton Kanjium, la parola viene esclusa e riportata in
`audit.json` come `jaydar_kanjium_pitch_mismatch`. Se l'export non copre una
reading Tofugu candidata, la generazione fallisce: il corpus deve essere
prodotto con un controllo batch completo, non campionato.

In questa macchina `cargo`/`rustc` possono non essere installati. In quel caso
genera l'export Jaydar in un ambiente Rust esterno, oppure installa il toolchain
Rust prima di creare `tmp/jaydar-tofugu-homophones.jsonl`.

L'importer cancella e rigenera solo la directory vendor standard
`public/vendor/minimal-pairs`. Un output path custom richiede il flag esplicito
`--allow-non-vendor-out-dir` ed e accettato solo se non esiste, e vuoto, oppure
contiene il marker `.minimal-pairs-vendor-generated`; path pericolosi come la
root del repo restano sempre bloccati.

Il generator Tofugu rigenera solo `public/vendor/tofugu-pitch-minimal-pairs`.
Un output path custom richiede `--allow-non-vendor-out-dir` ed e accettato solo
se non esiste, e vuoto, oppure contiene il marker
`.tofugu-pitch-minimal-pairs-generated`.

## Persistenza

Il DB conserva solo dati runtime utente:

- `pitch_accent_session`: stato sessione, filtri JSON, rollup accuratezza e
  stats per pattern.
- `pitch_accent_trial`: piano persistito e snapshot opzioni/correct answer.
- `pitch_accent_attempt_log`: tentativo idempotente, uno per trial.

Il completamento e l'abbandono finalizzano solo sessioni ancora `active`, cosi
una race client tra auto-advance e abbandono non puo ribaltare un recap gia
salvato.

## Verifica mirata

```sh
./scripts/with-node.sh pnpm exec vitest run tests/pitch-accent-corpus.test.ts tests/pitch-accent-importer.test.ts tests/pitch-accent-session-persistence.test.ts tests/pitch-accent-interactions.test.ts tests/pitch-accent-route.test.ts tests/pitch-accent-page.test.ts tests/pitch-accent-pitch-graph.test.ts tests/pitch-accent-pitch-graph-loader.test.ts tests/pitch-accent-pitch-graph-generator.test.ts
./scripts/with-node.sh pnpm exec playwright test tests/e2e/pitch-accent.spec.ts
```

Per modifiche a route, Server Actions, DB, sessioni o UI user-facing restano
obbligatori:

```sh
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

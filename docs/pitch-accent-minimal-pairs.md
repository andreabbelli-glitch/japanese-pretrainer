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
(`カ゚/キ゚/ク゚/ケ゚/コ゚`) in kana sonori (`ガ/ギ/グ/ゲ/ゴ`), cosi label e
notazione pitch-accent non contano il segno combinante come una mora separata.

Il loader conserva i pair del manifest vendorizzato senza esclusioni runtime
per singolo item. Anche il pair Kuuuube `ze` (`しのぶ`, contrasto 1/2) resta
disponibile nel drill.

Un secondo corpus statico opzionale puo vivere in:

```text
public/vendor/tofugu-pitch-minimal-pairs/
  manifest.json
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

La sessione non calcola e non carica curve acustiche. Dopo un errore, le opzioni
restano cliccabili solo per riascoltare le singole pronunce; l'audio principale
sotto il kana resta quello del prompt originale.

## Workflow operativo

Import o refresh del corpus:

```sh
./scripts/with-node.sh pnpm pitch-accent:import-minimal-pairs
```

Validazione vendor:

```sh
./scripts/with-node.sh pnpm pitch-accent:validate-corpus
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
./scripts/with-node.sh pnpm exec vitest run tests/pitch-accent-corpus.test.ts tests/pitch-accent-importer.test.ts tests/pitch-accent-corpus-loader.test.ts tests/pitch-accent-session-persistence.test.ts tests/pitch-accent-interactions.test.ts tests/pitch-accent-route.test.ts tests/pitch-accent-page.test.ts
./scripts/with-node.sh pnpm exec playwright test tests/e2e/pitch-accent.spec.ts
```

Per modifiche a route, Server Actions, DB, sessioni o UI user-facing restano
obbligatori:

```sh
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

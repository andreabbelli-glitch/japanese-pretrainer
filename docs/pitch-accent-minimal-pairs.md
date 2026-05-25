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

Il vendor output vive in:

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

## Workflow operativo

Import o refresh del corpus:

```sh
./scripts/with-node.sh pnpm pitch-accent:import-minimal-pairs
```

Validazione vendor:

```sh
./scripts/with-node.sh pnpm pitch-accent:validate-corpus
```

L'importer cancella e rigenera solo la directory vendor standard
`public/vendor/minimal-pairs`. Un output path custom richiede il flag esplicito
`--allow-non-vendor-out-dir` ed e accettato solo se non esiste, e vuoto, oppure
contiene il marker `.minimal-pairs-vendor-generated`; path pericolosi come la
root del repo restano sempre bloccati.

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
./scripts/with-node.sh pnpm exec vitest run tests/pitch-accent-corpus.test.ts tests/pitch-accent-importer.test.ts tests/pitch-accent-session-persistence.test.ts tests/pitch-accent-interactions.test.ts tests/pitch-accent-route.test.ts tests/pitch-accent-page.test.ts
./scripts/with-node.sh pnpm exec playwright test tests/e2e/pitch-accent.spec.ts
```

Per modifiche a route, Server Actions, DB, sessioni o UI user-facing restano
obbligatori:

```sh
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

# Workflow pronunce

Questo documento e la source of truth del flusso operativo per aggiungere audio
alle flashcard che non hanno ancora una pronuncia locale.

## Obiettivo

Quando in una nuova chat arriva una richiesta del tipo:

- "aggiungi le pronunce mancanti"
- "completa le parti vocali delle flashcard"
- "riempi gli audio che non ci sono ancora"

il flusso corretto non parte da Forvo. Parte sempre dal fetch offline su fonti
libere e usa Forvo solo come fallback manuale sulle entry rimaste scoperte.

## Flusso canonico

1. Identifica le entry del bundle che non hanno ancora audio locale valido.
2. Escludi solo le entry che hanno gia audio locale nel Markdown o in
   `pronunciations.json`.
3. Esegui il fetch offline con `pnpm pronunciations:fetch`.
4. Raccogli il riepilogo del comando e riporta chiaramente:
   - quante entry sono state completate;
   - quali entry sono ancora senza audio;
   - eventuali errori o limitazioni del run.
5. Se dopo il fetch offline restano mancanti, proponi il fallback Forvo.
6. Se il fallback viene richiesto, costruisci un batch Forvo solo con le entry
   ancora mancanti, escludendo quelle gia marcate in
   `data/forvo-known-missing.json`.
7. Per Forvo usa batch da `10` come default operativo, salvo richiesta diversa
   dell'utente.

## Fase 1: fetch offline primario

Comando standard:

```bash
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug>
```

Comandi utili:

```bash
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug> --dry-run
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug> --limit 10
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug> --refresh
```

Questo step:

- usa Lingua Libre e Wikimedia Commons come fonti reali di download;
- usa `en.wiktionary` e `ja.wiktionary` solo come indice per trovare file
  Commons collegati;
- aggiorna direttamente `content/media/<slug>/pronunciations.json` e gli asset
  locali.

## Output atteso dopo il fetch offline

Dopo `pnpm pronunciations:fetch`, la risposta all'utente deve sempre chiarire:

- quante entry sono state risolte;
- quali entry non hanno trovato audio;
- se conviene fermarsi li oppure passare a Forvo.

Se non resta nulla da fare, il workflow finisce qui.

## Fase 2: fallback Forvo

Forvo non e il primo step. Si usa solo se:

- il fetch offline ha gia finito;
- restano entry senza audio;
- l'utente vuole completare il dataset con un fallback manuale.

Per Forvo:

- costruisci la lista solo dalle entry ancora senza audio dopo la fase 1;
- escludi quelle presenti in `data/forvo-known-missing.json`, salvo richiesta
  esplicita di retry;
- usa batch da `10` come default;
- usa sempre il flusso `--manual` nel browser normale.

Comando tipico:

```bash
~/.codex/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --entry <entry-id> ...
```

La documentazione operativa dettagliata di Forvo resta in
`docs/forvo-pronunciation-fetch.md`.

## Guardrail

- Non saltare direttamente a Forvo quando la richiesta utente e generica.
- Non usare il browser Playwright per i batch reali Forvo; il comportamento
  standard e il browser normale in `--manual`.
- Non proporre batch Forvo su tutto il bundle se prima non e stato eseguito il
  fetch offline o non e stato almeno riportato un elenco dei mancanti.
- Le entry gia marcate in `data/forvo-known-missing.json` vanno escluse dal
  fallback Forvo per default.

## Riferimenti

- fetch offline primario: `docs/pronunciation-fetch.md`
- fallback Forvo: `docs/forvo-pronunciation-fetch.md`

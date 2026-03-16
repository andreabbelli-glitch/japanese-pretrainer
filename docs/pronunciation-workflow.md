# Workflow pronunce

Questo documento e la source of truth del flusso operativo per aggiungere audio
alle flashcard che non hanno ancora una pronuncia locale.

## Obiettivo

Quando in una nuova chat arriva una richiesta del tipo:

- "aggiungi le pronunce mancanti"
- "completa le parti vocali delle flashcard"
- "riempi gli audio che non ci sono ancora"

il flusso corretto non parte da Forvo. Parte sempre dal fetch offline su fonti
libere, riusa prima gli audio gia presenti in altri media compatibili e usa
Forvo solo come fallback manuale sulle entry rimaste scoperte.

## Flusso canonico

1. Identifica le entry del bundle che non hanno ancora audio locale valido.
2. Escludi solo le entry che hanno gia audio locale nel Markdown o in
   `pronunciations.json`.
3. Prima di cercare audio fuori dal bundle, controlla sempre se esiste gia una
   card equivalente in un altro media con stesso tipo entry, stesso label e
   stessa reading; in quel caso riusa lo stesso audio e collega le due card.
4. Esegui il fetch offline con `pnpm pronunciations:fetch`.
5. Raccogli il riepilogo del comando e riporta chiaramente:
   - quante entry sono state completate;
   - quali entry sono ancora senza audio;
   - eventuali errori o limitazioni del run.
6. Se dopo il fetch offline restano mancanti, proponi il fallback Forvo.
7. Se il fallback viene richiesto, costruisci un batch Forvo solo con le entry
   ancora mancanti, escludendo quelle gia marcate in
   `data/forvo-known-missing.json`.
8. Per Forvo usa batch da `10` come default operativo, salvo richiesta diversa
   dell'utente.
9. Mantieni aggiornata la lista residua in
   `content/media/<slug>/workflow/pronunciation-pending.json`.

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

- esegue automaticamente un pass di riuso cross-media prima del download;
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
- la sidecar `workflow/pronunciation-pending.json` viene aggiornata
  automaticamente con le sole entry ancora senza audio e non segnate come skip.

Se non resta nulla da fare, il workflow finisce qui.

## Fase 2: fallback Forvo

Forvo non e il primo step. Si usa solo se:

- il fetch offline ha gia finito;
- restano entry senza audio;
- l'utente vuole completare il dataset con un fallback manuale.

Per Forvo:

- riesegui sempre il controllo cross-media prima di aprire Forvo; se esiste gia
  un audio compatibile in un altro media, va riusato e Forvo non va aperto per
  quella entry;
- costruisci la lista solo dalle entry ancora senza audio dopo la fase 1;
- escludi quelle presenti in `data/forvo-known-missing.json`, salvo richiesta
  esplicita di retry;
- usa batch da `10` come default;
- usa sempre il flusso `--manual` nel browser normale.
- al termine aggiorna `content/media/<slug>/workflow/pronunciation-pending.json`
  per riflettere il residuo ancora aperto.

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
- Non aprire Forvo per entry che possono essere collegate a un audio gia
  presente in un altro media compatibile.
- Non proporre batch Forvo su tutto il bundle se prima non e stato eseguito il
  fetch offline o non e stato almeno riportato un elenco dei mancanti.
- Le entry gia marcate in `data/forvo-known-missing.json` vanno escluse dal
  fallback Forvo per default.

## Riferimenti

- fetch offline primario: `docs/pronunciation-fetch.md`
- fallback Forvo: `docs/forvo-pronunciation-fetch.md`

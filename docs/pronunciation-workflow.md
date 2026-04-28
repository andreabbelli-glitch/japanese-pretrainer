# Workflow pronunce

Questo documento e la source of truth del flusso operativo per aggiungere audio
alle flashcard che non hanno ancora una pronuncia locale.

## Obiettivo

Quando in una nuova chat arriva una richiesta del tipo:

- "aggiungi le pronunce mancanti"
- "completa le parti vocali delle flashcard"
- "riempi gli audio che non ci sono ancora"

il flusso corretto non parte piu dal low-level Forvo. Parte dal resolver smart
del repo, che seleziona i target, prova prima il riuso cross-media, esegue il
fetch offline su fonti libere e usa Forvo solo come fallback manuale sulle
entry rimaste scoperte.

## Flusso canonico

1. Identifica i target dal contesto richiesto:
   - `review` globale o filtrata per media;
   - `next-lesson` sul primo step non completato del media;
   - `lesson-url` su una route textbook dell'app.
2. Converti le card selezionate in entry audio usando tutte le `card_entry_link`
   e deduplica per `entryType + entryId`.
3. Escludi subito le entry che hanno gia audio locale nel Markdown o in
   `pronunciations.json`.
4. Prima di cercare audio fuori dal bundle, controlla sempre se esiste gia una
   card equivalente in un altro media con stesso tipo entry, stesso label e
   stessa reading; in quel caso riusa lo stesso audio e collega le due card.
5. Esegui il fetch offline sul residuo con `pnpm pronunciations:fetch` oppure
   lascia che il resolver lo faccia automaticamente.
6. Raccogli il riepilogo del comando e riporta chiaramente:
   - quante entry sono state completate;
   - quali entry sono ancora senza audio;
   - eventuali errori o limitazioni del run.
7. Se dopo il fetch offline restano mancanti, proponi il fallback Forvo.
8. Se il fallback viene richiesto, costruisci un batch Forvo solo con le entry
   ancora mancanti, escludendo quelle gia marcate in
   `data/forvo-known-missing.json`.
9. Non aggiungere mai un limite batch implicito. Usa `--limit` solo quando
   l'utente chiede esplicitamente un numero massimo o uno smoke test.
10. Mantieni aggiornata la lista residua in
    `content/media/<slug>/workflow/pronunciation-pending.json`.
11. Quando una entry viene saltata come `missing on Forvo`, apri anche il suo
    URL `word-add/...` nel browser normale e registra la richiesta in
    `data/forvo-requested-word-add.json`.
12. Passa nell'URL anche gli hint di prefill per Tampermonkey:
    lingua giapponese, `phrase yes/no`, `personal name = no`.
13. Quando una entry richiesta in passato ottiene poi un audio locale
    (riuso cross-media, fetch offline o Forvo), aggiorna
    `data/forvo-requested-word-add.json` marcandola come `resolved` invece di
    lasciarla indistinguibile dalle richieste ancora aperte.

## Entry point standard

Per la maggior parte delle richieste operative, usa direttamente il resolver:

```bash
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media <media-slug>
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode next-lesson --media <media-slug>
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode lesson-url --lesson-url /media/<media-slug>/textbook/<lesson-slug>
```

Questo comando:

- seleziona i target dal contesto richiesto;
- filtra le entry gia coperte;
- esegue riuso cross-media;
- esegue il fetch offline sul residuo;
- manda a Forvo manuale solo le entry ancora scoperte;
- aggiorna `workflow/pronunciation-pending.json`;
- sincronizza anche lo stato `resolved` delle entry storiche in
  `data/forvo-requested-word-add.json` quando trova un audio.

## Fase 1: fetch offline primario

Comando standard:

```bash
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug>
```

Comandi utili:

```bash
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug> --dry-run
./scripts/with-node.sh pnpm pronunciations:fetch -- --media <media-slug> --refresh
```

Questo step:

- esegue automaticamente un pass di riuso cross-media prima del download;
- usa Lingua Libre e Wikimedia Commons come fonti reali di download;
- usa `en.wiktionary` e `ja.wiktionary` solo come indice per trovare file
  Commons collegati;
- aggiorna direttamente `content/media/<slug>/pronunciations.json` e gli asset
  locali.

Se stai gia usando `pronunciations:resolve`, questa fase viene eseguita in
automatico solo sul sottoinsieme selezionato; il comando `pronunciations:fetch`
resta utile quando vuoi forzare solo il pass offline su un intero media.

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
- non imporre mai un batch implicito: copri tutte le entry selezionate nello
  scope richiesto;
- passa `--limit` solo se l'utente chiede esplicitamente un numero massimo o
  uno smoke test;
- usa sempre il flusso `--manual` nel browser normale.
- avvia il Forvo manuale solo da un TTY interattivo; in Codex usa
  `exec_command` con `tty: true`, perche il controllo browser `/skip` dipende
  da quella sessione;
- quando salti una entry con `s` o `/skip`, lascia che il comando apra anche la
  tab `word-add/...` per chiedere la pronuncia e registri la richiesta fatta;
- se usi il helper Tampermonkey locale, lascia che legga gli hint `jcs_*`
  presenti nell'URL invece di selezionare a mano lingua e tipo entry;
- al termine aggiorna `content/media/<slug>/workflow/pronunciation-pending.json`
  per riflettere il residuo ancora aperto.

Comando tipico:

```bash
.agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh --media <media-slug> --entry <entry-id> ...
```

Oppure, come entry point standard ad alto livello:

```bash
./scripts/with-node.sh pnpm pronunciations:resolve -- --mode review --media <media-slug>
```

La documentazione operativa dettagliata di Forvo resta in
`docs/forvo-pronunciation-fetch.md`.

## Guardrail

- Non saltare direttamente a Forvo quando la richiesta utente e generica.
- Non usare `pnpm pronunciations:forvo` come entry point standard quando il
  target reale e `review`, `next-lesson` o una pagina textbook: in quei casi
  usare `pnpm pronunciations:resolve`.
- Non usare il browser Playwright per i batch reali Forvo; il comportamento
  standard e il browser normale in `--manual`.
- Non lanciare il Forvo manuale da una sessione non-TTY: il comando deve
  rifiutarsi invece di aspettare download senza server `/skip`.
- Non disattivare il prefill `word-add` sugli skip; le richieste da fare vanno
  aperte e registrate automaticamente.
- Non aprire Forvo per entry che possono essere collegate a un audio gia
  presente in un altro media compatibile.
- Non proporre batch Forvo su tutto il bundle se prima non e stato eseguito il
  fetch offline o non e stato almeno riportato un elenco dei mancanti.
- Le entry gia marcate in `data/forvo-known-missing.json` vanno escluse dal
  fallback Forvo per default.
- Se vuoi riprovare anche quelle entry, passa `--retry-known-missing` a
  `pnpm pronunciations:resolve` o a `pnpm pronunciations:forvo`.

## Riferimenti

- fetch offline primario: `docs/pronunciation-fetch.md`
- fallback Forvo: `docs/forvo-pronunciation-fetch.md`

# Audit performance webapp — 2026-09-05

Il confronto parte da `6b18d381`, dopo l'ottimizzazione delle top query Turso.
Questo audit estende la verifica a CPU applicativa, query interattive,
serializzazione Server Components, precaricamenti e navigazione browser.

## Misure e perimetro

- Profilazione dei loader di dashboard, libreria, dettaglio media, due indici
  textbook, reader, tooltip, glossary globale e filtrato per media, ricerca, autocomplete,
  dettaglio, prima card e sessione review, consolidamento, Kanji Clash,
  Katakana Speed, Pitch Accent e settings.
- Copia locale delle tabelle runtime necessarie: 4.939 card, 3.742 stati SRS,
  15.721 eventi review e 704 lesson. I dati vengono letti da Turso; il benchmark
  non modifica lo studio in produzione e non usa il DB come autorita editoriale.
- Node 22.22.1, Next 16.1.6, data cache disabilitata nei loader Vitest, orologio
  fissato a `2026-09-05T08:42:26.000Z`. Profilo CPU V8 senza inspector di rete.
- I 19 casi prima/dopo producono JSON con lo stesso SHA-256, incluso l'ordine
  delle card. Uno e il dettaglio inesistente; il dettaglio presente `MSカード`
  e stato verificato separatamente (7 query, 3.524 byte, circa 4 ms locali).
- Browser Chromium con build production e DB E2E dedicato, viewport 1280×900,
  undici route aperte due volte; controllo visuale anche a 390×844. I bundle
  E2E sono importati intenzionalmente dal workflow canonico.

Gli artefatti diagnostici della sessione sono fuori dal repository, in
`/tmp/jcs-performance-audit-2026-09-05`: profili CPU, SQL parametrizzato,
metriche JSON, screenshot e trace. Non contengono credenziali da versionare.

## Risultati implementati

| Metrica | Prima | Dopo | Riduzione |
| --- | ---: | ---: | ---: |
| Loader Kanji Clash, cache vuota locale | 1.335 ms | 150–163 ms | circa 88% |
| Query elenco glossary globale, rows read Turso | 117.861 | 104.887 | 11% |
| Query elenco glossary del media, rows read Turso | 62.088 | 45.944 | 26% |
| Precaricamenti RSC iniziali della libreria | 27 | 2 | 93% |
| Precaricamenti RSC iniziali di Kanji Clash | 25 | 2 | 92% |
| Precaricamenti RSC iniziali del dettaglio media | 22 | 7 | 68% |
| Precaricamenti RSC iniziali della dashboard | 6 | 2 | 67% |
| HTML decodificato indice Migaku | 1.134.756 byte | 748.808 byte | 34% |

Le rows read sono quelle restituite realmente da Turso alle SELECT, con zero
scritture; non sono VM step o conteggi delle righe restituite. Le due query
restituiscono le stesse 24 righe, nello stesso ordine, prima e dopo.
Il piano locale mostrava letture ripetute delle stesse entry: la proiezione
materializzata una volta evita di ripagare i lookup durante ranking e conteggi.

I precaricamenti sono richieste HTTP RSC osservate per 700 ms dopo il load,
senza hover: non equivalgono a un numero garantito di query DB o invocazioni
fatturate, poiche intervengono le cache. Il peso HTML include la serializzazione
RSC, prima della compressione di trasporto. Il JS iniziale della dashboard
passa da 179.573 a 180.338 byte osservati: il piccolo wrapper non introduce
dipendenze o un nuovo framework client.

### CPU Kanji Clash

La generazione delle coppie normalizzava ripetutamente superfici gia semplici
usando il parser Markdown completo. `stripInlineMarkdown` restituisce ora
direttamente le stringhe composte soltanto da lettere e numeri Unicode.
Spazi, markup, ruby, link, entita e punteggiatura passano ancora dal parser.
Restano identici eleggibilita, coppie, queue token e ordine dei round; non viene
introdotta una cache di stato SRS o una cache in memoria senza limite.

### Query glossary

Senza filtro di studio, l'elenco usa una proiezione di catalogo con `EXISTS`
indicizzato per la presenza di card non archiviate. Non aggrega lo stato SRS
dell'intero catalogo. Il ranking richiede presenza, non il numero di card.
Il risultato viene riutilizzato da ranking e conteggi mediante
[`AS MATERIALIZED`](https://www.sqlite.org/lang_with.html#materialization_hints).

I filtri `known`, `review`, `learning`, `new` e `available` mantengono il percorso
che considera lo stato di studio. Le card della pagina mantengono i badge live
e l'invalidazione esistente; dedup cross-media, filtro card, preferenza della
entry con card e paginazione restano invariati. Non servono migrazioni.

### Precaricamento su scelta dell'utente

`IntentLink` attiva il prefetch completo della destinazione al passaggio del
mouse, al focus da tastiera o al touch iniziale. Si applica alle card della
libreria, alle CTA della dashboard e del media e ai filtri Kanji Clash.
E una variante del [prefetch su intenzione documentato da Next.js](https://nextjs.org/docs/app/guides/prefetching).

La review mantiene il prefetch dedicato, il buffer e l'avanzamento ottimistico.
Le normali navigazioni client e i loading state restano disponibili anche se
il prefetch non e ancora terminato. Non vengono aggiunti timer nel prodotto,
polling o attese prima di un click. I timer dei test simulano la rete lenta.

### Payload textbook

L'indice interattivo riceve solo media, gruppi, resume, totale, percentuale e
link glossary. La lista piatta delle lesson era una seconda copia di quella
gia contenuta nei gruppi. Viene omessa dalle props serializzate, insieme agli
altri campi inutilizzati; il loader condiviso mantiene il contratto completo.

## Architettura e compatibilita gratuita

Restano Next Server Components, Turso remoto in Irlanda e cache con invalidazione
per contenuti/studio. L'audit non giustifica l'aggiunta di Redis, servizi a
pagamento, repliche locali su filesystem Vercel, cron frequenti o un nuovo
backend. Le quattro ottimizzazioni riducono lavoro e trasferimenti nei percorsi
esistenti e sono compatibili con Vercel Hobby e Turso Free.

Dashboard e overview mantengono il caricamento stabile condiviso e i contatori
globali. La review continua a idratare soltanto la finestra di card richiesta.
Gli snapshot Daily Kanji e l'optimizer mantengono i limiti e gli indici della
slice precedente. Quote ufficiali, regioni e budget sono in
[`infrastructure-budget.md`](infrastructure-budget.md).

Il payload Kanji Clash del campione resta circa 1,1 MB di JSON completo, inclusi
round bufferizzati e token firmato. Il buffer serve l'interazione immediata:
non viene ridotto per ottenere un risparmio artificiale a spese dei round
successivi. Il catalogo textbook Migaku mantiene circa 4.900 nodi DOM: non si
introduce virtualizzazione che alteri ricerca nella pagina o accessibilita.

## Verifica e limiti

- 106 test glossary e 55 test mirati a normalizzazione/pairing/furigana passati.
- Quattro nuovi E2E: nessun prefetch di destinazioni non scelte nella libreria
  e in Kanji Clash, prefetch al focus, navigazione textbook/glossary con risposta
  prefetch trattenuta. Si verifica anche l'assenza di reload completo.
- 24 navigazioni consecutive media → textbook/glossary dopo la modifica senza
  errori browser o pagine vuote. Prima della modifica, 16 ulteriori navigazioni
  con richieste rallentate non hanno riprodotto l'intermittenza precedente.
- `./scripts/with-node.sh pnpm release:check` passato: `check` incluso con
  file-size, lint, typecheck e 1.788 test in 295 file; migrazioni e import
  validato su SQLite dedicato, build production, corpus Pitch Accent e tutti
  i 37 E2E. Nessun retry o aumento dei timeout nel gate finale.

Le latenze dei loader sono locali e prive del tratto Vercel-Turso. Le misure
browser non sono una stima del p95 in produzione: sul secondo caricamento
osservato il LCP e fra 36 e 104 ms; il primo caricamento risente di cache,
font e precaricamenti precedenti. Non si promette una latenza invariata al
millisecondo o una riduzione percentuale uniforme per ogni pagina.

La rara navigazione con `<main>` vuoto annotata nell'audit precedente non e
riproducibile in questi controlli. I nuovi test coprono il caso con prefetch
in corso, ma non dimostrano la causa del vecchio problema: resta documentato
in [`local-verification-notes.md`](local-verification-notes.md#limiti-residui).

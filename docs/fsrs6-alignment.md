# Allineamento FSRS 6 / Anki

Questa applicazione considera completo l'allineamento quando, a parita di
storia e parametri, il **modello di memoria FSRS 6** produce gli stessi valori
di difficolta e stabilita del binding ufficiale e quando il calendario applica
le policy Anki rilevanti per una review mono-utente. Non significa clonare ogni
opzione, schermata o struttura dati di Anki.

Fonti di riferimento:

- [Anki Manual - Deck Options](https://docs.ankiweb.net/deck-options.html)
- [Anki Manual - Preferences](https://docs.ankiweb.net/preferences.html)
- [Anki scheduler source](https://github.com/ankitects/anki/tree/main/rslib/src/scheduler)
- [fsrs-rs](https://github.com/open-spaced-repetition/fsrs-rs)

## Contratto implementato

| Area | Comportamento applicato | Stato |
| --- | --- | --- |
| Modello FSRS | FSRS 6 a 21 pesi; `Again`, `Hard`, `Good`, `Easy`; desired retention predefinita al 90%; fuzz interno di `ts-fsrs` disabilitato | Allineato |
| Conformita matematica | Test diretto di difficolta e stabilita contro `@open-spaced-repetition/binding@0.5.0` / fsrs-rs 6.5 | Allineato |
| Memoria | Una memoria stabile per `canonicalSubject + recallTask`; recognition e concept restano separate; alias espliciti assorbono cambi di identita | Adattamento necessario al dominio |
| Cronologia | Ledger immutabile con stato prima/dopo, rating, tempo logico, versione algoritmo/binding, hash parametri ed eventi di controllo | Allineato e piu auditabile |
| Giorno di studio | Cambio giorno alle 04:00 in `Europe/Rome`, inclusi giorni DST da 23/25 ore; intervalli giornalieri ancorati al confine logico | Allineato |
| Learning e relearning | Gli step nello stesso giorno conservano l'ora esatta; dopo almeno un giorno logico, `Good`/`Easy` promuovono la memoria al percorso review usando tutto il tempo trascorso, mentre `Again`/`Hard` restano conservativi | Adattamento di prodotto |
| Rientro nella sessione | Una card in learning/relearning puo ricomparire nella stessa sessione; nessun polling e nessuna ricostruzione completa fra card quando non serve | Allineato |
| Fuzz giornaliero | Stesse finestre, aritmetica `f32` e stessi limiti Anki 25.07; per le review usa l'intervallo FSRS float prima dell'arrotondamento | Allineato nel comportamento |
| Load balancing | Distribuzione pesata Anki entro la stessa finestra di fuzz, solo fino a 90 giorni; Easy Days supportati con default tutti `normal` | Allineato |
| Intervallo massimo | Limite predefinito 36.500 giorni applicato al runtime | Allineato |
| Optimizer | Binding ufficiale, dataset per prefissi validi, split temporale train/holdout, confronto candidato/incumbent e guardrail log-loss/RMSE | Allineato |
| Promozione parametri | I nuovi pesi diventano attivi solo se migliorano il holdout; stato e watermark separati per recognition/concept | Scelta conservativa |
| Reschedule | Cambio parametri non riscrive automaticamente il calendario; preview e applicazione sono manuali e protette da hash | Allineato al default sicuro Anki |

### Dettagli della policy giornaliera

- `ts-fsrs` espone la stabilita risultante e `interval_modifier`: il runtime
  ricava da questi l'intervallo review pre-round senza copiare la formula FSRS.
  Il prodotto e la matematica delle finestre vengono convertiti a `f32`, come
  `constrained_fuzz_bounds(interval: f32, ...)` di Anki 25.07. Gli ingressi da
  learning/relearning completati nello stesso giorno conservano l'intervallo
  arrotondato prodotto da `ts-fsrs`, coerentemente con il percorso learning di
  Anki. Se invece una memoria resta in uno stato transitorio per almeno un
  giorno logico, `Good` ed `Easy` la trattano come una review riuscita: FSRS usa
  i giorni effettivamente trascorsi e la policy giornaliera parte
  dall'intervallo review pre-round. `Again` e `Hard` non ricevono questa
  promozione.
- Il seed deterministico e `memoryKey + reps`: resta stabile se cambia la card
  fisica che rappresenta una memoria cross-media ed e condiviso fra i quattro
  rating, come l'unico fattore casuale usato da Anki per una risposta.
- Preview server, grading live e replay/reschedule usano la stessa chiave e la
  stessa policy. Gli stati intraday con `scheduledDays = 0` partecipano alla
  cronologia di replay, ma non al carico delle scadenze giornaliere.
- Il payload first-candidate non calcola date sul client: dopo il reveal i voti
  mostrano `Calcolo…` finche non arrivano le quattro preview autoritative, ma
  restano subito utilizzabili: grading e intervallo vengono comunque calcolati
  in modo autoritativo dal server.

## Cosa resta intenzionalmente diverso da Anki

- La review resta globale e deduplicata cross-media. Non introduciamo deck
  separati che possano duplicare la stessa memoria.
- Esistono due preset coerenti col prodotto, `recognition` e `concept`, invece
  di gruppi di opzioni per deck.
- Una memoria abbandonata in learning/relearning non viene penalizzata se viene
  ricordata dopo almeno un giorno logico: con `Good`/`Easy` esce dallo stato
  transitorio e il tempo realmente trascorso diventa evidenza di memoria. La
  decisione usa `lastReviewedAt` nel grading live e l'`elapsedDays` persistito
  nel replay, quindi non dipende da quanto la scadenza era arretrata.
- La selezione casuale dentro il range di fuzz e deterministica. La data resta
  dentro gli stessi limiti Anki, ma non e richiesto ottenere lo stesso singolo
  numero casuale di un'installazione Anki.
- Non applichiamo sibling dispersal: i duplicati semantici sono gia unificati
  dalla `memoryKey` e il contenuto non ha un note-id equivalente a quello di
  Anki. Aggiungerlo senza tale identita separerebbe memorie corrette.
- Easy Days e disponibile nel dominio con default neutro, ma non aggiunge
  controlli alla UI finche non esiste un bisogno reale.
- Non replichiamo UI, statistiche, deck management, bury o undo di Anki: non
  cambiano il calcolo FSRS e sarebbero scope di prodotto separati.

## Invarianti preservati

- `/review` resta la coda globale reale; la route del media resta un filtro
  verticale sullo stesso sistema.
- Il limite di nuove card resta globale.
- Le modalita Kanji Clash, Katakana Speed e Pitch Accent restano indipendenti.
- Il prodotto resta single-user e locale-first, senza nuova auth o
  multi-tenancy.
- Gli stati e i log esistenti vengono migrati/aliasati; non si azzera la memoria
  dell'utente per adottare FSRS 6.

## Budget prestazionale

- Ogni singola schedulazione esegue al massimo una query aggregata limitata al
  range di fuzz quando l'intervallo base e fra 1 e 90 giorni; intraday e
  intervalli piu lunghi non la eseguono. Un grade con la finestra completa di
  candidate successive puo arrivare a cinque aggregazioni indipendenti e
  limitate, eseguite senza scansioni non indicizzate dell'intera tabella.
- Le quattro preview dei pulsanti condividono una sola aggregazione. Al client
  arriva solo il risultato compatto, non una mappa di 90 giorni.
- La sessione intraday usa un avanzamento incrementale; ricostruisce la coda
  solo al confine terminale quando una nuova scadenza entra nei 20 minuti.
- L'optimizer controlla prima le soglie con SQL, gira fuori dal request path,
  elabora i preset in sequenza e applica una deadline end-to-end per preset di
  4 secondi. Errori e cooldown restano isolati per preset.
- La preview di riallineamento, che rilegge la cronologia completa, e calcolata
  solo su richiesta dalla pagina Settings.
- L'applicazione del riallineamento calcola replay e load balancing fuori dalla
  transazione, poi usa un solo batch atomico non interattivo con guard sui
  parametri e compare-and-swap di ogni memoria. Il test versionato copre 1.200
  memorie; un benchmark locale a 1.600 ha completato il flusso in circa 1,64 s
  con circa 4,3 MB di payload.
- Non esiste polling per le card future.

### Audit piani gratuiti (16 luglio 2026)

Scenario volutamente conservativo: 1.600 memorie e 200 review al giorno.

| Risorsa mensile stimata | Stima applicazione | Quota gratuita di riferimento | Margine |
| --- | ---: | ---: | ---: |
| Turso rows read | meno di 100 milioni | 500 milioni | almeno 5x |
| Turso rows written | circa 18.000 | 10 milioni | oltre 500x |
| Turso storage ledger dopo un anno | circa 0,29 GB | 5 GB totali | oltre 17x |
| Vercel invocazioni | meno di 10.000 | 1 milione | oltre 100x |
| Vercel Active CPU | meno di 1 ora | 4 ore | almeno 4x |

Le quote sono verificate sulle pagine ufficiali
[Vercel Functions](https://vercel.com/docs/functions/usage-and-pricing),
[Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) e
[Turso Pricing](https://turso.tech/pricing). Turso contabilizza le righe
scansionate, non soltanto quelle restituite: per questo la stima usa il caso
peggiore delle aggregazioni, come descritto nella sua
[guida usage e billing](https://docs.turso.tech/help/usage-and-billing).

Il solo rischio operativo da verificare prima del deploy e uno smoke test del
batch di riallineamento sul Turso remoto reale: l'API documenta l'atomicita del
batch, ma non pubblica un limite massimo del payload. Il riallineamento e
manuale e raro; il percorso quotidiano di review non invia payload simili.

## Verifica canonica

```sh
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

La suite include conformance matematica, identita/migrazioni, ledger/replay,
giorno logico e DST, intraday/learn-ahead, fuzz/load balancing, optimizer e
shape delle query.

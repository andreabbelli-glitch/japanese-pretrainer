# Brief Contenuti - Duel Masters DM25

## Scopo

Primo contenuto reale della webapp.

Il focus non e "tutto Duel Masters", ma un pacchetto didattico mirato che
insegni:

- il linguaggio base delle carte di Duel Masters;
- i termini piu ricorrenti;
- i pattern grammaticali piu comuni nel testo regolistico;
- i kanji piu utili in contesto;
- un deep dive mirato sui deck `DM25-SD1` e `DM25-SD2`.

## Perche questo contenuto e adatto come primo media

- linguaggio ricorrente e template-driven;
- perimetro chiaro e finito;
- termini e pattern riutilizzabili su molte carte;
- deck reali come caso d'uso concreto;
- molto adatto a glossary, textbook e review.

## Struttura didattica consigliata

### Asse 1 - TCG Core Language

Serve a capire come si legge una carta Duel Masters in generale.

Argomenti:

- anatomia della carta;
- costi, tipi, potere, zone, timing;
- verbi e comandi ricorrenti;
- pattern grammaticali del rules text;
- kanji ad alta frequenza in contesto carta;
- differenza tra keyword, testo effetto e condizioni.

### Asse 2 - Deck Deep Dive

Serve a leggere davvero le carte dei due starter deck.

Deep dive richiesti:

- `DM25-SD1`
- `DM25-SD2`

Per ogni deck:

- overview del piano di gioco;
- termini specifici del deck;
- pattern grammaticali ricorrenti;
- carte chiave spiegate;
- aiuto pratico alla lettura del testo carta.

## Livello target

- utente circa N5/N4;
- spiegazioni principalmente in italiano;
- priorita a comprensione funzionale del testo carta, non a teoria astratta.

## Regola didattica importante

`N5/N4` descrive il livello attuale di partenza dell'utente, non il limite
massimo del contenuto.

Quindi:

- se un termine, kanji o pattern e piu avanzato ma compare spesso o e essenziale
  per leggere bene le carte, va incluso e spiegato;
- se un elemento e piu avanzato ma strutturalmente importante nel linguaggio
  Duel Masters, va spiegato in modo accessibile;
- non serve andare in dettagli rari, iper specialistici o poco riutilizzabili;
- meglio insegnare bene un pattern un po' sopra il livello attuale ma molto
  utile, piuttosto che restare artificialmente entro N5/N4.

## Segmentazione consigliata

Per questo media usare `segment_kind: deck`.

Segmenti iniziali:

- `tcg-core`
- `dm25-sd1`
- `dm25-sd2`

## Primo batch consigliato

Per partire, non chiedere tutto in una volta.

Batch 1 consigliato:

- `media.md`
- `textbook/001-tcg-core-overview.md`
- `textbook/002-tcg-core-patterns.md`
- `cards/001-tcg-core.md`

Batch 2 consigliato:

- `textbook/010-dm25-sd1-overview.md`
- `textbook/011-dm25-sd1-key-cards.md`
- `cards/010-dm25-sd1-core.md`

Batch 3 consigliato:

- `textbook/020-dm25-sd2-overview.md`
- `textbook/021-dm25-sd2-key-cards.md`
- `cards/020-dm25-sd2-core.md`

## Tipi di contenuto da privilegiare

- termini ad alta frequenza su piu carte;
- pattern grammaticali davvero ricorrenti;
- kanji usati in contesto carta;
- frasi modello tratte da testo carta o molto vicine ad esso;
- spiegazioni orientate alla lettura pratica;
- elementi piu avanzati quando sono comuni, strutturali o essenziali.

## Tipi di contenuto da evitare

- grammatica scolastica non collegata alle carte;
- kanji generici scollegati dal corpus Duel Masters;
- spiegazioni troppo lunghe;
- troppe carte in un solo batch;
- dettagli di meta game non necessari alla lettura del testo;
- finezze rare o marginali che difficilmente l'utente rivedra.

## Convenzione ID consigliata

- media: `media-duel-masters-dm25`
- lesson core: `lesson-duel-masters-dm25-tcg-core-...`
- lesson deck 1: `lesson-duel-masters-dm25-dm25-sd1-...`
- lesson deck 2: `lesson-duel-masters-dm25-dm25-sd2-...`
- term: `term-...`
- grammar: `grammar-...`
- card: `card-...`

## Nota importante per l'LLM esterno

Il textbook deve spiegare e referenziare.
Le entry canoniche per glossary/review dovrebbero vivere preferibilmente nei file
`cards/`.

Quindi:

- se un termine o pattern e importante, dichiaralo esplicitamente in `cards/`;
- nel textbook, referenzialo via `[label](term:...)` o `[label](grammar:...)`;
- dichiara nel textbook solo le entry davvero nuove quando necessario.

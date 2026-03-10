# Brief Contenuti - Duel Masters

## Scopo

Media generale di studio su Duel Masters.

Il corpus iniziale usa i due starter deck `DM25-SD1 技の王道` e
`DM25-SD2 力の王道`, ma i deck sono casi di studio, non l'identita del media.

Il bundle deve insegnare:

- il linguaggio base delle carte di Duel Masters;
- i termini piu ricorrenti;
- i pattern grammaticali piu comuni del rules text;
- i kanji davvero utili in contesto carta;
- due lesson core nettamente distinte;
- due deep dive verticali sui due mazzi di partenza.

## Perche questo contenuto e adatto come primo media

- linguaggio ricorrente e template-driven;
- perimetro chiaro ma non troppo stretto;
- termini e pattern riutilizzabili su molte carte;
- due deck reali che spingono il linguaggio in direzioni diverse;
- ottimo materiale per glossary, textbook e review.

## Struttura didattica consigliata

### Asse 1 - Core Orientation

Serve a entrare nel gioco e a capire come si legge una carta prima ancora del
rules text tecnico.

Argomenti:

- obiettivo della partita;
- anatomia della carta;
- costi, tipi, potere, civilta, razze;
- zone principali;
- attori della frase;
- verbi di base ad altissima frequenza;
- ordine pratico di lettura.

### Asse 2 - Rules Text Parsing

Serve a leggere il testo effetto in modo tecnico, senza sovrapporlo alla lesson
precedente.

Argomenti:

- trigger;
- sequenza;
- opzionalita;
- sostituzione;
- controllo di stato;
- restrizioni;
- filtri numerici;
- keyword con parentesi esplicative.

### Asse 3 - Deck Deep Dives

Serve a leggere davvero i due mazzi iniziali come corpus reale.

Per ogni deck:

- overview del piano di gioco;
- impronta lessicale del mazzo;
- 3-5 nomi o termini da fissare;
- frasi modello molto vicine al testo carta;
- spiegazione a meta tra gioco e giapponese, con priorita al giapponese.

## Livello target

- utente circa N5/N4;
- spiegazioni principalmente in italiano;
- priorita a comprensione funzionale del testo carta, non a teoria astratta.

## Regole didattiche importanti

`N5/N4` descrive il livello di partenza dell'utente, non il limite massimo dei
contenuti.

Quindi:

- se un termine, kanji o pattern e piu avanzato ma compare spesso o e
  essenziale, va incluso e spiegato;
- se un elemento e piu avanzato ma strutturalmente importante nel linguaggio di
  Duel Masters, va spiegato in modo accessibile;
- non serve andare in dettagli rari o poco riutilizzabili.

Regole specifiche di struttura:

- `001-tcg-core-overview` deve essere un onboarding soft, non una lesson
  tecnica sul parsing;
- `002-tcg-core-patterns` deve essere una lesson tecnica sul rules text, non un
  secondo overview generale;
- le lesson deck devono essere verticali, non semplici recap del core;
- le lesson deck devono restare a meta tra spiegare il gioco e spiegare il
  giapponese, con focus principale sul giapponese.

## Segmentazione consigliata

Per questo media usare `segment_kind: deck`.

Segmenti attuali:

- `tcg-core`
- `mazzo-abyss`
- `mazzo-apollo-red-zone`

## Stato reale del bundle

Il bundle reale attuale contiene:

- `media.md`
- `textbook/001-tcg-core-overview.md`
- `textbook/002-tcg-core-patterns.md`
- `textbook/010-dm25-sd1-overview.md`
- `textbook/020-dm25-sd2-overview.md`
- `cards/001-tcg-core.md`
- `cards/010-dm25-sd1-core.md`
- `cards/020-dm25-sd2-core.md`

## Batch futuri consigliati

Se vuoi estendere il bundle senza riscrivere quello che esiste gia, i batch
successivi sensati sono:

- `textbook/011-dm25-sd1-key-cards.md`
- `textbook/021-dm25-sd2-key-cards.md`

Eventuali nuovi file `cards/` vanno creati solo se emergono davvero nuove entry
canoniche utili a glossary/review.

## Tipi di contenuto da privilegiare

- termini ad alta frequenza su piu carte;
- pattern grammaticali davvero ricorrenti;
- kanji usati in contesto carta;
- frasi modello tratte da testo carta o molto vicine ad esso;
- spiegazioni orientate alla lettura pratica;
- elementi piu avanzati quando sono comuni, strutturali o essenziali.

## Tipi di contenuto da evitare

- grammatica scolastica scollegata dalle carte;
- kanji generici scollegati dal corpus Duel Masters;
- spiegazioni troppo lunghe;
- troppe carte in un solo batch;
- dettagli di meta game non necessari alla lettura;
- duplicazione tra lesson core e lesson deck.

## Convenzione ID consigliata

- titolo visibile media: `Duel Masters`
- media tecnico: `media-duel-masters-dm25` / `duel-masters-dm25`
- lesson core: `lesson-duel-masters-dm25-tcg-core-...`
- lesson deck 1: `lesson-duel-masters-dm25-dm25-sd1-...`
- lesson deck 2: `lesson-duel-masters-dm25-dm25-sd2-...`
- term: `term-...`
- grammar: `grammar-...`
- card: `card-...`

## Nota importante per l'LLM esterno

Il textbook deve spiegare e referenziare.
Le entry canoniche per glossary/review dovrebbero vivere preferibilmente nei
file `cards/`.

Quindi:

- se un termine o pattern e importante, dichiaralo esplicitamente in `cards/`;
- nel textbook, referenzialo via `[label](term:...)` o `[label](grammar:...)`;
- dichiara nel textbook solo le entry davvero nuove quando necessario.

Quando estendi contenuto gia esistente, passa sempre anche i file reali del
bundle relativi all'area che stai toccando. Non chiedere all'LLM di lavorare
solo sul brief se deve continuare lesson o segmenti che esistono gia.

# Rubrica Qualita Editoriale

## Scopo

Questo documento rende esplicito il criterio editoriale da usare quando un LLM
scrive `textbook/` e `cards/`.

Serve soprattutto a evitare due errori ricorrenti:

- semplicità scambiata per povertà informativa;
- flashcard sprecate su elementi troppo verticali, episodici o poco
  spendibili.

## 1. Principio base

La semplicità non significa dire meno cose.

La semplicità giusta significa:

- ordine lineare;
- frasi pulite;
- pochi concetti per frase;
- massima densità di informazione utile.

Quindi ogni paragrafo deve consegnare informazione concreta, non solo
valutazione.

Una frase è insufficiente se fa solo una di queste cose:

- dice che qualcosa è "utile", "importante" o "da ricordare";
- dice che un elemento "aiuta a leggere" senza spiegare come;
- giustifica perché una lesson, una card o una entry esiste;
- commenta il percorso editoriale invece di spiegare il giapponese.

Una spiegazione passa il controllo solo se chiarisce almeno due livelli:

1. che cosa sta dicendo davvero il giapponese;
2. che differenza pratica fa nel media o nel contesto.

## 2. Divisione dei ruoli: textbook vs flashcard

`textbook/` e `cards/` non hanno lo stesso scopo.

Hanno pero la stessa priorita di fondo:

- insegnare e chiarire il giapponese viene prima;
- spiegare il gioco o il media viene dopo, come supporto contestuale.

### Textbook

Il textbook deve spiegare tutto cio che serve per capire davvero il giapponese
del materiale del media, anche quando l'elemento non merita memoria attiva a
lungo termine.

Quindi il textbook non e una guida al gioco travestita da lesson di lingua.
Il media serve come contesto per chiarire:

- che cosa vuol dire il giapponese;
- quale funzione concreta ha in quella scena, schermata o regola;
- quale interpretazione sbagliata evita.

Nel textbook vanno quindi spiegati anche:

- keyword o effetti molto verticali;
- label di schermata o di regola poco riusabili fuori da quel media;
- nomi interni, sigle o acronimi che servono a capire la scena corrente;
- differenze di funzione tra opzioni, target, timing, zone o stati.

Se un elemento e necessario per capire la scena oppure per interagire
correttamente con il media ma non vale una flashcard, non va rimosso: va
spiegato nel textbook e fermato li.

Ma anche in questi casi la priorita resta linguistica:

- il media non va spiegato per se stesso;
- va spiegato solo nella misura in cui aiuta a leggere meglio il giapponese.

### Flashcard

Le flashcard servono a fissare giapponese spendibile.

La domanda corretta non è:

- "questa cosa compare qui?"

La domanda corretta è:

- "vale la pena saperla riconoscere di nuovo, anche fuori da questa scena o da
  questo singolo media?"

Di default una entry è una buona candidata a flashcard se soddisfa almeno una
di queste condizioni:

- è lessico giapponese frequente o ricorrente;
- è un kanji, composto o chunk che migliora literacy generale;
- è un pattern grammaticale che riapre molte altre frasi;
- è una label UI o di rules text compatta ma ricorrente e non trasparente;
- ha valore di riuso anche fuori da un singolo episodio, deck, evento o schermata.

Di default una entry non dovrebbe diventare flashcard se è soprattutto:

- un acronimo interno o promozionale;
- un codice set, nome evento o sigla di prodotto;
- un nome proprio che non costruisce vera literacy;
- una keyword troppo verticale da memorizzare solo per quella carta o quel menu;
- una spiegazione di puro ruling senza una forma giapponese forte da allenare.

Eccezione:

- se un elemento molto verticale blocca davvero la lettura del corpus e ricorre
  spesso, può diventare flashcard, ma la motivazione deve restare linguistica,
  non collezionistica o di completismo.

## 3. Regola di spendibilità

Quando devi scegliere tra più candidati, privilegia il giapponese più
spendibile possibile.

Ordine di priorità consigliato:

1. grammatica e pattern ricorrenti;
2. lessico giapponese riusabile in più frasi o media;
3. kanji e composti che migliorano la lettura generale;
4. label di sistema davvero ricorrenti;
5. solo dopo, termini molto verticali ma strutturali nel corpus.

Esempio di criterio:

- `わざ` in Pokemon ha buon valore flashcard perché è giapponese ricorrente e
  riusabile;
- una sigla di evento o un acronimo di prodotto può meritare spiegazione nel
  textbook, ma di default non merita memoria attiva.

## 4. Struttura minima di una spiegazione buona

Quando spieghi un elemento, usa se possibile questa sequenza:

1. forma giapponese;
2. significato letterale o tecnico;
3. funzione concreta nel media;
4. contrasto con l'errore di lettura più probabile.

Per effetti, rules text, pulsanti o prompt, esplicita sempre almeno alcuni di
questi punti:

- chi agisce;
- su che bersaglio;
- in quale timing o condizione;
- con quale risultato;
- quale decisione pratica sblocca.

## 5. Frasi da rifiutare

Queste formule non bastano da sole:

- `È importante ricordare questa cosa.`
- `Questo termine è utile da fissare.`
- `Qui c'è un concetto importante.`
- `Questa schermata è molto utile.`
- `Questa keyword è una buona ancora mentale.`

Versione accettabile:

- `X vuol dire Y; qui ti segnala Z.`
- `X non indica A ma B; per questo quando lo leggi devi fare C.`
- `Il pattern lega questa condizione a questo effetto; senza quel pezzo la
  frase viene letta male.`

## 6. Checklist editoriale minima

Prima di chiudere un batch, verifica:

- ogni paragrafo del textbook trasmette informazione concreta, non solo
  valutazione;
- i termini verticali necessari alla comprensione o all'interazione corretta
  con il media sono spiegati anche se non diventano flashcard;
- anche quando spieghi il media o la meccanica, il bersaglio primario resta il
  giapponese e non il game design in astratto;
- le flashcard selezionate hanno vero valore linguistico e buona spendibilità;
- non stai sprecando card su sigle, acronimi, nomi interni o dettagli che non
  costruiscono literacy;
- il contenuto spiega insieme giapponese e funzione nel media;
- semplicità di forma non ha ridotto la quantità di concetti utili trasmessi.

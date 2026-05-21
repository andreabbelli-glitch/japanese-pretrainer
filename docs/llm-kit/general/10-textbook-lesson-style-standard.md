# Standard Stile Lesson Textbook

## Fonte modello

La lezione modello per questo standard è:

- `content/media/pokemon-scarlet-violet/textbook/029-sv-prestudy-l19b-reazioni-e-parlato-scarlet-violet.md`

Quella pagina diventa il riferimento editoriale per il modo in cui una lesson
deve essere scritta: voce, ritmo, qualità delle spiegazioni e capacità di far
vedere il giapponese in funzione. Non è una scaletta minima, non è una lista di
gloss, ma una spiegazione guidata che collega forma giapponese, scena, funzione
e decisione pratica.

## Principio

Una buona lesson fa sentire il testo giapponese come un sistema leggibile.

Ogni elemento deve essere spiegato dentro un contesto riconoscibile:

- che forma giapponese sto guardando;
- che cosa significa davvero;
- dove compare nel media;
- quale lettura sbagliata evita;
- che cosa mi permette di capire, scegliere o prevedere.

Il tono deve essere didattico, concreto e naturale. La pagina parla al lettore
che sta per giocare, leggere o guardare quel media, non al reviewer del batch.

## Voce Editoriale

La voce standard è quella di un tutor competente che sta leggendo il media
insieme all'utente.

Caratteristiche da imitare:

- frasi in italiano naturale, con ritmo da spiegazione orale rifinita;
- tono diretto ma non telegrafico;
- densità alta: ogni frase aggiunge significato, contrasto o contesto;
- seconda persona usata con misura quando aiuta l'azione del lettore
  (`quando vedi...`, `quando leggi...`, `preparati a...`);
- lessico tecnico solo quando serve, subito aperto in parole semplici;
- collegamenti espliciti tra pezzi diversi della lingua, non paragrafi
  autosufficienti e isolati.

La spiegazione deve sembrare scritta per far scattare riconoscimento durante la
fruizione reale del media. Evita sia il tono da manuale grammaticale astratto,
sia il tono da scheda enciclopedica.

### Metadiscorso Didattico E Metadiscorso Editoriale

La lezione modello contiene una frase come "In questa lezione analizzeremo...".
Quel tipo di promessa didattica leggera è accettabile quando serve a orientare
il lettore e viene subito seguito dal valore concreto di lettura.

Resta invece vietato il metadiscorso editoriale o di workflow:

- batch, seed, review, card canoniche, validazione, fonte come processo;
- giustificazioni del tipo "questo elemento merita una flashcard";
- commenti sulla pagina come oggetto invece che sul giapponese;
- frasi che spiegano perché il contenuto è stato scelto invece di aprire la
  forma giapponese.

Regola pratica: una frase meta è ammessa solo se suona come un tutor che
prepara l'attenzione del lettore. È da riscrivere se suona come un curatore che
spiega il proprio lavoro.

### Qualità Della Spiegazione

Una spiegazione forte non si ferma alla traduzione. Fa vedere perché quella
forma è costruita così e che cosa cambia quando la incontri.

Schema mentale da seguire:

1. nomina la forma giapponese;
2. apri il pezzo che la rende leggibile;
3. dai il valore italiano o tecnico;
4. collocala nella scena o nella UI;
5. sciogli l'ambiguità o il falso amico più probabile.

Esempio di qualità attesa:

- `{{受|う}}ける` non è solo "ricevere": in battaglia descrive anche chi
  subisce un attacco o un effetto. Quindi in una frase con `わざを受ける`, il
  focus non è ottenere qualcosa, ma essere il bersaglio dell'azione.

Esempio debole:

- `{{受|う}}ける` significa ricevere ed è utile nei dialoghi e nelle battaglie.

Il primo esempio insegna un comportamento di lettura. Il secondo dà una gloss e
un giudizio, ma non cambia il modo in cui l'utente leggerà la frase.

## Struttura Standard

Usa questa struttura come default per nuove lesson e riscritture sostanziali.
Puoi adattare i titoli alle esigenze del media, ma non tornare alla forma
sterile `Obiettivo / Contesto / Spiegazione` quando la lesson ha materiale
abbastanza ricco da organizzare tematicamente.

```md
# <Titolo naturale centrato sul tipo di lettura>

<Introduzione breve e naturale: quali situazioni del media diventano leggibili
e perché questo blocco di giapponese conta mentre l'utente fruisce il
contenuto.>

## Termini chiave

- [<termine>](term:<id>) — <gloss breve>

## Espressioni ricorrenti

- [<chunk o formula>](term:<id>) — <funzione breve>

## Pattern grammaticali chiave

- [<pattern>](grammar:<id>) — <valore breve>

## Etichette da riconoscere

- [<label o nome contestuale>](term:<id>) — <ruolo breve>

---

## 1. <Cluster tematico orientato alla scena>

<Spiegazione per gruppi: non elenco alfabetico, ma parole e pattern che
funzionano insieme nella stessa scena, schermata, carta o dialogo. La prosa deve
accompagnare il lettore: spiega il giapponese mentre descrive ciò che accade nel
media.>

:::example_sentence
jp: >-
  <frase giapponese>
translation_it: >-
  <traduzione italiana>
:::

#### Anatomia della frase

- `<pezzo>` -> <ruolo grammaticale e conseguenza di lettura>

> [!NOTE]
> **Contrasto:** <differenza che evita una lettura sbagliata>

## Esempi guidati di riepilogo

<2-4 frasi che ricombinano gli elementi principali.>

## Nota finale

<Chiusura breve che collega i cluster e dice come riconoscere il sistema in
contesto reale.>
```

## Componenti Obbligatori

### 1. Apertura Contestuale

La prima sezione deve orientare il lettore dentro il media. Può usare una
promessa didattica leggera, ma deve dire che cosa succede nel gioco, nella
scena, nella carta o nell'interfaccia e quale tipo di giapponese diventa
leggibile. L'effetto deve essere narrativo-pratico: il lettore capisce perché
quei termini gli serviranno tra poco.

Forma buona:

- `Nei dialoghi di conferma il gioco alterna ricezione, scelta e conseguenza.`
- `Nel rules text, la condizione arriva prima dell'effetto e decide il timing.`

Forma debole:

- `Questa lesson copre alcuni termini importanti.`
- `In questa pagina vedremo parole utili.`

### 2. Inventario Prima della Spiegazione

Subito dopo l'introduzione, elenca le entry che verranno usate:

- `Termini chiave` per vocaboli e label;
- `Espressioni ricorrenti` per formule, chunk e messaggi UI;
- `Pattern grammaticali chiave` per grammatica;
- `Etichette da riconoscere` per nomi propri, luoghi, tipi o label contestuali
  che servono a leggere la scena ma non sempre meritano una flashcard.

Ogni riga deve avere gloss breve e link semantico quando l'entry esiste.
Questo inventario è una mappa, non la spiegazione completa.

### 3. Cluster Tematici

Il corpo deve raggruppare gli elementi per funzione reale, non per tipo di
entry o ordine casuale.

Esempi di cluster:

- scuola ed esplorazione;
- tipi elementali e cautela in battaglia;
- messaggi di sistema: ricevere, scegliere, connettersi;
- sfumature di parlato: desiderio, invito, constatazione;
- condizione, bersaglio, timing e payoff di una carta;
- navigazione UI, conferma, filtro e risultato.

Dentro ogni cluster, spiega come i termini interagiscono. Una parola non va
solo tradotta: va messa nel suo frame naturale.

La prosa deve alternare:

- frase di orientamento: colloca il problema di lettura;
- micro-spiegazione: apre forma, chunk, particella o pattern;
- conseguenza: dice che cosa cambia nel media;
- contrasto: elimina la lettura sbagliata più probabile.

### 4. Micro-Spiegazioni Dense

Per ogni termine o pattern importante, la spiegazione deve contenere almeno tre
di questi elementi:

- forma visibile giapponese;
- scomposizione utile di kanji, kana, particelle o chunk;
- valore letterale o tecnico;
- collocazione naturale;
- funzione nel media;
- contrasto con una lettura sbagliata;
- conseguenza pratica per il lettore.

La scomposizione non deve diventare falsa etimologia. Se usi un gancio
mnemonico, dichiaralo come trucco di memoria quando non è etimologia reale.

Il linguaggio deve restare concreto. Preferisci:

- `ti segnala che il gioco sta chiedendo una selezione`;
- `marca l'oggetto che entra nell'inventario`;
- `sposta il tono da ordine a invito a provare`;
- `rende la frase una constatazione ad alta voce`.

Evita:

- `è una parola importante`;
- `è utile da ricordare`;
- `aiuta a orientarsi`;
- `è un concetto centrale`;
- `è interessante perché ricorre spesso`.

Quelle frasi possono comparire solo se sono subito seguite dal meccanismo
linguistico che le rende vere.

### 5. Ritmo E Transizioni

Le lesson modello non saltano bruscamente da una definizione all'altra. Ogni
sezione deve avere transizioni brevi che spiegano perché il gruppo successivo
esiste.

Esempi di transizione buona:

- `Quando il dialogo lascia la scuola e passa ai menu, le formule diventano più stabili.`
- `In battaglia, la stessa idea di "ricevere" cambia ruolo: non è un premio, è un effetto subito.`
- `Dopo i messaggi di sistema, il parlato dei personaggi aggiunge desiderio, invito e tono.`

Esempi da evitare:

- `Passiamo ora ai prossimi termini.`
- `Vediamo altri esempi.`
- `Questa sezione tratta la grammatica.`

### 6. Anatomia Della Frase

Quando compare una frase giapponese, aggiungi una mini-analisi subito dopo se
la frase contiene grammatica, particelle o composizione utile.

Usa il blocco:

```md
#### Anatomia della frase

- `レシピを` -> oggetto diretto: `レシピ` + `を`.
- `{{受|う}}けとりました` -> azione conclusa: ricevere e prendere in consegna.
```

La funzione dell'anatomia è far vedere il parsing. Non deve limitarsi a ripetere
la traduzione italiana.

### 7. Contrasti Espliciti

Usa callout `NOTE` o `WARNING` quando una distinzione evita un errore reale:

- una parola comune diversa dal termine tecnico del gioco;
- una forma colloquiale diversa da un comando;
- un pattern simile con forza pragmatica diversa;
- un katakana apparentemente trasparente ma con ruolo di UI specifico;
- una lettura grammaticale che cambia dopo verbi, nomi o aggettivi.

Il contrasto deve essere operativo: dopo averlo letto, l'utente deve sapere
come scegliere la lettura corretta.

### 8. Esempi Di Riepilogo

Chiudi con esempi guidati che ricombinano gli elementi principali in frasi
nuove o reali. Il riepilogo non deve essere un elenco di definizioni: deve far
vedere come il lessico e la grammatica lavorano insieme.

## Immagini

Questo standard non cambia il workflow immagini.

- Se un'immagine reale esiste già sotto `assets/`, inserisci un blocco
  `:::image` nel punto in cui aiuta davvero la spiegazione.
- Se l'immagine servirebbe ma non esiste ancora, non inventare `src`: crea o
  aggiorna `workflow/image-requests.yaml`.
- Le caption seguono lo stesso standard del testo: spiegano quale label, stato
  o contrasto diventa leggibile, non dicono genericamente che l'immagine è
  utile.
- Una lesson senza immagini può essere accettabile sul piano testuale, ma non
  deve diventare il nuovo ideale quando screenshot, card art o crop UI
  renderebbero più concreta la spiegazione.

## Cosa Non Fare

- Non usare sezioni generiche `Obiettivo`, `Contesto`, `Spiegazione` come unico
  impianto quando il materiale permette cluster tematici.
- Non scrivere una lista di termini seguita da paragrafi separati senza
  relazione.
- Non dire che una parola è utile o importante senza aprire forma e funzione.
- Non parlare del batch, del workflow, della review o della pagina come oggetto
  editoriale; una promessa didattica breve è ammessa solo se orienta la lettura.
- Non trasformare il media in una guida al gioco separata dalla lingua.
- Non creare esempi che definiscono la parola invece di usarla.
- Non confondere ganci mnemonici con etimologia.
- Non scrivere con tono da outline generico: `X significa Y. X è utile.`
- Non lasciare frasi valutative senza meccanismo linguistico.
- Non appiattire tutto in sezioni brevi e isolate quando il materiale chiede
  una spiegazione progressiva.

## Checklist Di Review

Una lesson segue questo standard solo se:

- l'introduzione aggancia una situazione reale del media;
- l'inventario iniziale espone termini, espressioni e pattern da riconoscere;
- il corpo è organizzato in cluster funzionali;
- la voce è naturale, densa e tutor-like, non schematica;
- ogni spiegazione importante collega forma giapponese, significato e funzione;
- ogni passaggio valutativo è sostenuto da parsing, collocazione o contrasto;
- le frasi giapponesi più dense hanno anatomia esplicita;
- i contrasti più rischiosi sono dichiarati con esempi;
- gli esempi finali ricombinano davvero il materiale;
- eventuali immagini seguono il workflow asset esistente;
- la pagina non contiene metadiscorso editoriale.

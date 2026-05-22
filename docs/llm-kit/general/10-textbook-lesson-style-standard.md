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

### Metadiscorso didattico e metadiscorso editoriale

La lezione deve aprire direttamente su scena, schermata, carta o dialogo. Non
usare formule meta come "in questa lezione analizzeremo", "questa pagina
spiega" o "qui vedremo": anche quando sono rivolte al learner, fanno sentire la
lesson come un oggetto di corso invece che come una lettura guidata del media.

Resta vietato anche il metadiscorso editoriale o di workflow:

- batch, seed, review, card canoniche, validazione, fonte come processo;
- giustificazioni del tipo "questo elemento merita una flashcard";
- commenti sulla pagina come oggetto invece che sul giapponese;
- frasi che spiegano perché il contenuto è stato scelto invece di aprire la
  forma giapponese.

Regola pratica: se una frase parla della lesson, della pagina o del processo di
studio, riscrivila come descrizione del testo reale. Preferisci riferimenti
concreti al media: `dialoghi della scena`, `messaggi della schermata`, `effetti
della carta`, `istruzioni del menu`, `battute del personaggio`.

Questa regola non vieta termini reali del media. Se una UI parla davvero di
`デッキコード`, deck, deckbuilder o simili, puoi e devi spiegare quel termine.
Il divieto riguarda solo il metadiscorso sul sistema di studio: deck di studio,
flashcard, review, batch, workflow, curation e motivazioni editoriali non
devono entrare nella prosa learner-facing.

### Qualità della spiegazione

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
  subisce un attacco o un effetto. Quindi in una frase con
  `わざを{{受|う}}ける`, il
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

### Titoli, frontmatter e stabilità

Quando riscrivi una lesson esistente, preserva i campi identitari stabili del
frontmatter: `id`, `media_id`, `slug`, `order`, `segment_ref`, `difficulty`,
`status`, `tags` e `prerequisites`, salvo richiesta esplicita o migrazione
dedicata.

Il campo `title` non è identità tecnica: è visibile all'utente. Se la lesson
aveva un titolo da batch, seed o workflow (`SV Pre-study L20A`, `SV Anki L18`,
`Keyword Effects Bank`), riscrivilo in un titolo naturale, sentence case e
centrato sulla lettura reale, allineato all'H1 ma abbastanza breve per l'UI.

Titoli H1 e heading italiani devono usare sentence case, non Title Case
all'inglese. Mantieni maiuscoli solo nomi propri, acronimi, product label e
termini ufficiali del media.

- corretto: `# Dal dormitorio al Treasure Hunt: la scuola apre Paldea`
- da correggere: `# Dal Dormitorio al Treasure Hunt: la Scuola Apre Paldea`
- corretto: `## 3. Champion Rank: quando Nemona definisce una route`
- da correggere: `## 3. Champion Rank: quando Nemona Definisce una Route`

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

#### 🗺️ Anatomia della frase

*   `<pezzo>` ➔ **<Ruolo grammaticale>** (<conseguenza di lettura concreta>).

#### ⚖️ Contrasto operativo

<differenza che evita una lettura sbagliata>

#### 🧠 Gancio cognitivo

<trucco mnemonico dichiarato come tale>

## Esempi guidati di riepilogo

<2-4 frasi che ricombinano gli elementi principali.>

## Nota finale

<Chiusura breve che collega i cluster e dice come riconoscere il sistema in
contesto reale.>
```

### Sequenza Meccanica Attesa

Quando il materiale è abbastanza ricco, la sequenza del body dovrebbe essere
questa:

1. H1 naturale centrato sulla lettura reale.
2. Apertura contestuale in 1-2 paragrafi.
3. Inventario iniziale: `Termini chiave`, `Espressioni ricorrenti`,
   `Pattern grammaticali chiave`, `Etichette da riconoscere` quando pertinenti.
4. Separatore `---` prima del corpo didattico.
5. Eventuali `:::image` solo dopo il separatore, nel cluster in cui l'immagine
   serve davvero.
6. Cluster tematici numerati.
7. Dentro i cluster: mini-spiegazioni in bullet lunghi o sottosezioni A/B/C/D
   quando il materiale contiene più sfumature.
8. `:::example_sentence` per frasi che meritano traduzione e parsing.
9. `#### 🗺️ Anatomia della frase` subito dopo gli esempi densi; se due esempi
   consecutivi introducono pattern diversi, ciascuno deve avere il proprio
   parsing prima del contrasto o dell'esempio successivo.
10. Blocco `#### ⚖️ Contrasto operativo` per errori probabili.
11. Blocco o bullet `🧠 Gancio cognitivo` per ancore mnemoniche utili.
12. `Esempi guidati di riepilogo` con frasi che ricombinano i pezzi.
13. `Nota finale` breve che collega i cluster.

Questa sequenza è preferita, non cieca. Se una lesson è molto breve, puoi
accorparla, ma non devi tornare a una lista di gloss.

### Grammatica Visiva Dei Blocchi

La 029 usa una grammatica visiva riconoscibile. Le nuove lesson dovrebbero
imitare quel segnale visivo quando aiuta la scansione:

- `#### 🗺️ Anatomia della frase` per parsing frase-per-frase;
- `🧠 Gancio cognitivo` per immagini mentali o trucchi di memoria;
- `⚖️ Contrasto operativo` per false piste, falsi amici o pattern simili;
- sottosezioni `A/B/C/D` quando una sezione grammaticale contiene sfumature
  distinte;
- bullet lunghi per spiegare un termine senza spezzare artificiosamente forma,
  funzione e conseguenza.

Gli emoji sono marker consigliati, non decorazione obbligatoria. Usali quando
rendono immediatamente riconoscibile il tipo di blocco; omettili se il media o
il tono della pagina ne risentono.

## Componenti Obbligatori

### 1. Apertura Contestuale

La prima sezione deve orientare il lettore dentro il media senza parlare della
lesson. Apri su ciò che succede nel gioco, nella scena, nella carta o
nell'interfaccia e su quale tipo di giapponese diventa leggibile. L'effetto
deve essere narrativo-pratico: il lettore capisce perché quei termini gli
serviranno tra poco.

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
Questo inventario è una mappa, non la spiegazione completa. La forma meccanica
preferita è sempre `- [label](term:id) — gloss breve`: label, dash e inizio
della gloss stanno sulla stessa riga della bullet. Se il testo va a capo, il
wrap continua la gloss, non sposta il dash su una riga successiva.

Ogni voce inventariata deve riapparire nel body come parte di una spiegazione,
un esempio, un'anatomia o un riepilogo con lo stesso link semantico. Se una
voce resta solo una label di contesto e non insegna un comportamento di lettura,
eliminala dall'inventario invece di lasciarla come catalogo.

Se l'entry ha una flashcard associata e il label contiene kanji, il label deve
portare furigana direttamente nel link, sia nell'inventario sia nelle
spiegazioni successive. Scrivi `[{{終了|しゅうりょう}}](term:...)`, non
`[終了](term:...)`: il reader non deve dipendere dal tooltip o dalla card front
per conoscere la lettura del target che sta imparando.

Non mettere mai un link semantico Markdown dentro un code span. Sbagliato:
`` `[{{報酬|ほうしゅう}}](term:term-reward)を` ``. Corretto:
`[{{報酬|ほうしゅう}}](term:term-reward)を` oppure `{{報酬|ほうしゅう}}` in code
span senza link quando non serve il riferimento. Se devi combinare code span e
link, spezza la frase in pezzi adiacenti.

I furigana devono essere reader-friendly, non solo validi per il parser:

- non usare letture con puntini dentro un ruby, tipo
  `{{目的地|もく.てき.ち}}`;
- spezza i composti in blocchi semantici leggibili:
  `{{目的|もくてき}}{{地|ち}}`, `{{課外|かがい}}{{授業|じゅぎょう}}`,
  `{{学生|がくせい}}{{寮|りょう}}`;
- non spezzare tutto kanji-per-kanji quando il composto naturale sarebbe piu
  chiaro: `{{言語|げんご}}{{学|がく}}`,
  `{{課外|かがい}}{{授業|じゅぎょう}}`,
  `{{興味|きょうみ}}{{深|ぶか}}い`, non
  `{{言|げん}}{{語|ご}}{{学|がく}}`,
  `{{課|か}}{{外|がい}}{{授|じゅ}}{{業|ぎょう}}` o
  `{{興|きょう}}{{味|み}}{{深|ぶか}}い`;
- non mettere furigana su katakana puro: `ポケモン`, `チャンピオンランク`,
  `デッキコード` restano testo normale o link semantico senza ruby;
- verifica le letture invece di ricostruirle a intuito, soprattutto con forme
  contestuali come `{{来|き}}た`, `{{待機中|たいきちゅう}}` o contatori.

### 3. Cluster tematici

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

### 5. Sottosezioni e bullet lunghi

La lezione modello non riduce tutto a paragrafi uniformi. Usa anche:

- bullet lunghi quando un termine richiede gloss, scomposizione, funzione e
  gancio nello stesso punto;
- sottosezioni `A/B/C/D` per sfumature grammaticali vicine ma distinte;
- callout vicino al punto spiegato, non tutti raccolti in fondo.

Questa varietà dà respiro alla pagina: il lettore vede subito se sta leggendo
un termine, un pattern, un contrasto o un riepilogo.

### 6. Ritmo e transizioni

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

### 7. Anatomia della frase

Quando compare una frase giapponese, aggiungi una mini-analisi subito dopo se
la frase contiene grammatica, particelle o composizione utile.

Usa il blocco:

```md
#### 🗺️ Anatomia della frase

*   `レシピを` ➔ **Oggetto diretto** (`レシピ` + `を`).
*   `{{受|う}}けとりました` ➔ **Azione conclusa** (ricevere e prendere in
    consegna).
```

La funzione dell'anatomia è far vedere il parsing. Non deve limitarsi a ripetere
la traduzione italiana.

Ogni `:::example_sentence` che contiene un pattern grammaticale, una frase UI
densa o un contrasto di lettura deve essere seguito da un'anatomia. Puoi
ometterla solo per esempi di riepilogo molto brevi e trasparenti, oppure quando
il punto e gia stato appena analizzato nello stesso cluster.

### 8. Contrasti Espliciti

Usa callout `NOTE` o `WARNING` quando una distinzione evita un errore reale:

- una parola comune diversa dal termine tecnico del gioco;
- una forma colloquiale diversa da un comando;
- un pattern simile con forza pragmatica diversa;
- un katakana apparentemente trasparente ma con ruolo di UI specifico;
- una lettura grammaticale che cambia dopo verbi, nomi o aggettivi.

Il contrasto deve essere operativo: dopo averlo letto, l'utente deve sapere
come scegliere la lettura corretta.

### 9. Esempi di riepilogo

Chiudi con esempi guidati che ricombinano gli elementi principali in frasi
nuove o reali. Il riepilogo non deve essere un elenco di definizioni: deve far
vedere come il lessico e la grammatica lavorano insieme.

## Immagini

Questo standard non cambia il workflow immagini.

- Se un'immagine reale esiste già sotto `assets/`, inserisci un blocco
  `:::image` nel punto in cui aiuta davvero la spiegazione.
- Non mettere mai `:::image` prima dell'introduzione, degli inventari e del
  separatore `---`: il primo punto legale è dopo il separatore, idealmente
  dentro il cluster che usa quella immagine.
- Se l'immagine servirebbe ma non esiste ancora, non inventare `src`: crea o
  aggiorna `workflow/image-requests.yaml`.
- Le caption seguono lo stesso standard del testo: spiegano quale label, stato
  o contrasto diventa leggibile, non dicono genericamente che l'immagine è
  utile.
- Una lesson senza immagini può essere accettabile sul piano testuale, ma non
  deve diventare il nuovo ideale quando screenshot, card art o crop UI
  renderebbero più concreta la spiegazione.

## Esempi didattici e fedeltà al testo

Gli esempi possono essere frasi reali, frasi lievemente normalizzate o frasi
didattiche costruite sul contesto. Se non sono transcript puntuali, non
presentarli come citazioni ufficiali della scena. Devono però restare
linguisticamente naturali, contenere davvero il target che stai spiegando e
non aggiungere lore, motivazioni o dettagli che il giapponese non sostiene.

Per lesson molto compatte di UI, web o schermata singola, trasferisci lo
standard senza gonfiare artificialmente il contenuto: meno cluster, più focus
su azione reale, oggetto, particella, conferma, pulsante e contrasto operativo.
La forma resta quella della lesson modello, ma il respiro deve rispettare la
densità del materiale.

## Cosa non fare

- Non usare sezioni generiche `Obiettivo`, `Contesto`, `Spiegazione` come unico
  impianto quando il materiale permette cluster tematici.
- Non scrivere una lista di termini seguita da paragrafi separati senza
  relazione.
- Non dire che una parola è utile o importante senza aprire forma e funzione.
- Non parlare del batch, del workflow, della review, della pagina o della
  lesson come oggetto; apri direttamente sul media e sul giapponese leggibile.
- Non trasformare il media in una guida al gioco separata dalla lingua.
- Non creare esempi che definiscono la parola invece di usarla.
- Non confondere ganci mnemonici con etimologia.
- Non scrivere con tono da outline generico: `X significa Y. X è utile.`
- Non lasciare frasi valutative senza meccanismo linguistico.
- Non appiattire tutto in sezioni brevi e isolate quando il materiale chiede
  una spiegazione progressiva.
- Non lasciare nel `title` frontmatter etichette da batch, seed o workflow:
  `title` è learner-facing e deve sembrare una lesson, non un job editoriale.
- Non usare Title Case nei titoli italiani.
- Non usare furigana con puntini o ruby su katakana puro.
- Non spezzare kanji-per-kanji i composti lessicali naturali.
- Non far sembrare gli esempi didattici citazioni reali quando sono frasi
  costruite per insegnare il pattern.

## Checklist di review

Una lesson segue questo standard solo se:

- l'introduzione aggancia una situazione reale del media;
- l'inventario iniziale espone termini, espressioni e pattern da riconoscere;
- la sequenza del body segue il flusso atteso, salvo ragioni concrete;
- il corpo è organizzato in cluster funzionali;
- la voce è naturale, densa e tutor-like, non schematica;
- la grammatica visiva dei blocchi rende riconoscibili anatomia, ganci e
  contrasti quando presenti;
- ogni spiegazione importante collega forma giapponese, significato e funzione;
- ogni passaggio valutativo è sostenuto da parsing, collocazione o contrasto;
- le frasi giapponesi più dense hanno anatomia esplicita;
- i contrasti più rischiosi sono dichiarati con esempi;
- gli esempi finali ricombinano davvero il materiale;
- eventuali immagini seguono il workflow asset esistente;
- la pagina non contiene metadiscorso editoriale;
- i campi frontmatter identitari sono rimasti invariati nelle riscritture;
- il `title` frontmatter è naturale, learner-facing e non contiene label di
  batch o workflow;
- H1 e heading italiani sono in sentence case;
- i furigana sono senza puntini, senza ruby su katakana puro e con letture
  verificate;
- gli esempi costruiti sono riconoscibili come didattici, non come transcript.

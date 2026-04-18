# Brief Contenuti - Web giapponese

## Scopo

Media di studio dedicato a pagine web giapponesi reali consultate durante uso
quotidiano di siti, guide, tier list, wiki, portali ufficiali e strumenti
operativi.

L'obiettivo non e studiare il sito come prodotto, ma il giapponese che serve
per:

- orientarsi nella navigation;
- leggere box, filtri, tab, badge e menu;
- capire testo operativo, riassunti, criteri, tabelle e label ricorrenti;
- fissare lessico riusabile e pattern grammaticali che ricompaiono nel web
  giapponese reale.

## Fonte primaria

La fonte primaria e la pagina renderizzata nel browser.

Priorita:

- testo davvero visibile a schermo;
- disposizione visiva che chiarisce il ruolo di label, sezioni e CTA;
- screenshot orientativi e crop mirati nei punti spiegati nel textbook.

Il sorgente HTML o il testo copiato possono aiutare, ma non devono sostituire
la pagina vista davvero dall'utente.

## Unita didattica

- il media tecnico e `web-giapponese`;
- ogni sito e una sezione logica del media;
- ogni lesson reale corrisponde a una singola pagina web;
- l'ordine delle lesson segue l'ordine di acquisizione reale;
- non creare lesson overview artificiali di un sito: la default unit resta la
  pagina concreta.

## Obiettivo didattico

Ogni pagina deve insegnare prima di tutto giapponese leggibile e riusabile:

- lessico UI frequente;
- chunk operativi di navigazione, filtro e confronto;
- pattern grammaticali che aiutano a leggere testo compatto del web;
- parole estremamente comuni o fino a N3 che il learner puo reincontrare anche
  in altri media.

I termini molto verticali del singolo sito vanno trattati cosi:

- textbook/glossary si, quando servono a capire davvero la pagina;
- flashcard solo su richiesta esplicita dell'utente;
- non promuoverli automaticamente a review solo perche appaiono spesso in una
  stessa schermata.

## Politica flashcard

- coprire sempre i seed terms o seed phrases richiesti dall'utente;
- aggiungere al massimo 5 card extra automatiche;
- le extra devono essere N5-N3 oppure estremamente comuni e davvero utili;
- se una parola esiste gia in altri media, creare una nuova entry locale solo
  quando qui cambia davvero la sfumatura d'uso;
- quando il legame cross-media e certo, usare `cross_media_group`;
- se la sfumatura locale cambia davvero, renderlo esplicito in `notes_it`;
- gli `example_jp` vanno presi dalla pagina solo quando la frase completa resta
  leggibile col corpus gia coperto; altrimenti scrivere esempi semplificati ma
  fedeli al contesto della pagina.
- se la entry e stata estratta da una locuzione piu lunga e da sola non
  compare in modo autonomo nella pagina, scrivere una frase nuova ma naturale
  che usi bene la entry nel dominio del sito.
- gli `example_jp` devono mostrare uso vivo, non spiegare la parola: vietate
  frasi meta-lessicali come `XにYがつくと...`, `XはYの意味`,
  `Xという言葉は...`; la spiegazione della composizione va in `notes_it`, non
  in `example_jp`.

## Politica immagini

Per ogni pagina reale:

- una snapshot generale orientativa;
- crop mirati solo nei punti che il textbook spiega davvero;
- i crop servono a mostrare label, navbar, filtri, tab, box risultati, tabelle
  o altri target richiesti dall'utente;
- salvare gli asset sotto `assets/` e mantenere allineati
  `workflow/image-requests.yaml` e `workflow/image-assets.yaml`.

## Convenzioni consigliate

- media tecnico: `media-web-giapponese` / `web-giapponese`
- `media_type: web`
- `segment_kind: site`
- sezione-sito: slug stabile `dominio + area tematica` quando serve distinguere
  porzioni diverse dello stesso dominio grande
- lesson: una pagina reale per file
- entry canoniche preferibilmente nei file `cards/`

## Batch tipico

Per una singola pagina:

- `content/media/web-giapponese/textbook/<ordine>-<page-slug>.md`
- `content/media/web-giapponese/cards/<ordine>-<page-slug>.md`
- eventuali asset sotto `content/media/web-giapponese/assets/...`
- aggiornamento di `workflow/image-requests.yaml`
- aggiornamento di `workflow/image-assets.yaml`
- validazione del repo con i comandi canonici
- fetch dei pitch accent del media con
  `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese`
- import incrementale nel DB target con
  `./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese`

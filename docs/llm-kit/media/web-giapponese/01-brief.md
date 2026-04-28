# Brief Contenuti - Giapponese random

## Scopo

Media di studio dedicato a frammenti giapponesi reali incontrati durante uso
quotidiano: pagine web, guide, wiki, UI di giochi, app, TCG, screenshot,
dialoghi tutoriali e strumenti operativi.

L'obiettivo non e studiare la fonte come prodotto, ma il giapponese che serve
per:

- orientarsi nella navigation;
- leggere box, filtri, tab, badge, menu, prompt e finestre tutorial;
- capire testo operativo, riassunti, criteri, tabelle, label ricorrenti e
  piccoli dialoghi;
- fissare lessico riusabile e pattern grammaticali che ricompaiono nel
  giapponese reale incontrato fuori dai media gia strutturati.

## Fonte primaria

La fonte primaria e l'item concreto visto dall'utente.

Puo essere:

- una pagina renderizzata nel browser;
- uno screenshot locale o allegato;
- testo copiato da una schermata, carta, guida o UI;
- una piccola sequenza di schermate quando il significato dipende dal flow.

Priorita:

- testo davvero visibile a schermo;
- disposizione visiva che chiarisce il ruolo di label, sezioni, CTA, prompt o
  finestra di dialogo;
- screenshot orientativi e crop mirati nei punti spiegati nel textbook.

HTML, OCR o trascrizione possono aiutare, ma non devono sostituire l'item
visibile realmente fornito o ispezionato.

## Unita didattica

- il media tecnico resta `web-giapponese` per stabilita di slug, ID e route;
- il media visibile e `Giapponese random`;
- ogni fonte, gioco, app o famiglia di item e una sezione logica del media;
- ogni lesson reale corrisponde a un item concreto: pagina, screenshot,
  schermata, prompt, carta, rules panel o piccolo flow;
- l'ordine delle lesson segue l'ordine di acquisizione reale;
- non creare lesson overview artificiali di una fonte: la default unit resta
  l'item concreto.

## Obiettivo didattico

Ogni item deve insegnare prima di tutto giapponese leggibile e riusabile:

- lessico UI frequente;
- chunk operativi di navigazione, filtro e confronto;
- pattern grammaticali che aiutano a leggere testo compatto di UI, guide,
  tutorial e rules text;
- parole estremamente comuni o fino a N3 che il learner puo reincontrare anche
  in altri media.

I termini molto verticali della singola fonte vanno trattati cosi:

- textbook/glossary si, quando servono a capire davvero l'item;
- flashcard solo su richiesta esplicita dell'utente;
- non promuoverli automaticamente a review solo perche appaiono spesso in una
  stessa schermata.

## Politica flashcard

- coprire sempre i seed terms o seed phrases richiesti dall'utente;
- aggiungere al massimo 5 card extra automatiche;
- le extra devono essere N5-N3 oppure estremamente comuni e davvero utili;
- se una parola esiste gia in altri media, crea comunque l'occorrenza locale
  quando questo item introduce una sfumatura, un esempio o una card utile;
- quando una flashcard allena una frase UI o un chunk piu lungo, `entry_id`
  deve puntare a una entry dedicata a quella superficie completa, non al lemma
  interno piu corto;
- l'importer unisce automaticamente glossary/review per superficie
  normalizzata; `cross_media_group` e solo metadata documentativo opzionale;
- se la sfumatura locale cambia davvero, renderlo esplicito in `notes_it`;
- gli `example_jp` vanno presi dalla fonte solo quando la frase completa resta
  leggibile col corpus gia coperto; altrimenti scrivere esempi semplificati ma
  fedeli al contesto dell'item.
- se la entry e stata estratta da una locuzione piu lunga e da sola non
  compare in modo autonomo nella fonte, scrivere una frase nuova ma naturale
  che usi bene la entry nel dominio della fonte.
- gli `example_jp` devono mostrare uso vivo, non spiegare la parola: vietate
  frasi meta-lessicali come `XにYがつくと...`, `XはYの意味`,
  `Xという言葉は...`; la spiegazione della composizione va in `notes_it`, non
  in `example_jp`.

## Politica immagini

Per ogni item reale:

- una snapshot generale orientativa o lo screenshot fornito dall'utente;
- crop mirati solo nei punti che il textbook spiega davvero;
- i crop servono a mostrare label, navbar, filtri, tab, box risultati, tabelle,
  finestre di dialogo, prompt o altri target richiesti dall'utente;
- salvare gli asset sotto `assets/` e mantenere allineati
  `workflow/image-requests.yaml` e `workflow/image-assets.yaml`.

## Convenzioni consigliate

- media tecnico: `media-web-giapponese` / `web-giapponese`
- media visibile: `Giapponese random`
- `media_type: random`
- `segment_kind: segment`
- `segment_ref`: slug stabile della fonte o area, per esempio
  `appmedia-starsavior`, `dmps-takaratomy-deckbuilder`,
  `puzzle-and-dragons`
- lesson: un item reale per file
- entry canoniche preferibilmente nei file `cards/`

## Batch tipico

Per un singolo item:

- `content/media/web-giapponese/textbook/<ordine>-<page-slug>.md`
- `content/media/web-giapponese/cards/<ordine>-<page-slug>.md`
- eventuali asset sotto `content/media/web-giapponese/assets/...`
- aggiornamento di `workflow/image-requests.yaml`
- aggiornamento di `workflow/image-assets.yaml`
- validazione mirata del bundle con i comandi canonici della skill/workflow
- fetch dei pitch accent solo per le flashcard create o riviste, preferendo gli
  ID entry:
  `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese --entry <new-term-or-grammar-id>`
- import incrementale nel DB target con
  `./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese`

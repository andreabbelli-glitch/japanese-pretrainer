# Prompt - Giapponese random Item singolo

Usa questo prompt con l'LLM esterno o come base di lavoro per l'agente che
genera un singolo item del media tecnico `web-giapponese`.

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown o YAML conformi alla specifica fornita.

Contesto del progetto:
- Il media visibile e `Giapponese random`.
- Lo slug tecnico resta `web-giapponese`.
- Ogni lesson reale corrisponde a un item concreto incontrato dall'utente:
  pagina web, screenshot, prompt di gioco, schermata UI, carta, rules panel o
  piccolo flow.
- Il focus primario e insegnare giapponese leggibile e riusabile, non
  documentare la fonte come prodotto.
- La fonte primaria e l'item visibile: pagina renderizzata, screenshot locale,
  testo copiato o immagine allegata.

Input richiesto:
- URL pubblica, screenshot locale/allegato o testo copiato dall'item;
- seed terms o seed phrases da coprire obbligatoriamente.

Input opzionali:
- focus area come navbar, filtri, tab, tabella, box risultati, badge, header,
  finestra tutorial, prompt, label UI o rules text;
- nota sul punto di difficolta percepito dall'utente;
- trascrizione manuale quando OCR o screenshot non bastano.

Vincoli didattici obbligatori:
- la lesson deve restare centrata su un item reale, non su una overview
  astratta della fonte;
- copri sempre i seed terms richiesti;
- puoi aggiungere al massimo 5 flashcard extra automatiche;
- le extra devono essere N5-N3 oppure estremamente comuni e davvero utili;
- non promuovere automaticamente a flashcard i label molto verticali della
  fonte;
- se un termine esiste gia in altri media, crea una nuova occorrenza locale
  solo se qui aggiunge sfumatura, esempio o card utile; il glossary/review
  globale verra unito automaticamente dalla superficie normalizzata;
- se la sfumatura locale cambia davvero, esplicitala in `notes_it`;
- riusa una frase vera della fonte come `example_jp` solo se la frase completa
  resta leggibile col corpus gia coperto; altrimenti crea un esempio
  semplificato ma fedele al contesto.
- se la entry e stata estratta da una locuzione piu lunga e da sola non
  compare in modo autonomo nella fonte, crea una frase nuova ma naturale che
  la usi bene nel dominio dell'item.
- `example_jp` deve mostrare uso vivo della entry, non spiegarla: vietate
  frasi meta-lessicali come `XにYがつくと...`, `XはYの意味`,
  `Xという言葉は...`; se devi spiegare famiglia lessicale o composizione,
  fallo in `notes_it`, non in `example_jp`.

Politica immagini:
- prevedi una snapshot generale orientativa o usa lo screenshot fornito;
- prevedi crop mirati solo per i punti spiegati davvero;
- aggiorna `workflow/image-requests.yaml` e `workflow/image-assets.yaml` con
  criterio editoriale, non come semplice lista tecnica;
- non inventare `src` immagine inesistenti nel textbook finale.

File da produrre di norma:
- `content/media/web-giapponese/textbook/<ordine>-<page-slug>.md`
- `content/media/web-giapponese/cards/<ordine>-<page-slug>.md`
- eventuali aggiornamenti a:
  - `content/media/web-giapponese/workflow/image-requests.yaml`
  - `content/media/web-giapponese/workflow/image-assets.yaml`

Comandi operativi obbligatori dopo la scrittura:
- esegui i controlli canonici del repo;
- esegui `./scripts/with-node.sh pnpm pitch-accents:fetch -- --media web-giapponese --entry <new-term-or-grammar-id>` per ogni entry flashcard appena creata o rivista;
- esegui `./scripts/with-node.sh pnpm content:import -- --media-slug web-giapponese`;
- considera il lavoro incompleto se pitch accent fetch, import o cache
  revalidation falliscono.

Regole di formato obbligatorie:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa furigana, link semantici e blocchi strutturati solo nelle forme supportate.
- Ogni flashcard deve puntare all'entry della superficie completa del `front`:
  se alleni una frase UI o un chunk piu lungo, crea una entry dedicata per quel
  chunk invece di riusare l'entry del lemma interno.
- `example_jp` e `example_it` vanno sempre insieme.
- `notes_it`, `summary`, `description` e prose YAML vanno serializzati in modo
  sicuro (`>-` oppure stringhe quotate quando opportuno).
- Le spiegazioni devono chiarire significato reale + effetto concreto sulla
  lettura dell'item.
- Non scrivere meta-discorso sul workflow o sulla lesson come oggetto.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.

Media:
- id: media-web-giapponese
- slug: web-giapponese
- title: Giapponese random
- media_type: random
- segment_kind: segment

Documenti da seguire:
- docs/llm-kit/general/01-content-format.md
- docs/llm-kit/general/02-llm-content-handoff.md
- docs/llm-kit/general/03-template-media.md
- docs/llm-kit/general/04-template-textbook-lesson.md
- docs/llm-kit/general/05-template-cards-file.md
- docs/llm-kit/general/06-content-workflow-playbook.md
- docs/llm-kit/general/07-template-image-requests.yaml
- docs/llm-kit/general/08-template-image-assets.yaml
- docs/llm-kit/media/web-giapponese/01-brief.md
```

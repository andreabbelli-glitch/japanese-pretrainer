# Prompt - Web giapponese Pagina singola

Usa questo prompt con l'LLM esterno o come base di lavoro per l'agente che
genera una singola pagina del media `web-giapponese`.

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown o YAML conformi alla specifica fornita.

Contesto del progetto:
- Il media visibile e `Web giapponese`.
- Lo slug tecnico resta `web-giapponese`.
- Ogni lesson reale corrisponde a una singola pagina web giapponese.
- Il focus primario e insegnare giapponese leggibile e riusabile, non
  documentare il sito come prodotto.
- La fonte primaria e la pagina renderizzata nel browser.

Input richiesto:
- URL della pagina pubblica;
- seed terms o seed phrases da coprire obbligatoriamente.

Input opzionali:
- testo copiato dalla pagina;
- focus area come navbar, filtri, tab, tabella, box risultati, badge, header;
- nota sul punto di difficolta percepito dall'utente.

Vincoli didattici obbligatori:
- la lesson deve restare centrata su una pagina reale, non su una overview
  astratta del sito;
- copri sempre i seed terms richiesti;
- puoi aggiungere al massimo 5 flashcard extra automatiche;
- le extra devono essere N5-N3 oppure estremamente comuni e davvero utili;
- non promuovere automaticamente a flashcard i label molto verticali del sito;
- se un termine esiste gia in altri media, crea una nuova entry locale solo se
  qui cambia davvero la sfumatura; se il collegamento e certo usa
  `cross_media_group`;
- se la sfumatura locale cambia davvero, esplicitala in `notes_it`;
- riusa una frase vera della pagina come `example_jp` solo se la frase completa
  resta leggibile col corpus gia coperto; altrimenti crea un esempio
  semplificato ma fedele al contesto.

Politica immagini:
- prevedi una snapshot generale orientativa della pagina;
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

Regole di formato obbligatorie:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa furigana, link semantici e blocchi strutturati solo nelle forme supportate.
- `example_jp` e `example_it` vanno sempre insieme.
- `notes_it`, `summary`, `description` e prose YAML vanno serializzati in modo
  sicuro (`>-` oppure stringhe quotate quando opportuno).
- Le spiegazioni devono chiarire significato reale + effetto concreto sulla
  lettura della pagina.
- Non scrivere meta-discorso sul workflow o sulla lesson come oggetto.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.

Media:
- id: media-web-giapponese
- slug: web-giapponese
- title: Web giapponese
- media_type: web
- segment_kind: site

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

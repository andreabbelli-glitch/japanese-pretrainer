# Prompt - Gundam Arsenal Base Batch 1

Usa questo prompt con l'LLM esterno specializzato.

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Contesto del progetto:
- Il media visibile e Mobile Suit Gundam Arsenal Base.
- Lo slug tecnico resta `gundam-arsenal-base`.
- Il focus iniziale non e il meta competitivo, ma la comprensione pratica di
  interfaccia, schermata di battaglia, ruoli, modalita e prime decisioni.
- Il livello attuale dell'utente e circa N5/N4.
- Le spiegazioni devono essere in italiano.

Fonti da usare con priorita:
- sito ufficiale `機動戦士ガンダム アーセナルベース`, soprattutto `遊び方`;
- PDF ufficiale `遊び方マニュアル`;
- wiki fan `機動戦士ガンダム アーセナルベース Wiki (swiki)`, in particolare
  la guida principianti;
- guide fan giapponesi ben strutturate che spiegano onboarding, lettura della
  schermata, ruoli, deck iniziale e prime sessioni.

Regola sulle fonti:
- per nomenclatura UI, componenti del cabinato, flusso ufficiale, modalita e
  sistemi, prevalgono le fonti ufficiali;
- per spiegare meglio cosa guardare davvero in partita e cosa conviene fare
  nelle prime sessioni, integra anche le guide fan;
- se una guida fan contraddice un termine o un flusso ufficiale, segui
  l'ufficiale.

Obiettivo di questo batch:
Creare il primo batch base del media, con focus su onboarding arcade,
schermata di battaglia e progressione iniziale.

Vincoli didattici obbligatori:
- `001-arcade-onboarding` deve spiegare il cabinato, i suoi componenti, la
  logica di IC card / account / My Page e il flusso di prima sessione;
- `002-battle-screen-and-core-actions` deve spiegare cosa si vede sullo
  schermo, quali risorse leggere, cosa fanno `出撃`, abilita e `戦術技`, e come
  interpretare almeno i ruoli `殲滅`, `制圧`, `防衛`;
- `003-modes-and-progression` deve spiegare modalita principali, rank,
  missioni, deck iniziale, progressione e cosa conviene fare nelle prime
  partite;
- le lesson non devono sovrapporsi: onboarding fisico, lettura del match e
  progressione devono restare ben distinti;
- privilegia sempre termini UI stabili, non copy stagionale o promozionale.

Vincoli di formato obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi strutturati.
- Usa `:::image` solo se ti viene fornito un `src` reale sotto `assets/`; non
  inventare path immagine.
- Se il label visibile di un link semantico contiene kanji, metti il furigana
  direttamente nel label: `[{{単語|たんご}}](term:term-id)`.
- Se usi inline code con giapponese non trasparente, annota anche li:
  `` `{{未解放|みかいほう}}` `` e non `` `未解放` ``.
- Nei composti misti non mettere kana gia visibili dentro il ruby:
  `{{受|う}}け{{取|と}}る`, `{{手|て}}{{持|も}}ち`, `メイン{{枠|わく}}`,
  `{{2|ふた}}つ`.
- Quando c'e un composto numerico con soli kanji / qualificatori in kanji
  (`以下`, `以上`, `未満`, ecc.), annota il blocco completo:
  `{{1枚|いちまい}}`, `{{4以下|よんいか}}`.
- Se compaiono kana gia visibili dopo il numero, lasciali fuori dal ruby:
  `{{4|よっ}}つ{{以上|いじょう}}`, `{{300|さんびゃく}}ポイント`.
- Per i campi descrittivi YAML come `notes_it`, `summary`, `description`,
  `notes`, usa `>-` invece di plain scalar quando c'e testo libero o markdown
  inline.
- Ogni blocco `:::card` deve includere sempre `example_jp` + `example_it`.
  `example_jp` deve essere una frase giapponese completa e contestuale utile
  sul retro review, non una parola isolata o una ripetizione del `front`.
- `example_jp` deve essere centrata il piu possibile sul media attuale: la
  frase deve usare il contesto, il lessico e le situazioni del media in cui
  la card vive, non scenari generici scollegati.
- `example_jp` non deve contenere kanji che non hanno una flashcard associata
  nel corpus di studio (indipendentemente dal media e dallo stato di studio
  della card); anticipare leggermente e ammesso, usare kanji completamente
  fuori dal corpus no.
- Non scrivere spiegazioni tautologiche del tipo "X e utile/importante":
  ogni spiegazione deve dire che cosa significa davvero X e che cosa ti fa
  capire o fare nel gioco.
- Mantieni stabili gli ID.
- Se una entry nuova e importante per glossary/review, dichiarala esplicitamente
  con un blocco `:::term` o `:::grammar`.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.
- Non aggiungere testo fuori dai file.

Media:
- id: media-gundam-arsenal-base
- slug: gundam-arsenal-base
- title: Mobile Suit Gundam Arsenal Base
- media_type: videogame
- segment_kind: custom

Segmenti disponibili:
- arcade-onboarding
- battle-core
- match-reading
- modes-and-progression

Livello target:
- baseline di comprensione: N5/N4
- includi anche elementi piu avanzati se frequenti o essenziali per capire
  interfaccia e battaglia

File da produrre in questo batch:
- content/media/gundam-arsenal-base/media.md
- content/media/gundam-arsenal-base/textbook/001-arcade-onboarding.md
- content/media/gundam-arsenal-base/textbook/002-battle-screen-and-core-actions.md
- content/media/gundam-arsenal-base/textbook/003-modes-and-progression.md
- content/media/gundam-arsenal-base/cards/001-arcade-core.md

Focus contenutistico richiesto:
- componenti del cabinato e loro funzione pratica;
- lessico UI ricorrente e stabile;
- schermata di battaglia: gauge, unita, minimap, battlefield, tactics cards;
- azioni base: `出撃`, abilita, `戦術技`;
- ruoli `殲滅`, `制圧`, `防衛` spiegati come lettura del campo e decisione;
- cost, SP gauge, tempi e priorita di osservazione;
- modalita principali, rank, missioni, challenge, EX battle, My Page;
- deck iniziale, struttura base `MS + PL`, prime azioni consigliate;
- niente lore o meta approfondito se non serve a capire la lingua del gioco.

Regola importante:
- preferisci dichiarare `term` e `grammar` nel file cards;
- il textbook dovrebbe soprattutto referenziare entita gia dichiarate;
- se nel textbook introduci una entry nuova davvero necessaria, dichiarala in
  modo esplicito e coerente;
- quando una label UI o una formula di gioco ricorre spesso, trasformala in
  entry canonica utile per glossary/review.

Campi descrittivi da compilare sempre:
- in `media.md`, compila `description` in frontmatter (`>-`) con 1-2 frasi che
  descrivono il pacchetto di studio e il suo focus su onboarding arcade e
  comprensione operativa;
- in ogni file textbook, compila `summary` in frontmatter (`>-`) con una frase
  breve che descrive l'obiettivo della lesson.

Documenti da seguire:
- docs/llm-kit/general/01-content-format.md
- docs/llm-kit/general/02-llm-content-handoff.md
- docs/llm-kit/general/03-template-media.md
- docs/llm-kit/general/04-template-textbook-lesson.md
- docs/llm-kit/general/05-template-cards-file.md
- docs/llm-kit/media/gundam-arsenal-base/01-brief.md

Materiale di ricerca da considerare:
- sintesi delle fonti giapponesi raccolte dall'utente su sito ufficiale, PDF
  ufficiale, swiki e guide fan su note;
- usa il materiale soprattutto per ricostruire interfaccia, flusso, ruoli,
  modalita e deckbuilding iniziale.

Checklist finale da emettere dopo i file, separata dai file stessi:
CHECKLIST:
- files_generated: <numero>
- new_terms: <numero>
- new_grammar: <numero>
- reused_terms: <numero>
- unresolved_references: <numero>
- unsafe_yaml_fields: <numero>
- explanation_tautologies: <numero>
```

# Prompt - Duel Masters Batch 1 (Seed)

Usa questo prompt con l'LLM esterno specializzato.

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Contesto del progetto:
- Il media visibile e Duel Masters.
- Lo slug tecnico resta `duel-masters-dm25`.
- I due starter deck `DM25-SD1` e `DM25-SD2` sono il corpus iniziale, non il
  nome del media.
- Il livello attuale dell'utente e circa N5/N4.
- Le spiegazioni devono essere in italiano.

Regola didattica importante:
- N5/N4 e il livello di partenza dell'utente, non il limite massimo dei contenuti.
- Se un termine, kanji o pattern e piu avanzato ma e comune o essenziale per
  leggere bene le carte, includilo e spiegalo.
- Evita invece dettagli troppo rari, marginali o poco riutilizzabili.
- Privilegia cio che e frequente, strutturale e davvero utile per capire Duel Masters.
- Non scrivere spiegazioni valutative vuote del tipo "X e utile/importante":
  ogni spiegazione deve dire che cosa significa davvero X e che cosa ti fa
  capire o fare in Duel Masters.
- Se un nome carta e poco trasparente, spiega almeno quale ruolo ricorrente
  segnala nel mazzo o quali componenti del nome conviene riconoscere.

Obiettivo di questo batch:
Creare solo il seed core del media. In questo batch non devi produrre lesson
verticali sui deck: devi costruire una base forte e non ridondante.

Vincoli didattici obbligatori:
- `001-tcg-core-overview` deve essere una lesson di onboarding soft:
  obiettivo del gioco, anatomia della carta, zone, attori, verbi base,
  ordine pratico di lettura.
- `002-tcg-core-patterns` deve essere una lesson tecnica di parsing del
  rules text: trigger, sequenza, opzionalita, sostituzione, restrizioni,
  filtri numerici.
- Le due lesson non devono sovrapporsi o ripetersi.

Vincoli di formato obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi strutturati.
- MAPPA I KANJI CON FURIGANA ANCHE DENTRO LE CITAZIONI IN CODICE
  (esempio: `` `{{墓地|ぼち}}から{{出|だ}}す` ``).
- Per composti numerici con contatori o qualificatori usa un solo furigana sul
  blocco intero: `{{1枚|いちまい}}`, `{{4以下|よんいか}}`,
  `{{4つ以上|よっついじょう}}`.
- Per i campi descrittivi YAML come `notes_it`, usa `>-` invece di plain scalar.
- Se un valore contiene `:`/`：`, furigana, link semantici, backtick o una
  frase completa di rules text, non lasciarlo come plain scalar.
- Non scrivere `notes_it` o paragrafi textbook che si fermano a "X e utile da
  fissare": devi sempre esplicitare significato reale + effetto pratico nel
  media.
- Mantieni stabili gli ID.
- Se una entry nuova e importante per glossary/review, dichiarala esplicitamente
  con un blocco `:::term` o `:::grammar`.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.
- Non aggiungere testo fuori dai file.

Media:
- id: media-duel-masters-dm25
- slug: duel-masters-dm25
- title: Duel Masters
- media_type: tcg
- segment_kind: deck

Segmenti disponibili:
- tcg-core
- mazzo-abyss
- mazzo-apollo-red-zone

Livello target:
- baseline di comprensione: N5/N4
- includi anche elementi piu avanzati se frequenti o essenziali

File da produrre in questo batch:
- content/media/duel-masters-dm25/media.md
- content/media/duel-masters-dm25/textbook/001-tcg-core-overview.md
- content/media/duel-masters-dm25/textbook/002-tcg-core-patterns.md
- content/media/duel-masters-dm25/cards/001-tcg-core.md

Focus contenutistico richiesto:
- anatomia della carta Duel Masters;
- termini ricorrenti delle carte;
- verbi e comandi ricorrenti;
- pattern grammaticali comuni del testo effetto;
- kanji davvero utili per leggere le carte;
- elementi piu avanzati quando sono molto comuni o essenziali nel corpus;
- niente teoria astratta non collegata al testo carta.

Convenzione ID consigliata:
- media: media-duel-masters-dm25
- lesson core: lesson-duel-masters-dm25-tcg-core-...
- cards batch: cards-duel-masters-dm25-tcg-core-...
- term: term-...
- grammar: grammar-...
- card: card-...

Regola importante:
- preferisci dichiarare `term` e `grammar` nel file cards;
- il textbook dovrebbe soprattutto referenziare entita gia dichiarate;
- se nel textbook introduci una entry nuova davvero necessaria, dichiarala in
  modo esplicito e coerente.

Documenti da seguire:
- docs/content-format.md
- docs/llm-content-handoff.md
- docs/content-briefs/duel-masters-dm25.md
- docs/templates/media.template.md
- docs/templates/textbook-lesson.template.md
- docs/templates/cards-file.template.md

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

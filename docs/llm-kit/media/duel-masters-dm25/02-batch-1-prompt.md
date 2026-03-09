# Prompt - Duel Masters DM25 Batch 1

Usa questo prompt con l'LLM esterno specializzato.

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Contesto del progetto:
- Il media e Duel Masters.
- Questo primo contenuto reale e focalizzato sul linguaggio delle carte e sui
  deck DM25-SD1 e DM25-SD2.
- Il livello attuale dell'utente e circa N5/N4.
- Le spiegazioni devono essere in italiano.

Regola didattica importante:
- N5/N4 e il livello di partenza dell'utente, non il limite massimo dei contenuti.
- Se un termine, kanji o pattern e piu avanzato ma e comune o essenziale per
  leggere bene le carte, includilo e spiegalo.
- Evita invece dettagli troppo rari, marginali o poco riutilizzabili.
- Privilegia cio che e frequente, strutturale e davvero utile per capire Duel Masters.

Obiettivo di questo batch:
Creare il primo nucleo di contenuti per insegnare il linguaggio base delle carte
di Duel Masters, con focus su termini ricorrenti, pattern grammaticali frequenti
e kanji utili in contesto TCG.

Vincoli obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi strutturati.
- Per i campi descrittivi YAML come `notes_it`, usa `>-` invece di plain scalar.
- Se un valore contiene `:`/`：`, furigana, link semantici, backtick o una
  frase completa di rules text, non lasciarlo come plain scalar.
- Mantieni stabili gli ID.
- Se una entry nuova e importante per glossary/review, dichiarala esplicitamente
  con un blocco `:::term` o `:::grammar`.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.
- Non aggiungere testo fuori dai file.

Media:
- id: media-duel-masters-dm25
- slug: duel-masters-dm25
- title: Duel Masters DM25
- media_type: tcg
- segment_kind: deck

Segmenti disponibili:
- tcg-core
- dm25-sd1
- dm25-sd2

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
- 01-content-format.md
- 02-llm-content-handoff.md
- 03-template-media.md
- 04-template-textbook-lesson.md
- 05-template-cards-file.md
- 01-brief.md

Checklist finale da emettere dopo i file, separata dai file stessi:
CHECKLIST:
- files_generated: <numero>
- new_terms: <numero>
- new_grammar: <numero>
- reused_terms: <numero>
- unresolved_references: <numero>
- unsafe_yaml_fields: <numero>
```

# Handoff Per LLM Esterno

## 1. Scopo

Questo documento definisce come un LLM esterno deve produrre contenuti
importabili per la webapp.

L'LLM esterno non deve decidere il formato. Deve riempire un formato gia
definito e rispettarlo in modo rigoroso.

## 2. Principio operativo

L'LLM esterno ha un ruolo preciso:

- ricerca il contenuto giapponese;
- seleziona vocaboli, frasi e pattern rilevanti;
- scrive spiegazioni in italiano;
- produce file Markdown conformi alla specifica.

Non deve:

- cambiare struttura file;
- inventare nuovi campi;
- rinominare ID esistenti;
- usare sintassi diversa da quella definita;
- lasciare riferimenti non risolti.

## 3. Workflow consigliato

### Modalita consigliata

Usare l'LLM esterno come `content drafter`, non come `source of truth`.

Pipeline:

1. gli fornisci la specifica del formato;
2. gli fornisci esempi validi;
3. gli chiedi di produrre solo i file richiesti;
4. un validatore locale controlla il risultato;
5. se ci sono errori, gli rimandi gli errori strutturati e lui corregge.

Questa collaborazione ha senso. Anzi, e il modo giusto di usarlo, purche il
processo sia validator-first.

## 4. Punto critico

Il problema non e far generare testo a un LLM. Il problema e fargli mantenere
coerenza strutturale su:

- ID stabili;
- riferimenti tra file;
- segmentazione coerente;
- alias di ricerca;
- furigana corretti;
- riuso di entita gia esistenti.

Per questo motivo la specifica da sola non basta. Servono:

- esempi validi;
- regole di naming;
- regole di serializzazione YAML sicura;
- checklist di output;
- validazione automatica.

## 5. Modo piu intelligente di collaborare

Il modo piu intelligente non e "chiedi all'LLM di scrivere un textbook".

Il modo piu intelligente e separare il lavoro in due ruoli:

- LLM specializzato esterno: ricerca, traduzione, draft del contenuto.
- Pipeline locale / Codex: validazione, normalizzazione, import, correzione del
  formato.

In pratica:

- l'LLM esterno produce contenuti;
- il sistema locale decide se i contenuti sono accettabili.

Questo evita di fidarsi ciecamente dell'LLM sulla parte strutturale.

## 6. Strategia consigliata per v1

### Regola generale

Far produrre all'LLM esterno file piccoli e ben delimitati.

Meglio:

- una lesson alla volta;
- un file cards alla volta;
- poche decine di entry per richiesta.

Peggio:

- un intero media in un solo output;
- centinaia di card in una sola risposta;
- aggiornamenti che riscrivono file gia stabilizzati senza istruzioni precise.

### Convenzione dominante

Per ridurre errori:

- le entita canoniche `term` e `grammar` vanno preferibilmente definite nei file
  `cards/`;
- il `textbook` dovrebbe soprattutto referenziare entita gia dichiarate;
- il `textbook` puo dichiarare nuove entita solo se strettamente necessario.

Questo riduce duplicazioni e inconsistenze.

## 7. Regole da comunicare all'LLM esterno

Quando gli chiedi contenuti, devi dirgli esplicitamente:

- quali file deve produrre;
- quali ID esistono gia e non possono cambiare;
- quali segmenti esistono gia;
- quali entry devono essere riusate;
- che deve restituire solo Markdown conforme;
- che i campi descrittivi in YAML devono usare una serializzazione sicura;
- che non deve aggiungere spiegazioni fuori dai file.

### 7.1 Regola operativa fondamentale

Per ridurre i fallimenti di import:

- l'LLM esterno deve trattare `notes_it` come campo da serializzare sempre con
  `>-`;
- per estensione, anche `summary`, `description` e `notes` vanno preferiti in
  `>-` quando compaiono in YAML;
- non deve usare plain scalar per testo che contiene `:` o `：`, furigana,
  link semantici, backtick o una frase completa di rules text.
- **i furigana `{{kanji|kana}}` e i term link funzionano anche dentro i blocchi di codice inline (i backtick ` `), usali e mappali sempre**: es. `` `{{相手|あいて}}のクリーチャー` `` anziché `` `相手のクリーチャー` ``.

Esempio corretto:

```md
notes_it: >-
  Lettura da fissare: {{山札|やまふだ}}.
```

## 8. Prompt template consigliato

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Vincoli obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi strutturati. **MAPPA I KANJI CON FURIGANA ANCHE E SOPRATTUTTO DENTRO LE CITAZIONI IN CODICE (`` `{{kanji|kana}}` ``)**.
- Per i campi descrittivi in YAML usa `>-` invece di plain scalar quando c'e
  testo libero, markdown inline o una frase completa di rules text.
- Mantieni stabili gli ID esistenti.
- Se riusi una entry esistente, referenzia il suo ID invece di ridefinirla.
- Se una entry nuova e importante per glossary/review, dichiarala esplicitamente
  con un blocco `:::term` o `:::grammar`.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.

Campi descrittivi da compilare sempre:
- Per i grammar pattern: se il `pattern` contiene kanji (es. `～時`), compila
  sempre il campo `reading` con la lettura completa in hiragana (es. `とき`).
  Se invece e tutto in kana (es. `かわりに`), ometti il campo.
- Per media.md: compila il campo `description` nel frontmatter (>-) con 1-2
  frasi che descrivono il pacchetto di studio, il taglio didattico e il target.
  Questo testo viene mostrato direttamente nell'UI; se assente, viene usato un
  excerpt automatico troncato del corpo del documento.
- Per ogni file textbook: compila il campo `summary` nel frontmatter (>-) con
  una frase breve (max 160 caratteri) che descrive l'obiettivo della lesson.
  Viene mostrata nella card del textbook e nell'header della pagina; se assente,
  il sistema usa un excerpt automatico troncato.

Obiettivo del task:
<descrizione del media / segmento / lesson>

File da produrre:
<elenco preciso dei file>

ID gia esistenti da riusare:
<lista IDs>

Segmenti disponibili:
<lista segmenti>

Livello target:
<es. N5/N4>

Specifica formato:
<incollare o allegare la specifica rilevante>

Esempi validi:
<incollare 1-2 esempi corretti>
```

## 9. Checklist di qualita dell'output

Prima di accettare l'output, bisogna verificare:

- frontmatter presente e completo;
- nessun ID duplicato;
- nessun cambio di ID esistente;
- tutti i riferimenti inline validi;
- romaji coerenti;
- reading presenti dove obbligatori;
- niente termini importanti lasciati solo nel testo libero;
- nessun campo YAML fragile, come `notes_it` o una frase completa in
  `front/back`, scritto come plain scalar ambiguo;
- niente testo fuori formato.

## 10. Suggerimento pratico importante

Chiedere all'LLM esterno di emettere anche una breve sezione finale di
autoverifica machine-friendly, ma separata dai file reali, ad esempio:

```text
CHECKLIST:
- files_generated: 2
- new_terms: 12
- new_grammar: 3
- reused_terms: 7
- unresolved_references: 0
```

Questa parte non va importata, ma e utile nel ciclo di controllo.

## 11. Criticita da prevenire

### 11.1 ID instabili

Se l'LLM rigenera un file e cambia gli ID, rompi glossary, progress e review.

Regola:

- una volta assegnato, un ID non cambia piu.

### 11.2 Ridefinizioni incompatibili

Se `term-taberu` oggi ha certi campi e domani viene ridefinito in modo
incompatibile, il validatore deve fallire.

### 11.3 Glossary incompleto

Se un termine importante appare solo in testo libero, non entra bene nel modello.

Regola:

- le entry importanti vanno dichiarate esplicitamente.

### 11.4 Output troppo grande

Su output grandi i modelli peggiorano in coerenza.

Regola:

- lavorare per batch piccoli.

## 12. Raccomandazione finale

Si, ha senso usare un altro LLM specializzato per creare textbook e flashcard.

Pero non gli affiderei mai direttamente il ruolo di "autore libero". Gli
affiderei il ruolo di "fornitore di contenuto dentro un contratto rigido".

La collaborazione migliore e:

- specifica stretta;
- esempi validi;
- validator locale;
- correzione iterativa sugli errori;
- import solo dopo validazione.

## 13. Playbook operativo

Per la procedura concreta del repository usare:

- `docs/llm-kit/general/06-content-workflow-playbook.md`

Il playbook fissa il ciclo reale da seguire:

1. richiesta batch piccola;
2. output LLM esterno;
3. validazione locale con `content:validate`;
4. correzione iterativa sui file che falliscono;
5. import con `content:import`.

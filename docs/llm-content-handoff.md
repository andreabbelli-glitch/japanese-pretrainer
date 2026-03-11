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
- che le spiegazioni devono esplicitare significato reale + conseguenza concreta
  nel media;
- che non deve aggiungere spiegazioni fuori dai file.

### 7.1 Regola operativa fondamentale

Per ridurre i fallimenti di import:

- l'LLM esterno deve trattare `notes_it` come campo da serializzare sempre con
  `>-`;
- per estensione, anche `summary`, `description` e `notes` vanno preferiti in
  `>-` quando compaiono in YAML;
- non deve usare plain scalar per testo che contiene `:` o `：`, furigana,
  link semantici, backtick o una frase completa di rules text.
- se il testo visibile di un term link o grammar link contiene kanji, deve
  annotare anche il label del link, per esempio
  `[{{報酬|ほうしゅう}}](term:term-reward)`;
- non deve assumere che la `reading` della entry basti nel reader: il furigana
  va messo anche nelle spiegazioni, nelle note e nelle stringhe inline mostrate
  all'utente quando la lettura non e trasparente.

Esempio corretto:

```md
notes_it: >-
  Lettura da fissare: {{山札|やまふだ}}.
```

### 7.2 Regola operativa sulla qualita esplicativa

Una spiegazione non e accettabile se si limita a dire che un termine o un
pattern e "utile", "importante", "frequente" o "da fissare".

Ogni `notes_it` o paragrafo textbook deve chiarire almeno:

- che cosa vuol dire davvero l'elemento giapponese;
- che cosa cambia nella lettura o nell'azione quando compare nel media;
- per nomi propri opachi, quale ruolo ricorrente o quale parte del nome conviene
  riconoscere.

Anti-esempi:

- `{{編成|へんせい}}` e un kanji utile da fissare.
- `または` e importante nel rules text.

Forme consigliate:

- `{{編成|へんせい}}` vuol dire "organizzazione / composizione"; in
  `デッキ{{編成|へんせい}}` segnala la schermata in cui costruisci la lista.
- `または` vuol dire "oppure", ma nelle carte collega due categorie che valgono
  entrambe per lo stesso filtro.

## 8. Prompt template consigliato

```text
Stai producendo contenuti per una webapp privata di studio del giapponese.
Devi restituire SOLO file Markdown conformi alla specifica fornita.

Vincoli obbligatori:
- Non cambiare il formato.
- Non inventare nuovi campi.
- Usa solo la sintassi prevista per furigana, link semantici e blocchi strutturati.
- Se il label visibile di un link semantico contiene kanji, metti il furigana
  direttamente nel label: `[{{単語|たんご}}](term:term-id)`.
- Se usi inline code con giapponese non trasparente, annota anche li:
  `` `{{未解放|みかいほう}}` `` e non `` `未解放` ``.
- Quando c'e un composto numerico con contatore o qualificatore (`以下`,
  `以上`, `未満`, ecc.), annota il blocco completo: `{{1枚|いちまい}}`,
  `{{4以下|よんいか}}`, `{{4つ以上|よっついじょう}}`. Non scrivere
  `1{{枚|まい}}`, `4{{以下|いか}}` o `{{4つ|よっつ}}{{以上|いじょう}}`.
- Quando il numero e poco trasparente o grande, metti furigana sul composto
  intero: `{{2000以下|にせんいか}}`, `{{3000円|さんぜんえん}}`.
- Per i campi descrittivi in YAML usa `>-` invece di plain scalar quando c'e
  testo libero, markdown inline o una frase completa di rules text.
- Non scrivere spiegazioni tautologiche del tipo "X e utile/importante":
  ogni spiegazione deve dire che cosa significa davvero X e che cosa ti fa
  capire o fare nel media.
- Per nomi propri poco trasparenti, spiega almeno quale ruolo ricorrente
  segnalano o quali componenti del nome vale la pena riconoscere.
- Mantieni stabili gli ID esistenti.
- Se riusi una entry esistente, referenzia il suo ID invece di ridefinirla.
- Se una entry nuova e importante per glossary/review, dichiarala esplicitamente
  con un blocco `:::term` o `:::grammar`.
- Tutte le spiegazioni devono essere in italiano.
- Restituisci solo il contenuto dei file richiesti, senza commenti extra.

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
- niente spiegazioni tautologiche o solo valutative ("utile", "importante",
  "da fissare") senza contenuto semantico e operativo;
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

- `docs/content-workflow-playbook.md`

Il playbook fissa il ciclo reale da seguire:

1. richiesta batch piccola;
2. output LLM esterno;
3. validazione locale con `content:validate`;
4. correzione iterativa sui file che falliscono;
5. import con `content:import`.

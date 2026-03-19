# Handoff Per LLM Esterno

> [!IMPORTANT]
> Documento legacy mantenuto per contesto storico. Umani, agent e LLM non
> devono usarlo per istruzioni operative correnti. Per il workflow operativo con
> LLM esterni usa come fonte di verita
> `docs/llm-kit/general/02-llm-content-handoff.md`. Se trovi differenze, vale
> il file nel kit.

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

### 4.1 Scope degli ID editoriali

Per `term` e `grammar`, l'ID che l'LLM vede nel Markdown non e piu globale al
workspace: e locale al media su cui sta lavorando.

Regole operative da assumere:

- dentro lo stesso media, `term.id` e `grammar.id` devono restare univoci;
- tra media diversi, lo stesso ID editoriale puo essere riusato;
- se vuoi collegare due entry locali di media diversi, usa il campo opzionale
  `cross_media_group`;
- `cross_media_group` non sostituisce l'ID locale e non rende globale
  `term.id` / `grammar.id`;
- i link semantici `[...](term:...)` e `[...](grammar:...)` vengono risolti nel
  contesto del media corrente;
- il confronto runtime "compare anche in altri media" esiste solo per entry con
  `cross_media_group` esplicito.

## 5. Modo piu intelligente di collaborare

Il modo piu intelligente non e "chiedi all'LLM di scrivere un textbook".

Il modo piu intelligente e separare il lavoro in due ruoli:

- LLM specializzato esterno: ricerca, traduzione, draft del contenuto.
- Agent immagini / automation: recupero screenshot, crop, normalizzazione asset.
- Pipeline locale / Codex: validazione, normalizzazione, import, correzione del
  formato.

In pratica:

- l'LLM esterno produce contenuti;
- l'agent immagini salva file reali sotto `content/media/<slug>/assets/`;
- il sistema locale decide se i contenuti sono accettabili.

Questo evita di fidarsi ciecamente dell'LLM sulla parte strutturale.

### 5.1 Regola pratica per le immagini

Non far inventare all'LLM contenuti un `src` immagine che non esiste ancora.

Workflow consigliato:

1. il content drafter decide se una immagine serve davvero, dove va nel flow e
   quale immagine specifica chiarirebbe il passaggio;
2. salva le richieste in `content/media/<slug>/workflow/image-requests.yaml`;
3. l'agent immagini recupera il file e aggiorna
   `content/media/<slug>/workflow/image-assets.yaml`;
4. solo dopo si inserisce nel textbook un blocco `:::image` con `src` reale.
5. dopo l'apply reale dei blocchi nel textbook, riesegui `content:import` prima
   di controllare la webapp: il reader legge il contenuto importato nel DB, non
   il markdown appena cambiato sul filesystem.

Il validatore fallisce se il file non esiste.

Tratta `image-requests.yaml` come piano editoriale, non come semplice TODO
tecnico. La request deve fissare almeno:

- il punto esatto del flow in cui l'immagine va inserita;
- la scena / schermata / crop scelto;
- che cosa l'immagine deve rendere leggibile;
- quali elementi devono essere visibili;
- quale tipo di fonte e preferibile per recuperarla.

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
- che per `term` e `grammar` l'unicita vale nel media corrente, non nel
  workspace intero;
- che `cross_media_group` e opzionale e va compilato solo quando il
  collegamento cross-media e editoriale e certo;
- che, quando serve, il group id va nominato come slug leggibile e stabile,
  preferibilmente con prefisso del tipo (`term-shared-...`,
  `grammar-shared-...`);
- quali segmenti esistono gia;
- quali entry devono essere riusate;
- che deve restituire solo Markdown conforme;
- che i campi descrittivi in YAML devono usare una serializzazione sicura;
- che ogni blocco `:::card` deve includere sempre `example_jp` +
  `example_it`, con una frase giapponese completa e la sua traduzione italiana;
- che un blocco `:::image` e valido solo se `src` punta a un file gia esistente
  sotto `assets/`;
- che, se il task include il workflow immagini, il primo agente deve produrre
  `workflow/image-requests.yaml` invece di inventare direttamente `src`, e deve
  usarlo come piano editoriale completo della scelta visiva;
- che le spiegazioni devono esplicitare significato reale + conseguenza concreta
  nel media;
- che non deve aggiungere spiegazioni fuori dai file.

Per il workflow immagini, chiedi esplicitamente anche:

- `placement_rationale`: perche l'immagine va proprio in quel punto;
- `visual_goal`: che cosa deve rendere leggibile;
- `source_preference`: che tipo di fonte e preferita;
- `must_show`: elementi che devono comparire nel frame finale;
- `avoid`: elementi da evitare per non prendere un'immagine sbagliata.

Regola editoriale addizionale:

- non deve proporre `cross_media_group` solo perche due entry condividono
  lemma, kanji, reading o traduzione letterale.
- non deve forzare gruppi tra modalita solo analoghe, tra nomi propri o tra
  entry di tipo diverso anche se condividono lo stesso lessema.

### 7.1 Regola operativa fondamentale

Per ridurre i fallimenti di import:

- l'LLM esterno deve trattare `notes_it` come campo da serializzare sempre con
  `>-`;
- per ogni blocco `:::card`, `example_jp` e `example_it` sono obbligatori e
  vanno compilati sempre insieme;
- `example_jp` deve essere una frase completa e contestuale utile sul retro
  review, non una parola isolata, una pseudo-definizione o una semplice
  ripetizione del `front`;
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
- se usa `:::image`, `src` deve iniziare con `assets/` e non puo essere
  inventato: va usato solo quando l'asset e gia stato predisposto nel bundle;
- `alt` e obbligatorio per ogni `:::image`; `caption`, se presente, va scritto
  con `>-` quando contiene testo libero o riferimenti inline.
- in `:::image`, `alt` non renderizza furigana o link: descrivilo in italiano
  o con kana / katakana, senza lasciare kanji nudi;
- in `:::image`, `caption` e testo visibile: se compare un termine con kanji,
  usa furigana; se esiste gia una entry glossary / flashcard, collega il
  termine e annota anche il label del link quando contiene kanji.

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
- se l'elemento compare in un composto, che cosa aggiunge il singolo componente
  e che cosa vuol dire il composto intero;
- per nomi propri opachi, quale ruolo ricorrente o quale parte del nome conviene
  riconoscere.

Anti-esempi:

- `{{編成|へんせい}}` e un kanji utile da fissare.
- `または` e importante nel rules text.

Forme consigliate:

- in `デッキ{{編成|へんせい}}`, `デッキ` nomina il mazzo e
  `{{編成|へんせい}}` aggiunge l'idea di organizzazione / composizione; il
  composto intero indica la schermata in cui costruisci la lista.
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
- Un blocco `:::image` e ammesso solo se ricevi un `src` reale gia disponibile
  sotto `assets/`; non inventare path immagine.
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
- Ogni blocco `:::card` deve includere sempre `example_jp` + `example_it`.
  `example_jp` deve essere una frase giapponese completa e contestuale utile
  sul retro review, non una parola isolata o una ripetizione del `front`.
- Non creare flashcard sul nome proprio completo di una cosa o entita singola:
  se serve al contesto, spiegalo nel textbook e isola semmai i componenti
  giapponesi riusabili del nome.
- Non scrivere spiegazioni tautologiche del tipo "X e utile/importante":
  ogni spiegazione deve dire che cosa significa davvero X e che cosa ti fa
  capire o fare nel media.
- Per nomi propri poco trasparenti, spiega almeno quale ruolo ricorrente
  segnalano o quali componenti del nome vale la pena riconoscere.
- Mantieni stabili gli ID esistenti.
- Se riusi una entry esistente, referenzia il suo ID invece di ridefinirla.
- Per `term` e `grammar`, tratta gli ID come locali al media corrente: non
  rinominare un ID solo perche esiste gia in un altro media.
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
- nessun ID duplicato dentro lo stesso media;
- nessun cambio di ID esistente;
- tutti i riferimenti inline validi;
- romaji coerenti;
- reading presenti dove obbligatori;
- ogni `:::card` ha `example_jp` e `example_it`;
- gli esempi delle card sono frasi complete e contestuali, non placeholder o
  definizioni camuffate;
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

Nota di scope:

- questo vale per ridefinizioni incompatibili nello stesso media;
- la presenza dello stesso ID editoriale in un altro media e consentita.

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
5. eventuale `image:apply` se hai risolto asset immagini;
6. import con `content:import` per aggiornare il DB che alimenta la webapp.

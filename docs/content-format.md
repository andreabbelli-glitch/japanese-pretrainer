# Specifica Contenuti Markdown

## 1. Scopo

Definire un formato Markdown stabile e importabile per:

- metadata del media;
- textbook;
- cards.

Il glossary non ha un file sorgente autonomo in v1: viene derivato dalle entita
presenti in textbook e cards.

## 2. Obiettivi del formato

- leggibile e scrivibile a mano;
- abbastanza strutturato da poter essere validato;
- compatibile con git diff e revisione testuale;
- basato su ID stabili;
- estendibile senza rompere gli import esistenti.

## 3. Struttura cartelle

```text
content/
  media/
    <media-slug>/
      media.md
      textbook/
        001-intro.md
        002-episode-01.md
        003-episode-02.md
      cards/
        001-core-vocab.md
        002-episode-01.md
```

## 4. Regole generali

- Tutti i file devono usare frontmatter YAML.
- Tutti gli ID devono essere stabili nel tempo.
- Gli slug devono essere URL-safe.
- Le chiavi obbligatorie non possono essere omesse.
- I riferimenti devono puntare a ID esistenti oppure l'import deve fallire.
- Il contenuto testuale libero e permesso solo nelle zone previste.

### 4.0 Regola furigana per testo visibile

Se una stringa giapponese con kanji o composti poco trasparenti e visibile nel
reader, deve portare il furigana anche quando appare:

- come testo normale;
- come label di un link semantico `[...](term:...)` o `[...](grammar:...)`;
- dentro inline code / backtick;
- dentro note, esempi, checklist o spiegazioni.

Quindi non basta che esista una `reading` nella entry glossary: se il testo
mostrato al lettore contiene kanji, la forma visibile deve essere annotata con
`{{base|reading}}` quando la lettura non e banale.

### 4.1 Regole di scrittura YAML sicura

Per evitare errori di import, i campi testuali descrittivi dentro frontmatter o
blocchi strutturati devono essere serializzati in modo conservativo.

Regole:

- i campi descrittivi come `notes_it`, `summary`, `description` e `notes`
  dovrebbero usare di default un block scalar `>-`, anche se stanno su una sola
  riga;
- i plain scalar vanno riservati a valori brevi e atomici come `title`,
  `slug`, `lemma`, `reading`, `romaji`, `meaning_it`;
- se un valore contiene uno qualsiasi di questi elementi, non deve essere
  lasciato come plain scalar:
  - `:` o `：`
  - furigana `{{base|reading}}`
  - link semantici `[...](term:...)` o `[...](grammar:...)`
  - backtick inline
  - frasi complete di testo carta / rules text
- quando c'e dubbio, usare `>-`.

Esempio corretto:

```md
notes_it: >-
  Lettura da fissare: {{山札|やまふだ}}.
```

Esempio da evitare:

```md
notes_it: Lettura da fissare: {{山札|やまふだ}}.
```

### 4.2 Regole per furigana su composti numerici

- quando un numero e seguito da un contatore o da un qualificatore numerico
  (`以下`, `以上`, `未満`, ecc.), il furigana va messo sull'espressione completa;
- usare quindi `{{1枚|いちまい}}`, `{{3本|さんぼん}}`, `{{4以下|よんいか}}`,
  `{{4つ以上|よっついじょう}}`, non `1{{枚|まい}}`, `4{{以下|いか}}` o
  `{{4つ|よっつ}}{{以上|いじょう}}`;
- se il numero e poco trasparente o "grande", annotare il composto intero:
  `{{2000以下|にせんいか}}`, `{{3000円|さんぜんえん}}`.

### 4.3 Regola di qualita esplicativa

Ogni spiegazione libera in `textbook/` o in `notes_it` deve fare piu che dire
che un termine o un pattern e "utile", "importante" o "da fissare".

Minimo richiesto:

- chiarire che cosa vuol dire davvero l'elemento giapponese nel corpus;
- chiarire che cosa ti fa capire, distinguere o fare quando compare nel media;
- se l'elemento compare dentro un composto, distinguere il significato del
  singolo componente da quello del label intero;
- se l'elemento e un nome proprio opaco, spiegare almeno quale ruolo ricorrente
  segnala o quali componenti del nome conviene riconoscere.

Esempi da evitare:

- `{{編成|へんせい}}` e un kanji utile da fissare.
- `または` e importante nel rules text.

Esempi accettabili:

- in `デッキ{{編成|へんせい}}`, `デッキ` nomina il mazzo e `{{編成|へんせい}}`
  aggiunge l'idea di organizzazione / composizione; il composto intero indica la
  schermata di deckbuilding.
- `または` vuol dire "oppure", ma nelle carte collega due categorie che valgono
  entrambe per lo stesso filtro.

## 5. `media.md`

Definisce il contenitore del media.

Esempio:

```md
---
id: media-frieren
slug: frieren
title: Frieren
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
status: active
---

# Frieren

Pacchetto di studio dedicato alla serie.
```

Campi obbligatori:

- `id`
- `slug`
- `title`
- `media_type`
- `segment_kind`
- `language`
- `base_explanation_language`

Campi opzionali:

- `subtitle`
- `description`
- `tags`
- `cover_image`
- `notes`

## 6. File textbook

Ogni file in `textbook/` rappresenta una lesson.

Esempio:

```md
---
id: lesson-frieren-ep01-intro
media_id: media-frieren
slug: ep01-intro
title: Episodio 1 - Introduzione
order: 10
segment_ref: episode-01
difficulty: n5
status: active
---

# Obiettivo

In questa lezione vediamo il lessico base dell'apertura.

## Termini chiave

- [食べる](term:term-taberu)
- [大丈夫](term:term-daijoubu)

## Nota

La forma {{魔法|まほう}} ricorre spesso in contesto fantasy.
```

Campi obbligatori:

- `id`
- `media_id`
- `slug`
- `title`
- `order`

Campi opzionali:

- `segment_ref`
- `difficulty`
- `tags`
- `status`
- `summary`
- `prerequisites`

## 7. File cards

Ogni file in `cards/` contiene una o piu card dichiarate come blocchi
strutturati.

Esempio:

```md
---
id: cards-frieren-ep01
media_id: media-frieren
slug: ep01-cards
title: Episodio 1 - Core cards
order: 10
segment_ref: episode-01
---

:::card
id: card-taberu-recognition
entry_type: term
entry_id: term-taberu
card_type: recognition
front: 食べる
back: mangiare
tags: [verb, core]
:::

:::card
id: card-teiru-core
entry_type: grammar
entry_id: grammar-teiru
card_type: concept
front: ～ている
back: azione in corso / stato risultante
tags: [grammar, core]
:::
```

Campi frontmatter obbligatori:

- `id`
- `media_id`
- `slug`
- `title`
- `order`

Ogni blocco `:::card` deve contenere:

- `id`
- `entry_type`
- `entry_id`
- `card_type`
- `front`
- `back`

## 8. Entita dichiarabili nel contenuto

Per generare il glossary servono entita canoniche. In v1 sono supportate due
tipologie minime:

- `term`
- `grammar`

Le entita possono essere dichiarate in textbook o cards tramite blocchi
strutturati.

### 8.1 Blocco `term`

```md
:::term
id: term-taberu
lemma: 食べる
reading: たべる
romaji: taberu
pos: ichidan-verb
meaning_it: mangiare
notes_it: >-
  Verbo di base molto frequente.
level_hint: n5
aliases: [たべる, taberu]
:::
```

Campi obbligatori:

- `id`
- `lemma`
- `reading`
- `romaji`
- `meaning_it`

Campi opzionali:

- `pos`
- `meaning_literal_it`
- `notes_it`
- `level_hint`
- `aliases`
- `segment_ref`

### 8.2 Blocco `grammar`

```md
:::grammar
id: grammar-teiru
pattern: ～ている
title: Forma in -te iru
meaning_it: azione in corso o stato risultante
notes_it: >-
  Compare molto spesso nel parlato e nei testi descrittivi.
level_hint: n4
:::
```

Campi obbligatori:

- `id`
- `pattern`
- `title`
- `meaning_it`

Campi opzionali:

- `notes_it`
- `level_hint`
- `aliases`
- `segment_ref`

### 8.3 Blocco `example_sentence`

Usalo quando vuoi mostrare una frase giapponese completa con traduzione
italiana collassabile nel reader.

```md
:::example_sentence
jp: >-
  {{自分|じぶん}}の{{墓地|ぼち}}からクリーチャーを{{1体|いったい}}{{出|だ}}す。
translation_it: >-
  Metti in gioco 1 creatura dal tuo cimitero.
:::
```

Campi obbligatori:

- `jp`
- `translation_it`

## 9. Riferimenti semantici inline

Per attivare tooltip e linking si usano link con schema custom.

Sintassi:

```md
[食べる](term:term-taberu)
[～ている](grammar:grammar-teiru)
```

Regole:

- il target deve esistere;
- il renderer sostituisce il link con un componente interattivo;
- il componente apre tooltip su desktop e sheet su mobile.

## 10. Furigana inline

Sintassi v1:

```md
{{日本語|にほんご}}
{{大丈夫|だいじょうぶ}}
```

Regole:

- il parser converte in nodi `ruby`;
- il testo base resta sempre disponibile;
- la visualizzazione dipende dalla preferenza utente;
- la sintassi e valida anche dentro paragrafi o liste.

## 11. Glossary derivato

Il glossary viene costruito unendo:

- entita `term` dichiarate nei file;
- entita `grammar` dichiarate nei file;
- riferimenti da lesson e cards;
- metadata di card e segmenti.

Per ogni entry del glossary il sistema deve poter risalire a:

- file sorgente;
- lesson di introduzione;
- cards collegate;
- segmenti collegati;
- alias di ricerca.

## 12. Regole di import

- Import fallisce se manca un campo obbligatorio.
- Import fallisce se ci sono ID duplicati.
- Import fallisce se un riferimento inline punta a un ID inesistente.
- Import fallisce se due entita con lo stesso ID hanno campi incompatibili.
- Import aggiorna il contenuto senza azzerare gli stati review esistenti.

## 13. Regole di naming

- prefisso suggerito per media: `media-`
- prefisso suggerito per lesson: `lesson-`
- prefisso suggerito per term: `term-`
- prefisso suggerito per grammar: `grammar-`
- prefisso suggerito per card: `card-`

Esempio:

- `media-frieren`
- `lesson-frieren-ep01-intro`
- `term-taberu`
- `grammar-teiru`
- `card-taberu-recognition`

## 14. Vincoli v1

- Nessun HTML libero obbligatorio.
- Nessuna logica condizionale nel Markdown.
- Nessuna definizione implicita basata solo sul testo libero.
- Nessun riferimento senza ID.

## 15. Estensioni future possibili

- `sentence` come entita canonica esplicita;
- supporto ad audio e immagini;
- note grammaticali piu ricche;
- campi di frequency / priority;
- deck dinamici e card generate;
- sync con dizionari esterni.

## 16. Decisione pratica per v1

Per partire velocemente:

- le `cards` sono la sede preferita per definire le entita canoniche;
- il `textbook` dovrebbe di norma referenziare entita gia dichiarate;
- il `textbook` puo comunque dichiarare entita nuove quando necessario;
- il glossary nasce dalla fusione delle entita dichiarate e dei riferimenti;
- se una entry e critica per il glossary, va dichiarata esplicitamente come
  `term` o `grammar`, non solo nominata nel testo.

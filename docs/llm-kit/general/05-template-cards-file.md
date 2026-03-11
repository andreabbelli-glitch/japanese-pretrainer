---
id: cards-<media-slug>-<segment-slug>-<batch-slug>
media_id: media-<media-slug>
slug: <batch-slug>
title: <titolo-batch-cards>
order: <numero-ordine>
segment_ref: <segment-ref>
---

:::term
id: term-<entry-slug>
cross_media_group: <shared-group-id-opzionale>
lemma: <forma-base>
reading: <reading-kana>
romaji: <romaji>
meaning_it: <significato-principale-in-italiano>
pos: <part-of-speech-opzionale>
aliases: [<alias-1>, <alias-2>]
notes_it: >-
  <nota-opzionale: spiega che cosa significa davvero la entry e che cosa ti fa
  capire o fare nel media>
level_hint: <n5|n4|n3|custom>
:::

:::grammar
id: grammar-<entry-slug>
cross_media_group: <shared-group-id-opzionale>
pattern: <pattern>
title: <titolo-breve>
meaning_it: <significato-in-italiano>
aliases: [<alias-1>, <alias-2>]
notes_it: >-
  <nota-opzionale: spiega che cosa significa davvero il pattern e quale effetto
  ha sulla lettura o sull'azione nel media>
level_hint: <n5|n4|n3|custom>
:::

:::card
id: card-<entry-slug>-recognition
entry_type: term
entry_id: term-<entry-slug>
card_type: recognition
front: <testo-front>
back: <testo-back>
example_jp: >-
  <frase-obbligatoria-in-giapponese-che-contiene-la-entry-in-un-contesto-reale>
example_it: >-
  <traduzione-italiana-obbligatoria-della-stessa-frase>
notes_it: >-
  <nota-opzionale-con-inline-markdown-o-riferimenti: chiarisci il significato
  reale e l'uso concreto della entry nel media>
tags: [<tag-1>, <tag-2>]
:::

:::card
id: card-<grammar-slug>-concept
entry_type: grammar
entry_id: grammar-<grammar-slug>
card_type: concept
front: <testo-front>
back: <testo-back>
example_jp: >-
  <frase-obbligatoria-in-giapponese-che-contiene-il-pattern-in-un-contesto-reale>
example_it: >-
  <traduzione-italiana-obbligatoria-della-stessa-frase>
notes_it: >-
  <nota-opzionale-con-inline-markdown-o-riferimenti: chiarisci il significato
  reale e l'uso concreto del pattern nel media>
tags: [<tag-1>, <tag-2>]
:::

<!--
Regole pratiche:
- definisci qui le entry canoniche preferite per glossary/review;
- se una entry esiste gia, non ridefinirla: crea solo la :::card che la usa;
- usa `cross_media_group` solo per collegare intenzionalmente la stessa entry
  concettuale tra media diversi; non per omografie dubbie;
- se lo usi, preferisci uno slug stabile con prefisso del tipo, per esempio
  `term-shared-mission-progression`;
- ogni `:::card` deve avere sempre `example_jp` + `example_it`;
- `example_jp` deve essere una frase completa e contestuale utile sul retro
  review, non una parola isolata o una ripetizione del `front`;
- i campi `notes_it` vanno trattati come prose YAML e scritti in `>-`;
- evita plain scalar per testo con `:`/`：`, furigana, link semantici, backtick
  o frasi complete di rules text;
- se un termine o pattern compare nel testo visibile di `notes_it` con kanji,
  annotalo con furigana anche se esiste gia una `reading` nell'entry;
- se usi un link semantico con label in kanji, annota il label:
  `[{{報酬|ほうしゅう}}](term:term-reward)`;
- se usi inline code con giapponese non trasparente, annota anche li:
  `` `{{達成済み|たっせいずみ}}` ``;
- per composti numerici con contatori o qualificatori usa un solo furigana sul
  blocco intero: `{{1枚|いちまい}}`, `{{4以下|よんいか}}`,
  `{{4つ以上|よっついじょう}}`;
- non fermarti a formule come "X e utile/importante": `notes_it` deve dire che
  cosa significa davvero X e che cosa ti fa capire o fare nel media;
- se la entry e un nome proprio poco trasparente, spiega almeno quale ruolo
  ricorrente segnala o quale parte del nome conviene riconoscere;
- non aggiungere testo libero fuori dai blocchi strutturati.
-->

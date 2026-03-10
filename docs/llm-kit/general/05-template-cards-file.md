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
lemma: <forma-base>
reading: <reading-kana>
romaji: <romaji>
meaning_it: <significato-principale-in-italiano>
pos: <part-of-speech-opzionale>
aliases: [<alias-1>, <alias-2>]
notes_it: >-
  <nota-opzionale>
level_hint: <n5|n4|n3|custom>
:::

:::grammar
id: grammar-<entry-slug>
pattern: <pattern>
title: <titolo-breve>
meaning_it: <significato-in-italiano>
aliases: [<alias-1>, <alias-2>]
notes_it: >-
  <nota-opzionale>
level_hint: <n5|n4|n3|custom>
:::

:::card
id: card-<entry-slug>-recognition
entry_type: term
entry_id: term-<entry-slug>
card_type: recognition
front: <testo-front>
back: <testo-back>
notes_it: >-
  <nota-opzionale-con-inline-markdown-o-riferimenti>
tags: [<tag-1>, <tag-2>]
:::

:::card
id: card-<grammar-slug>-concept
entry_type: grammar
entry_id: grammar-<grammar-slug>
card_type: concept
front: <testo-front>
back: <testo-back>
notes_it: >-
  <nota-opzionale-con-inline-markdown-o-riferimenti>
tags: [<tag-1>, <tag-2>]
:::

<!--
Regole pratiche:
- definisci qui le entry canoniche preferite per glossary/review;
- se una entry esiste gia, non ridefinirla: crea solo la :::card che la usa;
- i campi `notes_it` vanno trattati come prose YAML e scritti in `>-`;
- evita plain scalar per testo con `:`/`：`, furigana, link semantici, backtick
  o frasi complete di rules text;
- per composti numerici con contatori o qualificatori usa un solo furigana sul
  blocco intero: `{{1枚|いちまい}}`, `{{4以下|よんいか}}`,
  `{{4つ以上|よっついじょう}}`;
- non aggiungere testo libero fuori dai blocchi strutturati.
-->

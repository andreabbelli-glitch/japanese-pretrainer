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
  <nota-opzionale: spiega che cosa significa davvero la entry, quale ruolo
  svolge nel media e che cosa cambia quando la incontri>
level_hint: <n5|n4|n3|custom>
:::

:::grammar
id: grammar-<entry-slug>
cross_media_group: <shared-group-id-opzionale>
pattern: <pattern>
title: <titolo-breve>
reading: <reading-kana-se-il-pattern-contiene-kanji-o-letture-non-banali>
meaning_it: <significato-in-italiano>
aliases: [<alias-1>, <alias-2>]
notes_it: >-
  <nota-opzionale: spiega che cosa significa davvero il pattern, dove aggancia
  la frase e quale effetto ha sulla lettura o sull'azione nel media>
level_hint: <n5|n4|n3|custom>
:::

:::card
id: card-<entry-slug>-recognition
entry_type: term
entry_id: term-<entry-slug>
card_type: recognition
front: '<testo-front>'
back: '<testo-back>'
example_jp: >-
  <frase-obbligatoria-in-giapponese-che-contiene-la-entry-in-un-contesto-reale>
example_it: >-
  <traduzione-italiana-obbligatoria-della-stessa-frase>
notes_it: >-
  <nota-opzionale-con-inline-markdown-o-riferimenti: chiarisci il significato
  reale e l'uso concreto della entry nel media, senza parlare della flashcard o
  del processo di studio>
tags: [<tag-1>, <tag-2>]
:::

:::card
id: card-<grammar-slug>-concept
entry_type: grammar
entry_id: grammar-<grammar-slug>
card_type: concept
front: '<testo-front>'
back: '<testo-back>'
example_jp: >-
  <frase-obbligatoria-in-giapponese-che-contiene-il-pattern-in-un-contesto-reale>
example_it: >-
  <traduzione-italiana-obbligatoria-della-stessa-frase>
notes_it: >-
  <nota-opzionale-con-inline-markdown-o-riferimenti: chiarisci il significato
  reale e l'uso concreto del pattern nel media, senza parlare della flashcard o
  del processo di studio>
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
- `example_jp` deve essere centrata il piu possibile sul media attuale: usa il
  contesto, il lessico e le situazioni del media in cui la card vive, non
  scenari generici scollegati;
- `example_jp` non deve contenere kanji che non hanno una flashcard associata
  nel corpus di studio (indipendentemente dal media e dallo stato di studio
  della card); anticipare leggermente e ammesso, usare kanji completamente
  fuori dal corpus no;
- `front` e `example_jp` devono annotare con furigana i kanji che il learner
  deve leggere davvero nella card review;
- nei composti misti, il ruby non deve inglobare kana gia visibili: scrivi
  `{{受|う}}け{{取|と}}る`, `{{手|て}}{{持|も}}ち`, `メイン{{枠|わく}}`, non
  `{{受け取る|うけとる}}`, `{{手持ち|てもち}}`, `{{メイン枠|めいんわく}}`;
- i numeri visibili nelle card vanno annotati sempre con la lettura corretta,
  anche quando non hanno contatori: `{{4|よん}}`, `{{5000|ごせん}}`,
  `{{-3000|マイナスさんぜん}}`;
- quando un numero e legato a un contatore, scrivi la lettura corretta del
  chunk davvero annotato e non una ricostruzione meccanica: `{{1体|いったい}}`,
  `{{2|ふた}}つ`, `{{2回|にかい}}`, `{{4枚|よんまい}}`;
- per i `:::grammar`, se `pattern` contiene kanji o una lettura non banale,
  aggiungi sempre `reading`;
- lo stesso vale per pattern misti kana+kanji: `それ{{以外|いがい}}なら` va
  annotato nel testo visibile e `reading: それいがいなら` va dichiarato
  nell'entry;
- se in `notes_it` compare giapponese con kanji come parte del punto didattico,
  annotalo con furigana anche li;
- per `front` e `back`, il default sicuro e una stringa YAML quotata;
- se `front` o `back` contengono furigana `{{base|reading}}`, testo carta,
  punteggiatura forte o composti markdown-like, non lasciarli mai come plain
  scalar;
- per valori corti su una riga, preferisci `'...'`; per valori multi-linea o
  prose lunghe, usa `>-`;
- i campi `notes_it` vanno trattati come prose YAML e scritti in `>-`;
- tutto l'italiano in `meaning_it`, `example_it` e `notes_it` deve essere
  grammaticalmente corretto e con accenti veri (`è`, `può`, `più`, `già`,
  `cioè`, `così`, `perché`), non con forme ASCII degradate;
- evita plain scalar per testo con `:`/`：`, furigana, link semantici, backtick
  o frasi complete di rules text;
- esempio corretto per flashcard side:
  `front: '{{手|て}}{{持|も}}ち'`
- se un termine o pattern compare nel testo visibile di `notes_it` con kanji,
  annotalo con furigana anche se esiste gia una `reading` nell'entry;
- se usi un link semantico con label in kanji, annota il label:
  `[{{報酬|ほうしゅう}}](term:term-reward)`;
- se usi inline code con giapponese non trasparente, annota anche li:
  `` `{{達成済み|たっせいずみ}}` ``;
- per i numeri annota il chunk corretto senza inglobare kana gia visibili:
  `{{4|よん}}`, `{{5000|ごせん}}`, `{{-3000|マイナスさんぜん}}`,
  `{{1枚|いちまい}}`, `{{4以下|よんいか}}`, `{{4|よっ}}つ{{以上|いじょう}}`,
  `{{2|ふた}}つ`;
- se il numero ha un contatore, controlla esplicitamente che la pronuncia sia
  quella corretta del chunk annotato prima di chiudere il file;
- non compilare campi audio se non hai un asset locale gia reale e metadata di
  provenance affidabili; di norma l'audio viene arricchito dopo dal workflow
  locale;
- non fermarti a formule come "X e utile/importante": `notes_it` deve dire che
  cosa significa davvero X e che cosa ti fa capire o fare nel media;
- privilegia entry con buona spendibilita linguistica: kanji, lessico e pattern
  che puoi reincontrare anche fuori da una singola scena o da uno specifico
  media;
- non creare card sul nome proprio completo di una cosa o entita singola; se
  il nome serve per il contesto, spiegalo nel textbook e, se contiene
  giapponese riusabile, carda semmai quel componente invece del nome intero;
- non trascurare elementi piccoli ma strutturalmente decisivi come marcatori di
  scope, totalita, riferimento o distribuzione (`すべて`, `各`, `それら`,
  `その中`, `ずつ`) quando cambiano davvero come si legge la frase;
- se uno di questi elementi non e ancora coperto nello stesso media e serve a
  capire bersagli, quantita o referente, puo meritare una nuova entry e una
  card anche se da solo sembra "piccolo";
- evita note meta del tipo "flashcard utile", "da fissare", "da rendere
  automatico", "qui conviene tenere la card": descrivi invece significato,
  ruolo e conseguenza concreta;
- evita anche formule come "entry canonica", "card canoniche", "nel corpus",
  "in questo seed" o "il valore didattico sta in...": parlano della curation,
  non di quello che il giapponese fa capire;
- non sprecare card su sigle, acronimi, codici prodotto, nomi evento o dettagli
  troppo verticali se non allenano davvero una forma giapponese spendibile;
- se un termine molto verticale serve a capire il media o a interagirci
  correttamente ma non merita memoria attiva, spiegalo nel textbook senza
  trasformarlo in nuova card;
- se la entry e un nome proprio poco trasparente, spiega almeno quale ruolo
  ricorrente segnala o quale parte del nome conviene riconoscere;
- non aggiungere testo libero fuori dai blocchi strutturati.
-->
